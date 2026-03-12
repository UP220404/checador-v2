/**
 * Servicio para gestión de Asistencias
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, CONFIG, USUARIOS_REMOTOS, USUARIOS_MODO_PRUEBAS, USUARIOS_MULTI_REGISTRO } from '../config/constants.js';
import { getTodayString, dateToString, getTimeString, evaluarPuntualidad, isWeekend, getStartOfWeek, getMexicoTimeComponents } from '../utils/dateUtils.js';
import { verificarUbicacionOficina } from '../utils/geoUtils.js';
import QRService from './QRService.js';
import UserService from './UserService.js';

class AttendanceService {
  constructor() {
    this.attendanceCollection = COLLECTIONS.REGISTROS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Registra entrada o salida (check-in)
   * @param {string} uid - UID del usuario
   * @param {Object} qrData - { qrCode, token }
   * @param {Object} location - { lat, lng, accuracy } (opcional para remotos)
   * @returns {Object} Resultado del registro
   */
  async checkIn(uid, qrData, location = null) {
    try {
      // 1. Obtener datos del usuario
      const usuario = await UserService.getUserByUid(uid);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }

      const esRemoto = USUARIOS_REMOTOS.includes(usuario.correo);
      const esModoPruebas = CONFIG.MODO_PRUEBAS || USUARIOS_MODO_PRUEBAS.includes(usuario.correo);
      const esMultiRegistro = USUARIOS_MULTI_REGISTRO.includes(usuario.correo);

      console.log(`📝 Check-in para: ${usuario.nombre} (${usuario.correo})`);
      console.log(`   Remoto: ${esRemoto}, Pruebas: ${esModoPruebas}, Multi: ${esMultiRegistro}`);

      // 2. Validar QR (solo si NO es remoto y NO es modo pruebas)
      if (!esRemoto && !esModoPruebas) {
        const qrValidation = await QRService.validateToken(
          qrData.qrCode,
          qrData.token,
          usuario.correo
        );

        if (!qrValidation.valido) {
          return {
            success: false,
            message: qrValidation.mensaje
          };
        }
      }

      // 3. Validar ubicación (solo si NO es remoto y NO es modo pruebas)
      if (!esRemoto && !esModoPruebas) {
        const ubicacionValida = this.validarUbicacion(location);
        if (!ubicacionValida.success) {
          return ubicacionValida;
        }
      }

      // 4. Validar restricciones básicas (a menos que sea modo pruebas)
      if (!esModoPruebas) {
        const restriccionesValidas = this.validarRestricciones(usuario.tipo);
        if (!restriccionesValidas.success) {
          return restriccionesValidas;
        }
      }

      // 5. Determinar tipo de evento (entrada/salida)
      const tipoEvento = await this.determinarTipoEvento(uid, esModoPruebas, esMultiRegistro);
      if (!tipoEvento.success) {
        return tipoEvento;
      }

      // 6. Validar horarios según tipo de evento
      if (!esModoPruebas) {
        const horarioValido = this.validarHorario(tipoEvento.tipo, usuario.tipo);
        if (!horarioValido.success) {
          return horarioValido;
        }
      }

      // 7. Crear registro de asistencia
      const registro = await this.crearRegistro(uid, usuario, tipoEvento.tipo, location, esModoPruebas);

      return {
        success: true,
        data: registro,
        message: this.generarMensaje(registro)
      };

    } catch (error) {
      console.error('Error en check-in:', error);
      throw error;
    }
  }

  /**
   * Valida ubicación del usuario
   */
  validarUbicacion(location) {
    if (!location || !location.lat || !location.lng) {
      return {
        success: false,
        message: '⛔ No se pudo obtener tu ubicación. Activa la ubicación para registrar asistencia.'
      };
    }

    const resultado = verificarUbicacionOficina(location);

    if (!resultado.dentroDeRango) {
      return {
        success: false,
        message: `⛔ Solo puedes registrar asistencia dentro de la oficina. Distancia: ${resultado.distancia}m (máximo: ${resultado.limiteMetros}m)`
      };
    }

    return { success: true };
  }

  /**
   * Valida restricciones básicas (fin de semana, horario general)
   */
  validarRestricciones(tipoUsuario) {
    const ahora = new Date();

    // Validar fin de semana
    if (isWeekend(ahora)) {
      return {
        success: false,
        message: '⛔ No puedes registrar asistencia en fin de semana.'
      };
    }

    // Validar horario general (7 AM - 10 PM)
    const { hour } = getMexicoTimeComponents(ahora);
    if (hour < 7 || hour >= 22) {
      return {
        success: false,
        message: '❌ Solo puedes registrar entre 7:00 am y 10:00 pm.'
      };
    }

    return { success: true };
  }

  /**
   * Determina si el evento es entrada o salida
   */
  async determinarTipoEvento(uid, esModoPruebas, esMultiRegistro) {
    const hoy = getTodayString();

    // Verificar registros del día
    const yaRegistroEntrada = await this.yaRegistroHoy(uid, hoy, 'entrada');
    const yaRegistroSalida = await this.yaRegistroHoy(uid, hoy, 'salida');

    // Modo pruebas o multi-registro: alternar
    if (esModoPruebas || esMultiRegistro) {
      const totalRegistros = await this.contarRegistrosHoy(uid, hoy);
      const tipo = totalRegistros % 2 === 0 ? 'entrada' : 'salida';
      console.log(`🔄 Multi-registro: ${totalRegistros} registros hoy, siguiente: ${tipo}`);
      return { success: true, tipo };
    }

    // Lógica normal
    if (!yaRegistroEntrada) {
      return { success: true, tipo: 'entrada' };
    } else if (!yaRegistroSalida) {
      return { success: true, tipo: 'salida' };
    } else {
      return {
        success: false,
        message: '⚠️ Ya registraste entrada y salida hoy.'
      };
    }
  }

  /**
   * Valida horarios según tipo de evento y usuario
   */
  validarHorario(tipoEvento, tipoUsuario) {
    const ahora = new Date();

    const { hour: horaActual, minute: minutosActuales } = getMexicoTimeComponents(ahora);

    if (tipoEvento === 'entrada') {
      // Validar ventana de entrada (7 AM - límite según tipo)
      const horaLimite = tipoUsuario === 'becario' ? 13 : 16;

      if (horaActual >= horaLimite) {
        return {
          success: false,
          message: `❌ Ya no puedes registrar entrada después de las ${horaLimite}:00.`
        };
      }
    } else {
      // Validar hora mínima de salida
      const horaSalida = tipoUsuario === 'becario'
        ? CONFIG.HORA_LIMITE_SALIDA_BECARIO
        : CONFIG.HORA_LIMITE_SALIDA_EMPLEADO;

      const minutosMinimos = (horaSalida.hours * 60) + horaSalida.minutes;
      const minutosReales = (horaActual * 60) + minutosActuales;

      if (minutosReales < minutosMinimos) {
        return {
          success: false,
          message: `⏳ Espera a la hora de salida (${horaSalida.hours}:${String(horaSalida.minutes).padStart(2, '0')}) para registrar tu salida.`
        };
      }
    }

    return { success: true };
  }

  /**
   * Crea el registro de asistencia en Firestore
   */
  async crearRegistro(uid, usuario, tipoEvento, location, esModoPruebas) {
    const ahora = new Date();
    const fecha = getTodayString();
    const hora = getTimeString(ahora);

    // Evaluar estado (puntual/retardo)
    let estado;
    if (tipoEvento === 'entrada') {
      estado = esModoPruebas || usuario.tipo === 'especial' || usuario.tipo === 'horario_especial'
        ? 'puntual'
        : evaluarPuntualidad(ahora, CONFIG.HORA_LIMITE_ENTRADA.hours, CONFIG.HORA_LIMITE_ENTRADA.minutes);
    } else {
      estado = 'salida';
    }

    const registro = {
      uid: uid,
      nombre: usuario.nombre,
      email: usuario.correo,
      tipo: usuario.tipo,
      fecha: fecha,
      hora: hora,
      tipoEvento: tipoEvento,
      estado: estado,
      ubicacion: location || null,
      timestamp: ahora
    };

    // Guardar en Firestore
    const docRef = await this.db.collection(this.attendanceCollection).add(registro);

    console.log(`✅ Registro creado: ${tipoEvento} - ${estado} - ${hora}`);

    return {
      id: docRef.id,
      ...registro
    };
  }

  /**
   * Genera mensaje de respuesta según el registro
   */
  generarMensaje(registro) {
    const { tipoEvento, estado, hora, nombre } = registro;

    if (tipoEvento === 'entrada') {
      if (estado === 'puntual') {
        return `✅ Entrada puntual registrada a las ${hora}. ¡Buen día, ${nombre}!`;
      } else {
        return `⚠️ Entrada con retardo registrada a las ${hora}.`;
      }
    } else {
      const dia = new Date().getDay();
      if (dia === 5) { // Viernes
        return `📤 Salida registrada a las ${hora}. ¡Disfruta tu fin de semana, ${nombre}!`;
      }
      return `📤 Salida registrada a las ${hora}. ¡Hasta mañana, ${nombre}!`;
    }
  }

  /**
   * Verifica si ya registró un tipo de evento hoy
   */
  async yaRegistroHoy(uid, fecha, tipoEvento) {
    const snapshot = await this.db
      .collection(this.attendanceCollection)
      .where('uid', '==', uid)
      .where('fecha', '==', fecha)
      .where('tipoEvento', '==', tipoEvento)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  /**
   * Cuenta total de registros hoy
   */
  async contarRegistrosHoy(uid, fecha) {
    const snapshot = await this.db
      .collection(this.attendanceCollection)
      .where('uid', '==', uid)
      .where('fecha', '==', fecha)
      .get();

    return snapshot.size;
  }

  /**
   * Obtiene historial de asistencias de un usuario
   */
  async getHistory(uid, limit = 30, startDate = null, endDate = null) {
    try {
      // Solo filtrar por uid en Firestore (no requiere índice)
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('uid', '==', uid)
        .get();

      // Mapear documentos
      let registros = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filtrar por rango de fechas en memoria
      if (startDate || endDate) {
        registros = registros.filter(registro => {
          const fecha = registro.fecha;
          if (startDate && fecha < startDate) return false;
          if (endDate && fecha > endDate) return false;
          return true;
        });
      }

      // Ordenar por fecha y hora ascendente (más antiguos primero)
      registros.sort((a, b) => {
        // Asegurar formato de hora con padding de ceros (HH:MM:SS)
        const padHora = (hora) => {
          const partes = hora.split(':');
          return partes.map(p => p.padStart(2, '0')).join(':');
        };

        const fechaHoraA = `${a.fecha} ${padHora(a.hora)}`;
        const fechaHoraB = `${b.fecha} ${padHora(b.hora)}`;
        return fechaHoraA.localeCompare(fechaHoraB);
      });

      // Retornar solo el límite solicitado
      return registros.slice(0, limit);
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }

  /**
   * Obtiene asistencias semanales de un usuario
   */
  async getWeeklyAttendance(uid) {
    try {
      const inicioSemana = getStartOfWeek();
      const inicioSemanaStr = getTodayString(inicioSemana);

      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('uid', '==', uid)
        .where('fecha', '>=', inicioSemanaStr)
        .orderBy('fecha', 'asc')
        .orderBy('timestamp', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
    } catch (error) {
      console.error('Error obteniendo asistencias semanales:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las asistencias del día (admin)
   */
  async getTodayAttendance() {
    try {
      const hoy = getTodayString();

      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('fecha', '==', hoy)
        .get();

      // Mapear y ordenar en memoria
      const registros = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por hora ascendente (primero el que llegó, hasta el último)
      registros.sort((a, b) => {
        const padHora = (hora) => {
          const partes = hora.split(':');
          return partes.map(p => p.padStart(2, '0')).join(':');
        };
        return padHora(a.hora).localeCompare(padHora(b.hora));
      });

      return registros;
    } catch (error) {
      console.error('Error obteniendo asistencias del día:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE RESUMEN PARA PORTAL EMPLEADO V2
  // ============================================

  /**
   * Calcula horas trabajadas entre entrada y salida
   */
  calcularHorasTrabajadas(horaEntrada, horaSalida) {
    if (!horaEntrada || !horaSalida) return 0;

    const parseHora = (hora) => {
      const partes = hora.split(':');
      return parseInt(partes[0]) * 60 + parseInt(partes[1]);
    };

    const minutosEntrada = parseHora(horaEntrada);
    const minutosSalida = parseHora(horaSalida);

    const minutosTrabajados = minutosSalida - minutosEntrada;
    return Math.max(0, minutosTrabajados / 60); // Retornar horas decimales
  }

  /**
   * Obtiene resumen de asistencia para un usuario
   * Incluye: horas de la semana, horas del mes, días trabajados, retardos
   */
  async getAttendanceSummary(uid) {
    try {
      const ahora = new Date();
      const inicioSemana = getStartOfWeek();
      const inicioSemanaStr = dateToString(inicioSemana);

      // Inicio del mes actual
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const inicioMesStr = dateToString(inicioMes);

      // Obtener todos los registros del usuario (consulta simple sin índice compuesto)
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar por fecha >= inicioMes en memoria
      const registros = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(reg => reg.fecha >= inicioMesStr);

      // Agrupar por fecha
      const registrosPorDia = {};
      registros.forEach(reg => {
        if (!registrosPorDia[reg.fecha]) {
          registrosPorDia[reg.fecha] = { entrada: null, salida: null, retardo: false };
        }
        if (reg.tipoEvento === 'entrada') {
          registrosPorDia[reg.fecha].entrada = reg.hora;
          registrosPorDia[reg.fecha].retardo = reg.estado === 'retardo';
        } else if (reg.tipoEvento === 'salida') {
          registrosPorDia[reg.fecha].salida = reg.hora;
        }
      });

      // Calcular métricas
      let horasSemana = 0;
      let horasMes = 0;
      let diasTrabajadosSemana = 0;
      let diasTrabajadosMes = 0;
      let retardosSemana = 0;
      let retardosMes = 0;

      for (const [fecha, data] of Object.entries(registrosPorDia)) {
        const horas = this.calcularHorasTrabajadas(data.entrada, data.salida);

        horasMes += horas;
        if (data.entrada) diasTrabajadosMes++;
        if (data.retardo) retardosMes++;

        // Si es de esta semana
        if (fecha >= inicioSemanaStr) {
          horasSemana += horas;
          if (data.entrada) diasTrabajadosSemana++;
          if (data.retardo) retardosSemana++;
        }
      }

      return {
        semana: {
          horasTrabajadas: Math.round(horasSemana * 100) / 100,
          diasTrabajados: diasTrabajadosSemana,
          retardos: retardosSemana
        },
        mes: {
          horasTrabajadas: Math.round(horasMes * 100) / 100,
          diasTrabajados: diasTrabajadosMes,
          retardos: retardosMes
        },
        ultimaActualizacion: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo resumen de asistencia:', error);
      throw error;
    }
  }

  /**
   * Obtiene reporte mensual detallado de un usuario
   */
  async getMonthlyReport(uid, year, month) {
    try {
      // Crear fechas de inicio y fin del mes
      const inicioMes = new Date(year, month - 1, 1);
      const finMes = new Date(year, month, 0); // Último día del mes

      const inicioMesStr = getTodayString(inicioMes);
      const finMesStr = getTodayString(finMes);

      // Consulta simple - filtrar por fechas en memoria para evitar índices compuestos
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar por rango de fechas en memoria
      const registros = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(reg => reg.fecha >= inicioMesStr && reg.fecha <= finMesStr);

      // Ordenar por fecha y hora
      registros.sort((a, b) => {
        const fechaHoraA = `${a.fecha} ${a.hora}`;
        const fechaHoraB = `${b.fecha} ${b.hora}`;
        return fechaHoraA.localeCompare(fechaHoraB);
      });

      // Agrupar por día
      const diasDetalle = {};
      registros.forEach(reg => {
        if (!diasDetalle[reg.fecha]) {
          diasDetalle[reg.fecha] = {
            fecha: reg.fecha,
            entrada: null,
            salida: null,
            horasTrabajadas: 0,
            retardo: false
          };
        }

        if (reg.tipoEvento === 'entrada') {
          diasDetalle[reg.fecha].entrada = reg.hora;
          diasDetalle[reg.fecha].retardo = reg.estado === 'retardo';
        } else if (reg.tipoEvento === 'salida') {
          diasDetalle[reg.fecha].salida = reg.hora;
        }
      });

      // Calcular horas por día
      let totalHoras = 0;
      let totalDias = 0;
      let totalRetardos = 0;

      const diasArray = Object.values(diasDetalle).map(dia => {
        dia.horasTrabajadas = this.calcularHorasTrabajadas(dia.entrada, dia.salida);
        totalHoras += dia.horasTrabajadas;
        if (dia.entrada) totalDias++;
        if (dia.retardo) totalRetardos++;
        return dia;
      });

      return {
        periodo: {
          anio: year,
          mes: month,
          nombreMes: new Date(year, month - 1).toLocaleString('es-MX', { month: 'long' })
        },
        resumen: {
          totalHoras: Math.round(totalHoras * 100) / 100,
          diasTrabajados: totalDias,
          retardos: totalRetardos,
          promedioHorasDia: totalDias > 0 ? Math.round((totalHoras / totalDias) * 100) / 100 : 0
        },
        detalle: diasArray
      };
    } catch (error) {
      console.error('Error obteniendo reporte mensual:', error);
      throw error;
    }
  }

  /**
   * Obtiene el registro de asistencia del día actual para un usuario
   */
  async getTodayRecord(uid) {
    try {
      const hoy = getTodayString();

      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('uid', '==', uid)
        .where('fecha', '==', hoy)
        .get();

      if (snapshot.empty) {
        return {
          fecha: hoy,
          entrada: null,
          salida: null,
          retardo: false
        };
      }

      const registros = snapshot.docs.map(doc => doc.data());

      const result = {
        fecha: hoy,
        entrada: null,
        salida: null,
        retardo: false
      };

      registros.forEach(reg => {
        if (reg.tipoEvento === 'entrada') {
          result.entrada = reg.hora;
          result.retardo = reg.estado === 'retardo';
        } else if (reg.tipoEvento === 'salida') {
          result.salida = reg.hora;
        }
      });

      return result;
    } catch (error) {
      console.error('Error obteniendo registro de hoy:', error);
      throw error;
    }
  }
}

export default new AttendanceService();
