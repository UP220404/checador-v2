/**
 * Servicio para gestión de ausencias (permisos, vacaciones, incapacidades, etc.)
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, CONFIG, ROLES } from '../config/constants.js';
import { obtenerQuincena } from '../utils/dateUtils.js';
import NotificationService from './NotificationService.js';
import UserService from './UserService.js';

// Tipos de ausencia que requieren anticipación de 15 días
const TIPOS_REQUIEREN_ANTICIPACION = ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce'];
const DIAS_ANTICIPACION_REQUERIDOS = 15;

class AbsenceService {
  constructor() {
    this.absencesCollection = COLLECTIONS.AUSENCIAS;
    this.attendanceCollection = COLLECTIONS.REGISTROS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Valida la regla de anticipación de 15 días
   * @param {string} fechaInicio - Fecha de inicio de la ausencia (YYYY-MM-DD)
   * @param {string} tipo - Tipo de ausencia
   * @param {boolean} esEmergencia - Si es una emergencia
   * @param {string} motivoEmergencia - Motivo de la emergencia (requerido si esEmergencia=true)
   * @returns {Object} - { valido, diasAnticipacion, requiereRevisionUrgente, mensaje }
   */
  validateAdvanceNotice(fechaInicio, tipo, esEmergencia = false, motivoEmergencia = '') {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaSolicitud = new Date(fechaInicio + 'T00:00:00');
    const diffTime = fechaSolicitud - hoy;
    const diasAnticipacion = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Si el tipo no requiere anticipación, siempre es válido
    if (!TIPOS_REQUIEREN_ANTICIPACION.includes(tipo)) {
      return {
        valido: true,
        diasAnticipacion,
        requiereRevisionUrgente: false,
        mensaje: null
      };
    }

    // Si cumple con los 15 días de anticipación
    if (diasAnticipacion >= DIAS_ANTICIPACION_REQUERIDOS) {
      return {
        valido: true,
        diasAnticipacion,
        requiereRevisionUrgente: false,
        mensaje: null
      };
    }

    // No cumple con los 15 días - verificar si es emergencia
    if (esEmergencia) {
      // Emergencia requiere motivo
      if (!motivoEmergencia || motivoEmergencia.trim().length < 10) {
        return {
          valido: false,
          diasAnticipacion,
          requiereRevisionUrgente: true,
          mensaje: 'Para solicitudes de emergencia debe proporcionar un motivo detallado (mínimo 10 caracteres)'
        };
      }

      return {
        valido: true,
        diasAnticipacion,
        requiereRevisionUrgente: true,
        mensaje: null
      };
    }

    // No cumple con anticipación y no es emergencia - rechazar
    return {
      valido: false,
      diasAnticipacion,
      requiereRevisionUrgente: true,
      mensaje: `Las solicitudes de ${this.formatTipoAusencia(tipo)} requieren al menos ${DIAS_ANTICIPACION_REQUERIDOS} días de anticipación. Tienes ${diasAnticipacion} día(s). Si es una emergencia, marca la opción correspondiente y proporciona el motivo.`
    };
  }

  /**
   * Crear una nueva ausencia
   */
  async createAbsence(absenceData) {
    try {
      // Validar campos requeridos
      if (!absenceData.emailUsuario || !absenceData.tipo || !absenceData.fechaInicio || !absenceData.motivo) {
        throw new Error('Campos obligatorios faltantes');
      }

      // Validar tipo de ausencia
      const tiposValidos = [
        'permiso_con_goce',
        'permiso_sin_goce',
        'vacaciones',
        'incapacidad',
        'retardo_justificado',
        'falta_justificada'
      ];

      if (!tiposValidos.includes(absenceData.tipo)) {
        throw new Error(`Tipo de ausencia inválido: ${absenceData.tipo}`);
      }

      // Validar regla de 15 días de anticipación (solo para solicitudes de empleados, no admin)
      const esEmergencia = absenceData.esEmergencia || false;
      const motivoEmergencia = absenceData.motivoEmergencia || '';

      // Solo validar anticipación si no es creada por admin
      if (!absenceData.creadaPorAdmin) {
        const validacionAnticipacion = this.validateAdvanceNotice(
          absenceData.fechaInicio,
          absenceData.tipo,
          esEmergencia,
          motivoEmergencia
        );

        if (!validacionAnticipacion.valido) {
          throw new Error(validacionAnticipacion.mensaje);
        }
      }

      // Calcular días de anticipación
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaSolicitud = new Date(absenceData.fechaInicio + 'T00:00:00');
      const diasAnticipacion = Math.ceil((fechaSolicitud - hoy) / (1000 * 60 * 60 * 24));

      // Calcular quincena automáticamente
      const quincenaInfo = this.calcularQuincenaDeAusencia(absenceData.fechaInicio);

      // Calcular días justificados
      const diasJustificados = this.calcularDiasJustificados(
        absenceData.fechaInicio,
        absenceData.fechaFin || absenceData.fechaInicio,
        absenceData.tipo
      );

      // Determinar si requiere revisión urgente
      const requiereRevisionUrgente = esEmergencia ||
        (TIPOS_REQUIEREN_ANTICIPACION.includes(absenceData.tipo) && diasAnticipacion < DIAS_ANTICIPACION_REQUERIDOS);

      // Preparar datos de ausencia
      const nuevaAusencia = {
        emailUsuario: absenceData.emailUsuario,
        nombreUsuario: absenceData.nombreUsuario || '',
        departamentoUsuario: absenceData.departamentoUsuario || '', // Para filtrado por admin_area
        tipo: absenceData.tipo,
        fechaInicio: absenceData.fechaInicio, // String YYYY-MM-DD
        fechaFin: absenceData.fechaFin || absenceData.fechaInicio, // String YYYY-MM-DD
        motivo: absenceData.motivo,
        estado: absenceData.estado || 'pendiente', // pendiente, aprobado, rechazado
        comentariosAdmin: absenceData.comentariosAdmin || '',
        fechaCreacion: new Date(),

        // Nuevos campos para control de anticipación
        esEmergencia: esEmergencia,
        motivoEmergencia: esEmergencia ? motivoEmergencia : '',
        diasAnticipacion: diasAnticipacion,
        requiereRevisionUrgente: requiereRevisionUrgente,

        // Datos para nomina
        quincena: quincenaInfo,
        diasJustificados: diasJustificados,
        aplicadaEnNomina: false,
        nominaReferencia: null
      };

      // Si es retardo justificado, incluir datos de corrección de hora
      if (absenceData.tipo === 'retardo_justificado' && absenceData.correccionHora) {
        nuevaAusencia.correccionHora = {
          horaCorregida: absenceData.correccionHora.horaCorregida,
          fechaEntrada: absenceData.correccionHora.fechaEntrada,
          registroId: absenceData.correccionHora.registroId,
          aplicada: false
        };
      }

      // Guardar en Firestore
      const docRef = await this.db.collection(this.absencesCollection).add(nuevaAusencia);

      // Notificar (fire-and-forget) al empleado y a los admins
      this._notificarNuevaSolicitud(
        docRef.id,
        absenceData,
        nuevaAusencia
      ).catch(e => console.error('Error enviando notificaciones de nueva ausencia:', e));

      return {
        id: docRef.id,
        ...nuevaAusencia
      };
    } catch (error) {
      console.error('Error creando ausencia:', error);
      throw error;
    }
  }

  /**
   * Envía notificaciones cuando se crea una nueva solicitud de ausencia.
   * - Confirmación al empleado
   * - Alerta a todos los admin_rh
   * - Alerta al admin_area del departamento del empleado (si aplica)
   */
  async _notificarNuevaSolicitud(ausenciaId, absenceData, nuevaAusencia) {
    try {
      const tipoLabel = this.formatTipoAusencia(nuevaAusencia.tipo);
      const fechaInicio = nuevaAusencia.fechaInicio;
      const fechaFin = nuevaAusencia.fechaFin !== fechaInicio
        ? `${fechaInicio} al ${nuevaAusencia.fechaFin}`
        : fechaInicio;
      const nombreEmpleado = nuevaAusencia.nombreUsuario || nuevaAusencia.emailUsuario;
      const departamento = nuevaAusencia.departamentoUsuario || '';
      const esUrgente = nuevaAusencia.requiereRevisionUrgente || false;

      // 1. Confirmación al empleado (si tenemos su UID)
      if (absenceData.uid) {
        NotificationService.notifySolicitudAusenciaConfirmacion(
          absenceData.uid,
          nuevaAusencia.emailUsuario,
          tipoLabel,
          nuevaAusencia.fechaInicio !== nuevaAusencia.fechaFin
            ? `${fechaInicio} al ${nuevaAusencia.fechaFin}`
            : fechaInicio
        ).catch(e => console.error('Error notificando confirmación al empleado:', e));
      }

      // 2. Notificar a todos los admin_rh y al admin_area del departamento
      // Se obtienen todos y se filtra en memoria para evitar problemas con índices de Firestore
      const adminSnapshot = await this.db
        .collection(COLLECTIONS.USUARIOS)
        .get();

      const admins = [];
      adminSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.activo === false) return; // Saltar inactivos
        if (
          data.role === ROLES.ADMIN_RH ||
          (data.role === ROLES.ADMIN_AREA && departamento && data.departamento === departamento)
        ) {
          admins.push({ uid: doc.id, ...data });
        }
      });

      for (const admin of admins) {
        NotificationService.notifyNuevaSolicitudAusencia(
          admin.uid,
          admin.correo || admin.email || '',
          nombreEmpleado,
          tipoLabel,
          fechaFin,
          esUrgente
        ).catch(e => console.error(`Error notificando a admin ${admin.uid}:`, e));
      }
    } catch (error) {
      console.error('Error en _notificarNuevaSolicitud:', error);
    }
  }

  /**
   * Obtener ausencias con filtros opcionales
   * @param {Object} filters - Filtros para la consulta
   * @param {string} departmentFilter - Filtrar por departamento (para admin_area)
   * Nota: Usamos una consulta simple y filtramos en memoria para evitar índices compuestos
   */
  async getAbsences(filters = {}, departmentFilter = null) {
    try {
      let query = this.db.collection(this.absencesCollection);

      // Solo aplicar UN filtro en Firestore para evitar índices compuestos
      // Priorizamos el filtro más selectivo
      if (filters.emailUsuario) {
        query = query.where('emailUsuario', '==', filters.emailUsuario);
      }
      // Si no hay filtro de email, obtenemos todo y filtramos en memoria

      // Ejecutar query
      const snapshot = await query.get();

      let ausencias = [];
      snapshot.forEach(doc => {
        ausencias.push({
          id: doc.id,
          ...doc.data(),
          // Convertir Timestamp a Date
          fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion
        });
      });

      // Aplicar TODOS los filtros en memoria para evitar índices compuestos

      // Filtro por estado
      if (filters.estado) {
        ausencias = ausencias.filter(a => a.estado === filters.estado);
      }

      // Filtro por tipo
      if (filters.tipo) {
        ausencias = ausencias.filter(a => a.tipo === filters.tipo);
      }

      // Filtrar por departamento si se especifica (para admin_area)
      if (departmentFilter) {
        ausencias = ausencias.filter(a => a.departamentoUsuario === departmentFilter);
      }

      // Filtrar por mes usando fechaInicio
      // Regla: mostrar si fechaInicio coincide con el mes seleccionado
      //        O si fechaInicio >= hoy (ausencia futura, sin importar estado)
      // Esto evita que una ausencia desaparezca al ser aprobada/rechazada
      // cuando su fecha es de un mes distinto al que se está viendo.
      if (filters.mes && filters.anio) {
        const mes = parseInt(filters.mes);
        const anio = parseInt(filters.anio);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        ausencias = ausencias.filter(a => {
          const fechaStr = a.fechaInicio || '';
          const [fAnio, fMes] = fechaStr.split('-').map(Number);

          // Siempre mostrar si coincide con el mes seleccionado
          if (fAnio === anio && fMes === mes) return true;

          // También mostrar si la fecha de inicio aún no ha pasado (futura)
          const fechaInicioDt = new Date(fechaStr + 'T00:00:00');
          return fechaInicioDt >= hoy;
        });
      }

      if (filters.periodo && filters.mes && filters.anio) {
        const periodo = filters.periodo;
        const mes = parseInt(filters.mes);
        const anio = parseInt(filters.anio);
        ausencias = ausencias.filter(a =>
          a.quincena?.periodo === periodo &&
          a.quincena?.mes === mes &&
          a.quincena?.anio === anio
        );
      }

      // Ordenar por fecha de creación descendente en memoria
      ausencias.sort((a, b) => {
        const fechaA = a.fechaCreacion instanceof Date ? a.fechaCreacion : new Date(a.fechaCreacion);
        const fechaB = b.fechaCreacion instanceof Date ? b.fechaCreacion : new Date(b.fechaCreacion);
        return fechaB - fechaA;
      });

      return ausencias;
    } catch (error) {
      console.error('Error obteniendo ausencias:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes urgentes (emergencias o sin anticipación suficiente)
   * @param {string} departmentFilter - Filtrar por departamento (para admin_area)
   */
  async getUrgentRequests(departmentFilter = null) {
    try {
      // Obtener todas las ausencias pendientes
      const ausencias = await this.getAbsences({ estado: 'pendiente' }, departmentFilter);

      // Filtrar solo las urgentes
      const urgentes = ausencias.filter(a =>
        a.requiereRevisionUrgente === true ||
        a.esEmergencia === true
      );

      // Ordenar por días de anticipación (menor primero = más urgente)
      urgentes.sort((a, b) => (a.diasAnticipacion || 0) - (b.diasAnticipacion || 0));

      return urgentes;
    } catch (error) {
      console.error('Error obteniendo solicitudes urgentes:', error);
      throw error;
    }
  }

  /**
   * Obtener una ausencia por ID
   */
  async getAbsenceById(absenceId) {
    try {
      const doc = await this.db.collection(this.absencesCollection).doc(absenceId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
        fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion
      };
    } catch (error) {
      console.error('Error obteniendo ausencia:', error);
      throw error;
    }
  }

  /**
   * Actualizar ausencia
   */
  async updateAbsence(absenceId, updateData) {
    try {
      const ausencia = await this.getAbsenceById(absenceId);
      if (!ausencia) {
        throw new Error('Ausencia no encontrada');
      }

      // Recalcular días justificados si cambian las fechas o el tipo
      if (updateData.fechaInicio || updateData.fechaFin || updateData.tipo) {
        const fechaInicio = updateData.fechaInicio || ausencia.fechaInicio;
        const fechaFin = updateData.fechaFin || ausencia.fechaFin;
        const tipo = updateData.tipo || ausencia.tipo;

        updateData.diasJustificados = this.calcularDiasJustificados(fechaInicio, fechaFin, tipo);
      }

      // Recalcular quincena si cambia la fecha de inicio
      if (updateData.fechaInicio) {
        updateData.quincena = this.calcularQuincenaDeAusencia(updateData.fechaInicio);
      }

      // Actualizar en Firestore
      await this.db.collection(this.absencesCollection).doc(absenceId).update(updateData);

      // Obtener ausencia actualizada
      return await this.getAbsenceById(absenceId);
    } catch (error) {
      console.error('Error actualizando ausencia:', error);
      throw error;
    }
  }

  /**
   * Eliminar ausencia
   */
  async deleteAbsence(absenceId) {
    try {
      const ausencia = await this.getAbsenceById(absenceId);
      if (!ausencia) {
        throw new Error('Ausencia no encontrada');
      }

      // Si la ausencia fue aplicada a un registro (retardo justificado), revertir
      if (ausencia.tipo === 'retardo_justificado' && ausencia.correccionHora?.aplicada) {
        await this.revertirCorreccionHora(ausencia);
      }

      await this.db.collection(this.absencesCollection).doc(absenceId).delete();

      return { success: true, mensaje: 'Ausencia eliminada correctamente' };
    } catch (error) {
      console.error('Error eliminando ausencia:', error);
      throw error;
    }
  }

  /**
   * Aprobar ausencia
   */
  async approveAbsence(absenceId, adminEmail) {
    try {
      const ausencia = await this.getAbsenceById(absenceId);
      if (!ausencia) {
        throw new Error('Ausencia no encontrada');
      }

      // Actualizar estado
      const updateData = {
        estado: 'aprobado',
        aprobadoPor: adminEmail,
        fechaAprobacion: new Date()
      };

      await this.db.collection(this.absencesCollection).doc(absenceId).update(updateData);

      // Si es retardo justificado, aplicar corrección de hora
      if (ausencia.tipo === 'retardo_justificado' && ausencia.correccionHora && !ausencia.correccionHora.aplicada) {
        await this.aplicarCorreccionHora(ausencia);
      }

      // Enviar notificación al empleado
      try {
        const user = await UserService.getUserByEmail(ausencia.emailUsuario);
        if (user && user.uid) {
          const fechas = ausencia.fechaFin && ausencia.fechaFin !== ausencia.fechaInicio
            ? `${ausencia.fechaInicio} al ${ausencia.fechaFin}`
            : ausencia.fechaInicio;

          await NotificationService.notifyPermisoAprobado(
            user.uid,
            ausencia.emailUsuario,
            this.formatTipoAusencia(ausencia.tipo),
            fechas
          );
        }
      } catch (notifError) {
        console.error('Error enviando notificación de aprobación:', notifError);
        // No lanzar error para no interrumpir el flujo de aprobación
      }

      return await this.getAbsenceById(absenceId);
    } catch (error) {
      console.error('Error aprobando ausencia:', error);
      throw error;
    }
  }

  /**
   * Rechazar ausencia
   */
  async rejectAbsence(absenceId, adminEmail, comentarios = '') {
    try {
      const ausencia = await this.getAbsenceById(absenceId);
      if (!ausencia) {
        throw new Error('Ausencia no encontrada');
      }

      const updateData = {
        estado: 'rechazado',
        rechazadoPor: adminEmail,
        fechaRechazo: new Date(),
        comentariosAdmin: comentarios
      };

      await this.db.collection(this.absencesCollection).doc(absenceId).update(updateData);

      // Enviar notificación al empleado
      try {
        const user = await UserService.getUserByEmail(ausencia.emailUsuario);
        if (user && user.uid) {
          await NotificationService.notifyPermisoRechazado(
            user.uid,
            ausencia.emailUsuario,
            this.formatTipoAusencia(ausencia.tipo),
            comentarios
          );
        }
      } catch (notifError) {
        console.error('Error enviando notificación de rechazo:', notifError);
        // No lanzar error para no interrumpir el flujo de rechazo
      }

      return await this.getAbsenceById(absenceId);
    } catch (error) {
      console.error('Error rechazando ausencia:', error);
      throw error;
    }
  }

  /**
   * Formatea el tipo de ausencia para mostrar en notificaciones
   */
  formatTipoAusencia(tipo) {
    const tipos = {
      'permiso_con_goce': 'Permiso con Goce de Sueldo',
      'permiso_sin_goce': 'Permiso sin Goce de Sueldo',
      'vacaciones': 'Vacaciones',
      'incapacidad': 'Incapacidad',
      'retardo_justificado': 'Retardo Justificado',
      'falta_justificada': 'Falta Justificada'
    };
    return tipos[tipo] || tipo;
  }

  /**
   * Aplicar corrección de hora en registro de asistencia (para retardos justificados)
   */
  async aplicarCorreccionHora(ausencia) {
    try {
      if (!ausencia.correccionHora || !ausencia.correccionHora.registroId) {
        throw new Error('No hay información de corrección de hora');
      }

      const registroId = ausencia.correccionHora.registroId;
      const horaCorregida = ausencia.correccionHora.horaCorregida;

      // Actualizar el registro de asistencia
      await this.db.collection(this.attendanceCollection).doc(registroId).update({
        horaOriginal: ausencia.correccionHora.horaOriginal || null,
        hora: horaCorregida,
        estado: 'puntual',
        corregidoPorAusencia: true,
        ausenciaRef: ausencia.id
      });

      // Marcar corrección como aplicada
      await this.db.collection(this.absencesCollection).doc(ausencia.id).update({
        'correccionHora.aplicada': true
      });

      return { success: true, mensaje: 'Corrección de hora aplicada' };
    } catch (error) {
      console.error('Error aplicando corrección de hora:', error);
      throw error;
    }
  }

  /**
   * Revertir corrección de hora
   */
  async revertirCorreccionHora(ausencia) {
    try {
      if (!ausencia.correccionHora || !ausencia.correccionHora.registroId) {
        throw new Error('No hay información de corrección de hora');
      }

      const registroId = ausencia.correccionHora.registroId;

      // Obtener registro original
      const registroDoc = await this.db.collection(this.attendanceCollection).doc(registroId).get();
      if (!registroDoc.exists) {
        throw new Error('Registro no encontrado');
      }

      const registro = registroDoc.data();

      // Restaurar hora original
      const updateData = {
        hora: registro.horaOriginal || registro.hora,
        estado: 'retardo',
        corregidoPorAusencia: false,
        ausenciaRef: null
      };

      // Eliminar horaOriginal si existe
      if (registro.horaOriginal) {
        updateData.horaOriginal = null;
      }

      await this.db.collection(this.attendanceCollection).doc(registroId).update(updateData);

      // Marcar corrección como no aplicada
      await this.db.collection(this.absencesCollection).doc(ausencia.id).update({
        'correccionHora.aplicada': false
      });

      return { success: true, mensaje: 'Corrección de hora revertida' };
    } catch (error) {
      console.error('Error revirtiendo corrección de hora:', error);
      throw error;
    }
  }

  /**
   * Calcular quincena de una ausencia
   */
  calcularQuincenaDeAusencia(fechaString) {
    const fecha = new Date(fechaString + 'T00:00:00');
    const mes = fecha.getMonth() + 1; // 1-12
    const anio = fecha.getFullYear();
    const dia = fecha.getDate();

    const periodo = dia <= 15 ? 'primera' : 'segunda';

    return {
      mes: mes,
      anio: anio,
      periodo: periodo,
      periodoNumero: dia <= 15 ? 1 : 2
    };
  }

  /**
   * Calcular días justificados según tipo de ausencia
   */
  calcularDiasJustificados(fechaInicio, fechaFin, tipo) {
    // Retardo justificado no cuenta como día completo
    if (tipo === 'retardo_justificado') {
      return 0;
    }

    // Calcular días laborables entre fechas
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');

    let dias = 0;
    const fechaActual = new Date(inicio);

    while (fechaActual <= fin) {
      const diaSemana = fechaActual.getDay();
      // Solo contar días laborables (lunes a viernes)
      if (diaSemana !== 0 && diaSemana !== 6) {
        dias++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    // Si es permiso sin goce de sueldo, retornar negativo para descontar
    if (tipo === 'permiso_sin_goce') {
      return -dias;
    }

    return dias;
  }

  /**
   * Obtener estadísticas de ausencias
   */
  async getAbsenceStats(filters = {}) {
    try {
      const ausencias = await this.getAbsences(filters);

      const stats = {
        total: ausencias.length,
        pendientes: ausencias.filter(a => a.estado === 'pendiente').length,
        aprobadas: ausencias.filter(a => a.estado === 'aprobado').length,
        rechazadas: ausencias.filter(a => a.estado === 'rechazado').length,
        porTipo: {},
        diasJustificadosTotales: 0
      };

      // Estadísticas por tipo
      ausencias.forEach(ausencia => {
        if (!stats.porTipo[ausencia.tipo]) {
          stats.porTipo[ausencia.tipo] = 0;
        }
        stats.porTipo[ausencia.tipo]++;

        // Sumar días justificados solo de ausencias aprobadas
        if (ausencia.estado === 'aprobado') {
          stats.diasJustificadosTotales += ausencia.diasJustificados || 0;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de ausencias:', error);
      throw error;
    }
  }

  /**
   * Obtener retardos de un usuario para justificación
   * Nota: Usamos consulta simple y filtramos en memoria para evitar índices compuestos
   */
  async getRetardosByUser(emailUsuario, fechaInicio, fechaFin) {
    try {
      // Consulta simple - solo por email (el campo puede ser 'correo' o 'email')
      let snapshot = await this.db.collection(this.attendanceCollection)
        .where('email', '==', emailUsuario)
        .get();

      // Si no hay resultados, intentar con 'correo'
      if (snapshot.empty) {
        snapshot = await this.db.collection(this.attendanceCollection)
          .where('correo', '==', emailUsuario)
          .get();
      }

      // Filtrar en memoria
      const retardos = [];
      snapshot.forEach(doc => {
        const data = doc.data();

        // Filtrar por estado y tipo
        if (data.estado !== 'retardo') return;
        if (data.tipoEvento !== 'entrada' && data.tipo !== 'entrada') return;

        // Filtrar por rango de fechas
        if (fechaInicio && data.fecha < fechaInicio) return;
        if (fechaFin && data.fecha > fechaFin) return;

        // Solo incluir retardos que no han sido corregidos
        if (data.corregidoPorAusencia) return;

        retardos.push({
          id: doc.id,
          fecha: data.fecha,
          hora: data.hora,
          nombre: data.nombre
        });
      });

      return retardos;
    } catch (error) {
      console.error('Error obteniendo retardos:', error);
      throw error;
    }
  }
}

export default new AbsenceService();
