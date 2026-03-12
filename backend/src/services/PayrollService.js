import { getFirestore } from '../config/firebase.js';
import { CONFIG, HTTP_STATUS } from '../config/constants.js';
import { isWeekend } from '../utils/dateUtils.js';

/**
 * Servicio de Nómina - Sistema Completo
 *
 * Funcionalidades implementadas:
 * - Gestión de días festivos desde Firebase
 * - Cálculo de nómina quincenal/semanal con datos reales
 * - Integración con ausencias aprobadas
 * - Pago estándar fijo dividido entre 10 días
 * - Validación contra todos los días laborales reales del período
 */
class PayrollService {
  /**
   * Cache de días festivos por año
   */
  static diasFestivosCache = {};
  /**
   * Obtener empleados con configuración de nómina
   */
  static async getEmployeesWithPayrollConfig(tipoNomina = 'quincenal') {
    try {
      const db = getFirestore();
      const usuariosSnapshot = await db.collection('usuarios').get();
      const empleados = [];

      usuariosSnapshot.forEach(doc => {
        const userData = doc.data();

        if (!userData || !userData.nombre) return;

        // Solo incluir empleados con salario configurado
        if (userData.salarioQuincenal && userData.horasQuincenal) {
          const empTipoNomina = userData.tipoNomina || 'quincenal';

          // Filtrar por tipo de nómina
          if (tipoNomina === 'semanal') {
            if (empTipoNomina === 'semanal') {
              empleados.push(this.formatEmployeeData(doc.id, userData));
            }
          } else {
            if (empTipoNomina === 'quincenal' || !userData.tipoNomina) {
              empleados.push(this.formatEmployeeData(doc.id, userData));
            }
          }
        }
      });

      return empleados;
    } catch (error) {
      console.error('❌ Error obteniendo empleados:', error);
      throw error;
    }
  }

  /**
   * Formatear datos del empleado
   */
  static formatEmployeeData(uid, userData) {
    const tipoNomina = userData.tipoNomina || 'quincenal';
    const pagoPorDia = userData.salarioQuincenal / (tipoNomina === 'semanal' ? 5 : 10);

    return {
      uid,
      nombre: userData.nombre,
      email: userData.correo || 'sin-email@cielitohome.com',
      tipo: userData.tipo || 'tiempo_completo',
      tipoNomina,
      salarioQuincenal: userData.salarioQuincenal,
      horasQuincenal: userData.horasQuincenal,
      pagoPorDia,
      tieneIMSS: userData.tieneIMSS || false,
      tieneCajaAhorro: userData.tieneCajaAhorro || false,
      montoCajaAhorro: userData.montoCajaAhorro || 0,
      cuentaBancaria: userData.cuentaBancaria || '',
      nombreBanco: userData.nombreBanco || ''
    };
  }

  /**
   * Cargar días festivos del año desde Firebase
   */
  static async cargarDiasFestivos(anio) {
    try {
      // Verificar cache
      if (this.diasFestivosCache[anio]) {
        console.log(`✅ Días festivos ${anio} cargados desde cache`);
        return this.diasFestivosCache[anio];
      }

      console.log(`🔄 Cargando días festivos de ${anio} desde Firebase...`);
      const db = getFirestore();

      const festivosSnapshot = await db.collection('dias_festivos')
        .where('año', '==', anio)
        .where('activo', '==', true)
        .get();

      const festivos = {};
      festivosSnapshot.forEach(doc => {
        const data = doc.data();
        const fechaStr = data.fecha; // Formato: "2025-01-01"
        festivos[fechaStr] = {
          fecha: data.fecha,
          año: data.año,
          mes: data.mes,
          dia: data.dia,
          nombre: data.nombre,
          tipo: data.tipo || 'federal'
        };
      });

      this.diasFestivosCache[anio] = festivos;
      console.log(`✅ ${Object.keys(festivos).length} días festivos cargados para ${anio}`);

      return festivos;
    } catch (error) {
      console.error('❌ Error cargando días festivos:', error);
      return {};
    }
  }

  /**
   * Verificar si una fecha es festivo
   */
  static esDiaFestivo(anio, mes, dia, festivosDelAnio = {}) {
    const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return festivosDelAnio.hasOwnProperty(fechaStr);
  }

  /**
   * Guardar día festivo en Firebase
   */
  static async guardarDiaFestivo(fecha, nombre, tipo = 'federal') {
    try {
      const [año, mes, dia] = fecha.split('-').map(Number);
      const db = getFirestore();

      const festivo = {
        fecha: fecha,
        año: año,
        mes: mes,
        dia: dia,
        nombre: nombre,
        tipo: tipo,
        activo: true,
        creadoEn: new Date().toISOString()
      };

      await db.collection('dias_festivos').add(festivo);

      // Limpiar cache para forzar recarga
      delete this.diasFestivosCache[año];

      console.log(`✅ Día festivo guardado: ${fecha} - ${nombre}`);
      return { success: true, data: festivo };
    } catch (error) {
      console.error('❌ Error guardando día festivo:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los días festivos de un año
   */
  static async obtenerDiasFestivos(anio) {
    try {
      const festivos = await this.cargarDiasFestivos(anio);
      return {
        success: true,
        data: Object.values(festivos)
      };
    } catch (error) {
      console.error('❌ Error obteniendo días festivos:', error);
      throw error;
    }
  }

  /**
   * Eliminar día festivo
   */
  static async eliminarDiaFestivo(festivoId) {
    try {
      const db = getFirestore();
      await db.collection('dias_festivos').doc(festivoId).delete();

      // Limpiar cache
      this.diasFestivosCache = {};

      console.log(`✅ Día festivo eliminado: ${festivoId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando día festivo:', error);
      throw error;
    }
  }

  /**
   * Calcular días laborales de un período
   * Excluye fines de semana y días festivos
   * ✅ SOLO incluye días que ya han ocurrido (hasta hoy)
   */
  static calcularDiasLaborales(anio, mes, periodo, festivosDelAnio = {}) {
    const diasLaborales = [];
    const ultimoDia = new Date(anio, mes, 0).getDate();

    let diaInicio, diaFin;
    if (periodo === 'primera') {
      diaInicio = 1;
      diaFin = 15;
    } else {
      diaInicio = 16;
      diaFin = ultimoDia;
    }

    // ✅ LÍMITE: Solo contar días hasta HOY (no incluir días futuros)
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const mesActual = hoy.getMonth() + 1; // getMonth() es 0-indexed
    const anioActual = hoy.getFullYear();

    // Si estamos calculando un período futuro, no hay días laborales aún
    if (anio > anioActual || (anio === anioActual && mes > mesActual)) {
      console.log(`⚠️ Período futuro (${mes}/${anio}), no hay días laborales aún`);
      return [];
    }

    // Si es el mes actual, limitar diaFin a hoy
    if (anio === anioActual && mes === mesActual) {
      diaFin = Math.min(diaFin, diaActual);
      console.log(`📅 Limitando cálculo hasta hoy: día ${diaActual}`);
    }

    for (let dia = diaInicio; dia <= diaFin; dia++) {
      const fecha = new Date(anio, mes - 1, dia);
      const diaSemana = fecha.getDay();

      // Excluir fines de semana (0=domingo, 6=sábado) y días festivos
      if (diaSemana >= 1 && diaSemana <= 5 && !this.esDiaFestivo(anio, mes, dia, festivosDelAnio)) {
        diasLaborales.push(dia);
      }
    }

    return diasLaborales;
  }

  /**
   * Obtener registros de asistencia de un empleado
   */
  static async getAttendanceRecords(uid, mes, anio, periodo) {
    try {
      const db = getFirestore();
      const registrosRef = db.collection('registros');

      // Determinar rango de fechas
      const ultimoDia = new Date(anio, mes, 0).getDate();
      let diaInicio, diaFin;
      if (periodo === 'primera') {
        diaInicio = 1;
        diaFin = 15;
      } else {
        diaInicio = 16;
        diaFin = ultimoDia;
      }

      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-${String(diaInicio).padStart(2, '0')}`;
      const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(diaFin).padStart(2, '0')}`;

      console.log(`📅 Buscando registros para ${uid} entre ${fechaInicio} y ${fechaFin}`);

      // Filtrar por fecha directo en Firestore (requiere índice compuesto: uid + fecha)
      // El link para crear el índice aparece automáticamente en los logs la primera vez.
      const snapshot = await registrosRef
        .where('uid', '==', uid)
        .where('fecha', '>=', fechaInicio)
        .where('fecha', '<=', fechaFin)
        .get();

      const registros = [];
      snapshot.forEach(doc => {
        registros.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log(`✅ Encontrados ${registros.length} registros para ${uid}`);
      return registros;
    } catch (error) {
      console.error('Error obteniendo registros:', error);
      return [];
    }
  }

  /**
   * Obtener ausencias aprobadas de un período
   */
  static async obtenerAusenciasDelPeriodo(emailEmpleado, mes, anio, periodo) {
    try {
      console.log(`🔄 Buscando ausencias aprobadas para ${emailEmpleado} - ${mes}/${anio} periodo ${periodo}`);
      const db = getFirestore();

      // Convertir periodo a número
      let periodoNumero = null;
      if (periodo === 'primera') {
        periodoNumero = 1;
      } else if (periodo === 'segunda') {
        periodoNumero = 2;
      }

      // Construir query
      const ausenciasRef = db.collection('ausencias');
      let query = ausenciasRef
        .where('emailUsuario', '==', emailEmpleado)
        .where('estado', '==', 'aprobada')
        .where('quincena.mes', '==', mes)
        .where('quincena.anio', '==', anio);

      // Agregar filtro de periodo solo si es quincenal
      if (periodoNumero !== null) {
        query = query.where('quincena.periodo', '==', periodoNumero);
      }

      const snapshot = await query.get();
      const ausencias = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        ausencias.push({
          id: doc.id,
          ...data
        });
      });

      console.log(`✅ ${ausencias.length} ausencias aprobadas encontradas`);
      return ausencias;
    } catch (error) {
      console.error('❌ Error obteniendo ausencias del período:', error);
      return [];
    }
  }

  /**
   * Mapear tipo de ausencia a campo de nómina
   */
  static mapearTipoAusenciaANomina(tipo) {
    const mapeo = {
      'vacaciones': { campo: 'vacaciones', nombre: 'Vacaciones' },
      'incapacidad': { campo: 'incapacidad', nombre: 'Incapacidad' },
      'viaje_negocios': { campo: 'viaje', nombre: 'Viaje de negocios' },
      'permiso': { campo: 'vacaciones', nombre: 'Permiso' },
      'justificante': { campo: 'incapacidad', nombre: 'Justificante médico' },
      'retardo_justificado': { campo: null, nombre: 'Retardo justificado' }
    };
    return mapeo[tipo] || null;
  }

  /**
   * Calcular nómina con datos reales
   * ✅ Pago por día SIEMPRE fijo: salario / 10
   * ✅ Días esperados: TODOS los días laborales del período (pueden ser 11-12)
   * ✅ Validación de asistencia contra días reales
   * ✅ Integración con ausencias aprobadas
   * ✅ Excluye días festivos automáticamente
   */
  static async calculatePayroll({ mes, anio, periodo, tipoNomina = 'quincenal' }) {
    try {
      console.log(`📊 Calculando nómina ${tipoNomina} - ${mes}/${anio} - ${periodo}`);

      // 1. Cargar días festivos del año
      const festivosDelAnio = await this.cargarDiasFestivos(anio);

      // 2. Obtener empleados
      const empleados = await this.getEmployeesWithPayrollConfig(tipoNomina);

      if (empleados.length === 0) {
        throw new Error(`No hay empleados configurados con nómina ${tipoNomina}`);
      }

      // 3. Calcular días laborales del período (excluyendo festivos)
      const diasLaborales = this.calcularDiasLaborales(anio, mes, periodo, festivosDelAnio);
      const DIAS_ESTANDAR = tipoNomina === 'semanal' ? 5 : 10;

      // ✅ IMPORTANTE: Para validación, limitamos a los primeros 10 días
      // Pero el empleado DEBE asistir a TODOS los días reales
      const diasLaboralesEstandar = diasLaborales.slice(0, DIAS_ESTANDAR);

      console.log(`📅 Días laborales del período: ${diasLaborales.length} días`);
      console.log(`📅 Días estándar para pago: ${DIAS_ESTANDAR} días`);
      console.log(`📅 Días laborales: ${diasLaborales.join(', ')}`);

      // Mostrar festivos excluidos
      const festivosEnPeriodo = Object.values(festivosDelAnio).filter(f => {
        const [fAnio, fMes] = f.fecha.split('-').map(Number);
        return fAnio === anio && fMes === mes;
      });

      if (festivosEnPeriodo.length > 0) {
        console.log(`🎉 ${festivosEnPeriodo.length} día(s) festivo(s) excluido(s):`,
          festivosEnPeriodo.map(f => `${f.fecha} - ${f.nombre}`));
      }

      // 4. Procesar cada empleado
      const resultados = [];
      let totalRetardos = 0;
      let empleadosConDescuento = 0;

      for (const empleado of empleados) {
        try {
          // Obtener registros de asistencia
          const registros = await this.getAttendanceRecords(empleado.uid, mes, anio, periodo);

          // Obtener ausencias aprobadas
          const ausenciasEmpleado = await this.obtenerAusenciasDelPeriodo(empleado.email, mes, anio, periodo);

          const salarioBase = empleado.salarioQuincenal;
          // ✅ PAGO POR DÍA SIEMPRE FIJO dividido entre 10 (o 5 para semanal)
          const pagoPorDia = salarioBase / DIAS_ESTANDAR;

          // Contar retardos y días asistidos (DÍAS ÚNICOS, no registros)
          let retardos = 0;
          const diasAsistidosSet = new Set(); // Usar Set para días únicos
          const detalleRetardos = [];
          let retardosCorregidos = 0;

          // Agrupar registros por día para contar solo días únicos
          const registrosPorDia = {};
          registros.forEach(registro => {
            const [regAnio, regMes, regDia] = registro.fecha.split('-').map(Number);

            // ✅ SOLO agregar el día si está en la lista de días laborales del período
            if (diasLaborales.includes(regDia)) {
              diasAsistidosSet.add(regDia);

              // Agrupar por día para contar retardos (solo el primer registro del día cuenta)
              if (!registrosPorDia[regDia]) {
                registrosPorDia[regDia] = registro;

                // Solo contar retardos NO corregidos por ausencias (primer registro del día)
                if (registro.estado === 'retardo' && !registro.corregidoPorAusencia) {
                  retardos++;
                  detalleRetardos.push({
                    fecha: registro.fecha,
                    hora: registro.hora
                  });
                } else if (registro.estado === 'retardo' && registro.corregidoPorAusencia) {
                  retardosCorregidos++;
                }
              }
            }
          });

          // Convertir Set a array
          const diasAsistidos = Array.from(diasAsistidosSet);

          // Ya están filtrados en el forEach anterior, todos son válidos
          const diasTrabajadosEfectivos = diasAsistidos.length;

          // Calcular días justificados por ausencias
          let diasJustificadosTotal = 0;
          let diasJustificadosCompletos = 0;
          const justificacionesDetalle = [];

          ausenciasEmpleado.forEach(ausencia => {
            const dias = ausencia.diasJustificados || 0;
            if (dias > 0) {
              const mapeo = this.mapearTipoAusenciaANomina(ausencia.tipo);

              // Si es retardo justificado, NO cuenta para días trabajados
              if (ausencia.tipo !== 'retardo_justificado') {
                diasJustificadosTotal += dias;
                diasJustificadosCompletos += dias;
              }

              justificacionesDetalle.push({
                tipo: ausencia.tipo,
                dias: dias,
                motivo: ausencia.motivo,
                nombreTipo: mapeo ? mapeo.nombre : ausencia.tipo,
                fechaInicio: ausencia.fechaInicio,
                fechaFin: ausencia.fechaFin
              });

              console.log(`✅ ${empleado.nombre}: +${dias} días por ${mapeo?.nombre || ausencia.tipo}`);
            }
          });

          // ✅ CALCULAR FALTAS: Días REALES del período - días trabajados - días justificados completos
          const diasLaboralesRealesDelPeriodo = diasLaborales.length;
          const faltasSinJustificar = diasLaboralesRealesDelPeriodo - diasTrabajadosEfectivos - diasJustificadosCompletos;
          const cantidadFaltas = Math.max(0, faltasSinJustificar);
          const diasFaltantes = diasLaborales.filter(dia => !diasAsistidos.includes(dia));

          // Días trabajados mostrados = días efectivos + días justificados (LIMITADO a días reales del período)
          const diasTrabajadosMostrar = Math.min(diasLaboralesRealesDelPeriodo, diasTrabajadosEfectivos + diasJustificadosCompletos);

          // Debug para empleados con ausencias
          if (ausenciasEmpleado.length > 0) {
            console.log(`🔍 CÁLCULO ${empleado.nombre}:`, {
              diasLaboralesReales: diasLaboralesRealesDelPeriodo,
              diasTrabajadosReales: diasTrabajadosEfectivos,
              diasJustificadosCompletos: diasJustificadosCompletos,
              diasTrabajadosMostrar: diasTrabajadosMostrar,
              formula: `${diasLaboralesRealesDelPeriodo} - ${diasTrabajadosEfectivos} - ${diasJustificadosCompletos} = ${cantidadFaltas}`,
              faltasCalculadas: cantidadFaltas,
              ausencias: ausenciasEmpleado.length
            });
          }

          // Descuento por retardos (1 día al llegar a 4 retardos)
          const diasDescuentoPorRetardos = retardos >= 4 ? 1 : 0;

          // Días efectivos pagados = días trabajados - descuento por retardos
          const diasEfectivos = diasTrabajadosEfectivos - diasDescuentoPorRetardos;
          const diasTotalesAPagarSinLimite = diasEfectivos + diasJustificadosTotal;

          // ✅ LIMITAR A 10 DÍAS MÁXIMO (el estándar)
          const diasTotalesAPagar = Math.min(DIAS_ESTANDAR, diasTotalesAPagarSinLimite);

          // ✅ PAGO TOTAL usando pago por día fijo
          const pagoTotal = Math.max(0, diasTotalesAPagar * pagoPorDia);

          // Descuentos
          let descuentoIMSS = 0;
          let descuentoCaja = 0;

          if (empleado.tieneIMSS) {
            descuentoIMSS = tipoNomina === 'semanal' ? 150 : 300;
          }

          if (empleado.tieneCajaAhorro && empleado.montoCajaAhorro) {
            descuentoCaja = tipoNomina === 'semanal'
              ? Math.round(empleado.montoCajaAhorro / 2)
              : empleado.montoCajaAhorro;
          }

          const totalDescuentos = descuentoIMSS + descuentoCaja;
          const pagoFinal = Math.max(0, pagoTotal - totalDescuentos);

          if (diasDescuentoPorRetardos > 0 || totalDescuentos > 0) empleadosConDescuento++;
          totalRetardos += retardos;

          // Estado
          let status, statusClass;
          if (cantidadFaltas > 0) {
            status = `${cantidadFaltas} falta${cantidadFaltas > 1 ? 's' : ''} • ${retardos} retardo${retardos !== 1 ? 's' : ''}`;
            statusClass = 'status-penalty';
          } else if (diasDescuentoPorRetardos > 0) {
            status = `Descuento: ${diasDescuentoPorRetardos} día${diasDescuentoPorRetardos > 1 ? 's' : ''}`;
            statusClass = 'status-penalty';
          } else if (retardos >= 3) {
            status = 'En límite de retardos';
            statusClass = 'status-warning';
          } else {
            status = 'Sin penalizaciones';
            statusClass = 'status-ok';
          }

          const resultado = {
            empleado: {
              uid: empleado.uid,
              nombre: empleado.nombre,
              email: empleado.email,
              tipo: empleado.tipo,
              tipoNomina: empleado.tipoNomina,
              cuentaBancaria: empleado.cuentaBancaria,
              nombreBanco: empleado.nombreBanco
            },
            salarioQuincenal: salarioBase,
            tipoNominaEmpleado: empleado.tipoNomina,
            diasLaboralesEsperados: DIAS_ESTANDAR,
            diasLaboralesReales: diasLaborales.length,
            diasTrabajados: diasTrabajadosMostrar,
            diasTrabajadosReales: diasTrabajadosEfectivos,
            diasFaltantes: cantidadFaltas,
            retardos,
            retardosCorregidos,
            diasDescuento: diasDescuentoPorRetardos,
            diasEfectivos,
            diasJustificados: diasJustificadosTotal,
            justificacionesDetalle,
            tieneAusencias: ausenciasEmpleado.length > 0,
            tieneCorrecciones: retardosCorregidos > 0,
            pagoPorDia: Math.round(pagoPorDia),
            pagoTotal: Math.round(pagoTotal),
            descuentoIMSS,
            descuentoCaja,
            totalDescuentos,
            pagoFinal: Math.round(pagoFinal),
            status,
            statusClass,
            detalleRetardos,
            diasAsistidos,
            diasFaltantesDetalle: diasFaltantes
          };

          resultados.push(resultado);
        } catch (error) {
          console.error(`Error procesando empleado ${empleado.nombre}:`, error);
        }
      }

      // 5. Resumen
      const totalNominaFinal = resultados.reduce((sum, r) => sum + r.pagoFinal, 0);

      return {
        success: true,
        data: {
          periodo: {
            mes,
            anio,
            periodo,
            tipoNomina,
            diasLaborales: diasLaborales.length,
            diasEstandar: DIAS_ESTANDAR,
            festivosExcluidos: festivosEnPeriodo.map(f => ({
              fecha: f.fecha,
              nombre: f.nombre
            }))
          },
          resumen: {
            totalEmpleados: empleados.length,
            totalRetardos,
            empleadosConDescuento,
            totalNominaFinal: Math.round(totalNominaFinal)
          },
          empleados: resultados,
          calculadoEn: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error calculando nómina:', error);
      throw error;
    }
  }

  /**
   * Guardar nómina
   */
  static async savePayroll({ mes, anio, periodo, tipoNomina, resultados, resumen, userId }) {
    try {
      const db = getFirestore();
      const periodoId = `${anio}-${String(mes).padStart(2, '0')}-${periodo}-${tipoNomina}`;

      const nominaData = {
        id: periodoId,
        periodo: { mes, anio, periodo, tipoNomina },
        resumen,
        empleados: resultados,
        calculadoPor: userId,
        calculadoEn: new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString()
      };

      await db.collection('nominas').doc(periodoId).set(nominaData);

      return {
        success: true,
        message: 'Nómina guardada exitosamente',
        data: { id: periodoId }
      };
    } catch (error) {
      console.error('❌ Error guardando nómina:', error);
      throw error;
    }
  }

  /**
   * Obtener nómina guardada
   */
  static async getPayroll(periodoId) {
    try {
      const db = getFirestore();
      const nominaDoc = await db.collection('nominas').doc(periodoId).get();

      if (!nominaDoc.exists) {
        throw new Error('Nómina no encontrada');
      }

      return {
        success: true,
        data: nominaDoc.data()
      };
    } catch (error) {
      console.error('❌ Error obteniendo nómina:', error);
      throw error;
    }
  }

  /**
   * Obtener nóminas por período
   */
  static async getPayrollsByPeriod({ mes, anio, tipoNomina }) {
    try {
      const db = getFirestore();
      let query = db.collection('nominas')
        .where('periodo.mes', '==', mes)
        .where('periodo.anio', '==', anio);

      if (tipoNomina) {
        query = query.where('periodo.tipoNomina', '==', tipoNomina);
      }

      const nominasSnapshot = await query.get();
      const nominas = [];

      nominasSnapshot.forEach(doc => {
        nominas.push({ id: doc.id, ...doc.data() });
      });

      return {
        success: true,
        count: nominas.length,
        data: nominas
      };
    } catch (error) {
      console.error('❌ Error obteniendo nóminas:', error);
      throw error;
    }
  }

  /**
   * Obtener semanas del mes
   */
  static getWeeksOfMonth(anio, mes) {
    const semanas = [];
    const ultimoDia = new Date(anio, mes, 0).getDate();

    let semanaNumero = 1;
    let inicioSemana = 1;

    while (inicioSemana <= ultimoDia) {
      let finSemana = inicioSemana;
      let diasLaborales = 0;

      // Contar hasta 5 días laborales o fin de mes
      while (diasLaborales < 5 && finSemana <= ultimoDia) {
        const fecha = new Date(anio, mes - 1, finSemana);
        if (!isWeekend(fecha)) {
          diasLaborales++;
        }
        if (diasLaborales < 5) {
          finSemana++;
        }
      }

      semanas.push({
        numero: semanaNumero,
        inicio: inicioSemana,
        fin: Math.min(finSemana, ultimoDia),
        label: `Semana ${semanaNumero} (${inicioSemana}-${Math.min(finSemana, ultimoDia)})`
      });

      inicioSemana = finSemana + 1;
      semanaNumero++;
    }

    return semanas;
  }

  /**
   * Actualizar concepto manual
   */
  static async updateManualConcept({ periodoId, empleadoId, concepto, valor, userId }) {
    try {
      const db = getFirestore();
      const nominaRef = db.collection('nominas').doc(periodoId);
      const nominaDoc = await nominaRef.get();

      if (!nominaDoc.exists) {
        throw new Error('Nómina no encontrada');
      }

      const nominaData = nominaDoc.data();
      const empleadoIndex = nominaData.empleados.findIndex(e => e.empleado.uid === empleadoId);

      if (empleadoIndex === -1) {
        throw new Error('Empleado no encontrado en la nómina');
      }

      // Actualizar concepto
      if (!nominaData.empleados[empleadoIndex].conceptosManuales) {
        nominaData.empleados[empleadoIndex].conceptosManuales = {};
      }

      nominaData.empleados[empleadoIndex].conceptosManuales[concepto] = {
        valor,
        actualizadoPor: userId,
        actualizadoEn: new Date().toISOString()
      };

      // Recalcular pago final
      const empleado = nominaData.empleados[empleadoIndex];
      let ajusteTotal = 0;

      Object.values(empleado.conceptosManuales || {}).forEach(c => {
        ajusteTotal += c.valor;
      });

      empleado.pagoFinalAjustado = empleado.pagoFinal + ajusteTotal;

      // Guardar
      await nominaRef.update({
        empleados: nominaData.empleados,
        ultimaActualizacion: new Date().toISOString(),
        ultimaEdicionPor: userId
      });

      return {
        success: true,
        message: 'Concepto actualizado exitosamente',
        data: empleado
      };
    } catch (error) {
      console.error('❌ Error actualizando concepto:', error);
      throw error;
    }
  }
  /**
   * Calcular proyección de nómina para un solo empleado (periodo actual o especificado)
   * No requiere que la nómina esté guardada - calcula en tiempo real
   */
  static async calculateEmployeeProjection(empleadoUid, { mes, anio, periodo, tipoNomina } = {}) {
    try {
      const db = getFirestore();

      // Si no se especifica, usar periodo actual
      const hoy = new Date();
      if (!anio) anio = hoy.getFullYear();
      if (!mes) mes = hoy.getMonth() + 1;
      if (!periodo) periodo = hoy.getDate() <= 15 ? 'primera' : 'segunda';

      // Obtener datos del empleado
      const userDoc = await db.collection('usuarios').doc(empleadoUid).get();
      if (!userDoc.exists) {
        throw new Error('Empleado no encontrado');
      }

      const userData = userDoc.data();
      if (!userData.salarioQuincenal || !userData.horasQuincenal) {
        return {
          success: true,
          data: null,
          message: 'Empleado sin configuración de nómina'
        };
      }

      // Determinar tipo de nomina del empleado
      if (!tipoNomina) tipoNomina = userData.tipoNomina || 'quincenal';
      const DIAS_ESTANDAR = tipoNomina === 'semanal' ? 5 : 10;

      const empleado = this.formatEmployeeData(empleadoUid, userData);

      // Cargar dias festivos
      const festivosDelAnio = await this.cargarDiasFestivos(anio);

      // Calcular dias laborales del periodo
      const diasLaborales = this.calcularDiasLaborales(anio, mes, periodo, festivosDelAnio);

      // Obtener registros de asistencia
      const registros = await this.getAttendanceRecords(empleadoUid, mes, anio, periodo);

      // Obtener ausencias aprobadas
      const ausenciasEmpleado = await this.obtenerAusenciasDelPeriodo(empleado.email, mes, anio, periodo);

      const salarioBase = empleado.salarioQuincenal;
      const pagoPorDia = salarioBase / DIAS_ESTANDAR;

      // Contar retardos y dias asistidos
      let retardos = 0;
      const diasAsistidosSet = new Set();
      const detalleRetardos = [];

      const registrosPorDia = {};
      registros.forEach(registro => {
        const [, , regDia] = registro.fecha.split('-').map(Number);
        if (diasLaborales.includes(regDia)) {
          diasAsistidosSet.add(regDia);
          if (!registrosPorDia[regDia]) {
            registrosPorDia[regDia] = registro;
            if (registro.estado === 'retardo' && !registro.corregidoPorAusencia) {
              retardos++;
              detalleRetardos.push({ fecha: registro.fecha, hora: registro.hora });
            }
          }
        }
      });

      const diasAsistidos = Array.from(diasAsistidosSet);
      const diasTrabajadosEfectivos = diasAsistidos.length;

      // Dias justificados
      let diasJustificadosTotal = 0;
      let diasJustificadosCompletos = 0;
      const justificacionesDetalle = [];

      ausenciasEmpleado.forEach(ausencia => {
        const dias = ausencia.diasJustificados || 0;
        if (dias > 0) {
          const mapeo = this.mapearTipoAusenciaANomina(ausencia.tipo);
          if (ausencia.tipo !== 'retardo_justificado') {
            diasJustificadosTotal += dias;
            diasJustificadosCompletos += dias;
          }
          justificacionesDetalle.push({
            tipo: ausencia.tipo,
            dias,
            motivo: ausencia.motivo,
            nombreTipo: mapeo ? mapeo.nombre : ausencia.tipo,
            fechaInicio: ausencia.fechaInicio,
            fechaFin: ausencia.fechaFin
          });
        }
      });

      const diasLaboralesRealesDelPeriodo = diasLaborales.length;
      const faltasSinJustificar = diasLaboralesRealesDelPeriodo - diasTrabajadosEfectivos - diasJustificadosCompletos;
      const cantidadFaltas = Math.max(0, faltasSinJustificar);
      const diasTrabajadosMostrar = Math.min(diasLaboralesRealesDelPeriodo, diasTrabajadosEfectivos + diasJustificadosCompletos);

      // Descuento por retardos
      const diasDescuentoPorRetardos = retardos >= 4 ? 1 : 0;
      const diasEfectivos = diasTrabajadosEfectivos - diasDescuentoPorRetardos;
      const diasTotalesAPagar = Math.min(DIAS_ESTANDAR, diasEfectivos + diasJustificadosTotal);
      const pagoTotal = Math.max(0, diasTotalesAPagar * pagoPorDia);

      // Descuentos
      let descuentoIMSS = 0;
      let descuentoCaja = 0;
      if (empleado.tieneIMSS) descuentoIMSS = tipoNomina === 'semanal' ? 150 : 300;
      if (empleado.tieneCajaAhorro && empleado.montoCajaAhorro) {
        descuentoCaja = tipoNomina === 'semanal' ? Math.round(empleado.montoCajaAhorro / 2) : empleado.montoCajaAhorro;
      }

      const totalDescuentos = descuentoIMSS + descuentoCaja;
      const pagoFinal = Math.max(0, pagoTotal - totalDescuentos);

      // Calcular progreso del periodo (dias transcurridos vs dias totales)
      const diasTranscurridos = diasLaborales.filter(dia => {
        const fecha = new Date(anio, mes - 1, dia);
        return fecha <= hoy;
      }).length;
      const progresoPeriodo = diasLaboralesRealesDelPeriodo > 0
        ? Math.round((diasTranscurridos / diasLaboralesRealesDelPeriodo) * 100)
        : 0;

      // Proyeccion: si el periodo no ha terminado, estimar pago completo
      const diasRestantes = diasLaboralesRealesDelPeriodo - diasTranscurridos;
      const pagoProyectado = diasRestantes > 0
        ? Math.round(Math.max(0, Math.min(DIAS_ESTANDAR, diasEfectivos + diasRestantes + diasJustificadosTotal) * pagoPorDia - totalDescuentos))
        : pagoFinal;

      return {
        success: true,
        data: {
          empleado: {
            uid: empleadoUid,
            nombre: empleado.nombre,
            email: empleado.email,
            tipo: empleado.tipo,
            tipoNomina: empleado.tipoNomina,
            cuentaBancaria: empleado.cuentaBancaria,
            nombreBanco: empleado.nombreBanco
          },
          periodo: { mes, anio, periodo, tipoNomina },
          salarioQuincenal: salarioBase,
          pagoPorDia: Math.round(pagoPorDia),
          diasLaboralesEsperados: DIAS_ESTANDAR,
          diasLaboralesReales: diasLaboralesRealesDelPeriodo,
          diasTrabajados: diasTrabajadosMostrar,
          diasTrabajadosReales: diasTrabajadosEfectivos,
          diasFaltantes: cantidadFaltas,
          retardos,
          diasDescuento: diasDescuentoPorRetardos,
          diasEfectivos,
          diasJustificados: diasJustificadosTotal,
          justificacionesDetalle,
          pagoTotal: Math.round(pagoTotal),
          descuentoIMSS,
          descuentoCaja,
          totalDescuentos,
          pagoFinal: Math.round(pagoFinal),
          detalleRetardos,
          // Datos de proyeccion
          esProyeccion: true,
          progresoPeriodo,
          diasTranscurridos,
          diasRestantes,
          pagoProyectado: Math.round(pagoProyectado),
          calculadoEn: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error calculando proyección de empleado:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de nóminas de un empleado específico
   * Busca en todas las nóminas guardadas y filtra por el uid del empleado
   */
  static async getEmployeePayrollHistory(empleadoUid, { anio, mes } = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('nominas');

      if (anio) {
        query = query.where('periodo.anio', '==', parseInt(anio));
      }
      if (mes) {
        query = query.where('periodo.mes', '==', parseInt(mes));
      }

      const nominasSnapshot = await query.get();
      const historial = [];

      nominasSnapshot.forEach(doc => {
        const nominaData = doc.data();
        const empleados = nominaData.empleados || [];

        const miNomina = empleados.find(e => e.empleado?.uid === empleadoUid);
        if (miNomina) {
          historial.push({
            periodoId: doc.id,
            periodo: nominaData.periodo,
            calculadoEn: nominaData.calculadoEn,
            datos: miNomina
          });
        }
      });

      // Ordenar por fecha más reciente
      historial.sort((a, b) => {
        const fechaA = `${a.periodo.anio}-${String(a.periodo.mes).padStart(2, '0')}-${a.periodo.periodo}`;
        const fechaB = `${b.periodo.anio}-${String(b.periodo.mes).padStart(2, '0')}-${b.periodo.periodo}`;
        return fechaB.localeCompare(fechaA);
      });

      return {
        success: true,
        count: historial.length,
        data: historial
      };
    } catch (error) {
      console.error('❌ Error obteniendo historial de nóminas del empleado:', error);
      throw error;
    }
  }
}

export default PayrollService;
