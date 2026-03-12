/**
 * Servicio para gestión de evaluaciones de contrato
 * Maneja el flujo: Contrato 1 mes -> Evaluación -> Contrato 2 meses -> Evaluación -> Indefinido
 */

import { getFirestore } from '../config/firebase.js';
import {
  COLLECTIONS,
  TIPOS_CONTRATO,
  ESTADOS_CONTRATO,
  TIPOS_EVALUACION_CONTRATO,
  ESTADOS_EVALUACION_CONTRATO,
  RESULTADOS_EVALUACION,
  ACCIONES_EVALUACION,
  TIPOS_NOTIFICACION,
  ROLES
} from '../config/constants.js';
import NotificationService from './NotificationService.js';

class ContractEvaluationService {
  constructor() {
    this.evaluationsCollection = COLLECTIONS.EVALUACIONES_CONTRATO;
    this.usersCollection = COLLECTIONS.USUARIOS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Inicializar contrato para un nuevo empleado
   * @param {string} uid - UID del empleado
   * @param {string} fechaIngreso - Fecha de ingreso (YYYY-MM-DD)
   */
  async initializeContract(uid, fechaIngreso) {
    try {
      // Calcular fecha fin del contrato inicial (1 mes)
      const fechaInicio = new Date(fechaIngreso + 'T00:00:00');
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + 1);

      const contrato = {
        tipo: TIPOS_CONTRATO.INICIAL_1_MES,
        fechaInicioContrato: fechaIngreso,
        fechaFinContrato: fechaFin.toISOString().split('T')[0],
        numeroContrato: 1,
        estado: ESTADOS_CONTRATO.ACTIVO
      };

      // Actualizar usuario con datos de contrato
      await this.db.collection(this.usersCollection).doc(uid).update({
        contrato: contrato
      });

      // Programar evaluación 7 días antes de terminar el contrato
      const fechaEvaluacion = new Date(fechaFin);
      fechaEvaluacion.setDate(fechaEvaluacion.getDate() - 7);

      await this.scheduleEvaluation(uid, fechaEvaluacion.toISOString().split('T')[0], TIPOS_EVALUACION_CONTRATO.EVALUACION_1_MES);

      return contrato;
    } catch (error) {
      console.error('Error inicializando contrato:', error);
      throw error;
    }
  }

  /**
   * Programar una evaluación de contrato
   */
  async scheduleEvaluation(uid, fechaProgramada, tipoEvaluacion) {
    try {
      // Obtener datos del empleado
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();

      const contrato = userData.contrato || {};

      const evaluacion = {
        empleadoUid: uid,
        empleadoNombre: userData.nombre || '',
        empleadoEmail: userData.correo || userData.email || '',
        departamento: userData.departamento || '',
        tipoEvaluacion: tipoEvaluacion,
        fechaProgramada: fechaProgramada,
        fechaFinContrato: contrato.fechaFinContrato || null,
        estado: ESTADOS_EVALUACION_CONTRATO.PENDIENTE,
        resultado: null,
        evaluador: null,
        comentarios: '',
        accionTomada: null,
        fechaCreacion: new Date(),
        fechaCompletada: null
      };

      const docRef = await this.db.collection(this.evaluationsCollection).add(evaluacion);

      return {
        id: docRef.id,
        ...evaluacion
      };
    } catch (error) {
      console.error('Error programando evaluación:', error);
      throw error;
    }
  }

  /**
   * Obtener evaluaciones pendientes
   */
  async getPendingEvaluations(departmentFilter = null) {
    try {
      let query = this.db.collection(this.evaluationsCollection)
        .where('estado', '==', ESTADOS_EVALUACION_CONTRATO.PENDIENTE);

      const snapshot = await query.get();

      let evaluaciones = [];
      snapshot.forEach(doc => {
        evaluaciones.push({
          id: doc.id,
          ...doc.data(),
          fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion
        });
      });

      // Filtrar por departamento si es necesario
      if (departmentFilter) {
        evaluaciones = evaluaciones.filter(e => e.departamento === departmentFilter);
      }

      // Ordenar por fecha programada (más próximas primero)
      evaluaciones.sort((a, b) => {
        const fechaA = new Date(a.fechaProgramada);
        const fechaB = new Date(b.fechaProgramada);
        return fechaA - fechaB;
      });

      return evaluaciones;
    } catch (error) {
      console.error('Error obteniendo evaluaciones pendientes:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las evaluaciones con filtros
   */
  async getEvaluations(filters = {}, departmentFilter = null) {
    try {
      let query = this.db.collection(this.evaluationsCollection);

      const snapshot = await query.get();

      let evaluaciones = [];
      snapshot.forEach(doc => {
        evaluaciones.push({
          id: doc.id,
          ...doc.data(),
          fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion,
          fechaCompletada: doc.data().fechaCompletada?.toDate?.() || doc.data().fechaCompletada
        });
      });

      // Filtrar en memoria
      if (filters.estado) {
        evaluaciones = evaluaciones.filter(e => e.estado === filters.estado);
      }

      if (filters.tipoEvaluacion) {
        evaluaciones = evaluaciones.filter(e => e.tipoEvaluacion === filters.tipoEvaluacion);
      }

      if (filters.empleadoUid) {
        evaluaciones = evaluaciones.filter(e => e.empleadoUid === filters.empleadoUid);
      }

      if (departmentFilter) {
        evaluaciones = evaluaciones.filter(e => e.departamento === departmentFilter);
      }

      // Ordenar por fecha de creación descendente
      evaluaciones.sort((a, b) => {
        const fechaA = a.fechaCreacion instanceof Date ? a.fechaCreacion : new Date(a.fechaCreacion);
        const fechaB = b.fechaCreacion instanceof Date ? b.fechaCreacion : new Date(b.fechaCreacion);
        return fechaB - fechaA;
      });

      return evaluaciones;
    } catch (error) {
      console.error('Error obteniendo evaluaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener una evaluación por ID
   */
  async getEvaluationById(evaluationId) {
    try {
      const doc = await this.db.collection(this.evaluationsCollection).doc(evaluationId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
        fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion,
        fechaCompletada: doc.data().fechaCompletada?.toDate?.() || doc.data().fechaCompletada
      };
    } catch (error) {
      console.error('Error obteniendo evaluación:', error);
      throw error;
    }
  }

  /**
   * Completar una evaluación
   * @param {string} evaluationId - ID de la evaluación
   * @param {string} resultado - 'aprobado' o 'rechazado'
   * @param {Object} evaluador - Datos del evaluador { uid, email, nombre }
   * @param {string} comentarios - Comentarios de la evaluación
   */
  async completeEvaluation(evaluationId, resultado, evaluador, comentarios = '') {
    try {
      const evaluacion = await this.getEvaluationById(evaluationId);
      if (!evaluacion) {
        throw new Error('Evaluación no encontrada');
      }

      if (evaluacion.estado !== ESTADOS_EVALUACION_CONTRATO.PENDIENTE) {
        throw new Error('La evaluación ya fue completada');
      }

      let accionTomada = null;

      // Determinar acción según el resultado
      if (resultado === RESULTADOS_EVALUACION.APROBADO) {
        if (evaluacion.tipoEvaluacion === TIPOS_EVALUACION_CONTRATO.EVALUACION_1_MES) {
          // Extender a contrato de 2 meses
          await this.extendContract(evaluacion.empleadoUid, 2);
          accionTomada = ACCIONES_EVALUACION.EXTENSION_CONTRATO;
        } else if (evaluacion.tipoEvaluacion === TIPOS_EVALUACION_CONTRATO.EVALUACION_2_MESES) {
          // Convertir a indefinido
          await this.convertToIndefinite(evaluacion.empleadoUid);
          accionTomada = ACCIONES_EVALUACION.CONVERSION_INDEFINIDO;
        }
      } else {
        // Rechazado - terminar contrato
        await this.terminateContract(evaluacion.empleadoUid);
        accionTomada = ACCIONES_EVALUACION.TERMINACION;
      }

      // Actualizar evaluación
      await this.db.collection(this.evaluationsCollection).doc(evaluationId).update({
        estado: ESTADOS_EVALUACION_CONTRATO.COMPLETADA,
        resultado: resultado,
        evaluador: evaluador,
        comentarios: comentarios,
        accionTomada: accionTomada,
        fechaCompletada: new Date()
      });

      return await this.getEvaluationById(evaluationId);
    } catch (error) {
      console.error('Error completando evaluación:', error);
      throw error;
    }
  }

  /**
   * Extender contrato
   * @param {string} uid - UID del empleado
   * @param {number} months - Meses de extensión (2)
   */
  async extendContract(uid, months) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const contratoActual = userData.contrato;

      // Calcular nueva fecha fin
      const fechaInicio = new Date(contratoActual.fechaFinContrato + 'T00:00:00');
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + months);

      const nuevoContrato = {
        tipo: TIPOS_CONTRATO.EXTENSION_2_MESES,
        fechaInicioContrato: contratoActual.fechaFinContrato,
        fechaFinContrato: fechaFin.toISOString().split('T')[0],
        numeroContrato: 2,
        estado: ESTADOS_CONTRATO.ACTIVO
      };

      await this.db.collection(this.usersCollection).doc(uid).update({
        contrato: nuevoContrato
      });

      // Programar evaluación 7 días antes de terminar
      const fechaEvaluacion = new Date(fechaFin);
      fechaEvaluacion.setDate(fechaEvaluacion.getDate() - 7);

      await this.scheduleEvaluation(uid, fechaEvaluacion.toISOString().split('T')[0], TIPOS_EVALUACION_CONTRATO.EVALUACION_2_MESES);

      // Notificar al empleado
      try {
        await NotificationService.createNotification({
          uid: uid,
          tipo: TIPOS_NOTIFICACION.CONTRATO_EXTENDIDO,
          titulo: 'Contrato Extendido',
          mensaje: `Tu contrato ha sido extendido por ${months} meses. Nueva fecha de fin: ${fechaFin.toLocaleDateString('es-MX')}`,
          emailUsuario: userData.correo || userData.email
        });
      } catch (notifError) {
        console.error('Error enviando notificación:', notifError);
      }

      return nuevoContrato;
    } catch (error) {
      console.error('Error extendiendo contrato:', error);
      throw error;
    }
  }

  /**
   * Convertir a contrato indefinido
   */
  async convertToIndefinite(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();

      const nuevoContrato = {
        tipo: TIPOS_CONTRATO.INDEFINIDO,
        fechaInicioContrato: new Date().toISOString().split('T')[0],
        fechaFinContrato: null,
        numeroContrato: 3,
        estado: ESTADOS_CONTRATO.ACTIVO
      };

      await this.db.collection(this.usersCollection).doc(uid).update({
        contrato: nuevoContrato
      });

      // Notificar al empleado
      try {
        await NotificationService.createNotification({
          uid: uid,
          tipo: TIPOS_NOTIFICACION.CONTRATO_INDEFINIDO,
          titulo: 'Contrato Indefinido',
          mensaje: 'Felicidades! Tu contrato ha sido convertido a indefinido.',
          emailUsuario: userData.correo || userData.email
        });
      } catch (notifError) {
        console.error('Error enviando notificación:', notifError);
      }

      return nuevoContrato;
    } catch (error) {
      console.error('Error convirtiendo a indefinido:', error);
      throw error;
    }
  }

  /**
   * Terminar contrato
   */
  async terminateContract(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();

      // Actualizar estado del contrato
      await this.db.collection(this.usersCollection).doc(uid).update({
        'contrato.estado': ESTADOS_CONTRATO.TERMINADO,
        activo: false
      });

      // Notificar al empleado
      try {
        await NotificationService.createNotification({
          uid: uid,
          tipo: TIPOS_NOTIFICACION.CONTRATO_TERMINADO,
          titulo: 'Fin de Contrato',
          mensaje: 'Tu contrato ha llegado a su fin. Contacta a RH para más información.',
          emailUsuario: userData.correo || userData.email
        });
      } catch (notifError) {
        console.error('Error enviando notificación:', notifError);
      }

      return { success: true };
    } catch (error) {
      console.error('Error terminando contrato:', error);
      throw error;
    }
  }

  /**
   * Sincronizar evaluaciones pendientes: recalcular fechas y actualizar datos del empleado
   */
  async syncPendingEvaluations() {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Primero: reactivar evaluaciones marcadas como vencidas incorrectamente
      // (contratos que aún no han expirado)
      const vencidasSnapshot = await this.db.collection(this.evaluationsCollection)
        .where('estado', '==', ESTADOS_EVALUACION_CONTRATO.VENCIDA)
        .get();

      for (const doc of vencidasSnapshot.docs) {
        const eval_ = doc.data();
        // Buscar el contrato actual del usuario
        const userDoc = await this.db.collection(this.usersCollection).doc(eval_.empleadoUid).get();
        if (!userDoc.exists) continue;

        const contrato = userDoc.data().contrato;
        if (!contrato || !contrato.fechaFinContrato) continue;

        const fechaFin = new Date(contrato.fechaFinContrato + 'T00:00:00');
        if (fechaFin >= hoy) {
          // El contrato aún no vence, reactivar la evaluación
          await this.db.collection(this.evaluationsCollection).doc(doc.id).update({
            estado: ESTADOS_EVALUACION_CONTRATO.PENDIENTE
          });
          console.log(`🔄 Evaluación ${doc.id} reactivada (contrato vence ${contrato.fechaFinContrato})`);
        }
      }

      const evaluaciones = await this.getPendingEvaluations();
      let updated = 0;

      for (const evaluacion of evaluaciones) {
        const userDoc = await this.db.collection(this.usersCollection).doc(evaluacion.empleadoUid).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        const contrato = userData.contrato;
        const updates = {};

        // Sincronizar datos del empleado si cambiaron
        const nombreActual = userData.nombre || '';
        const emailActual = userData.correo || userData.email || '';
        const deptoActual = userData.departamento || '';

        if (evaluacion.empleadoNombre !== nombreActual) {
          updates.empleadoNombre = nombreActual;
        }
        if (evaluacion.empleadoEmail !== emailActual) {
          updates.empleadoEmail = emailActual;
        }
        if (evaluacion.departamento !== deptoActual) {
          updates.departamento = deptoActual;
        }

        // Sincronizar fechaFinContrato y recalcular fechaProgramada
        if (contrato && contrato.fechaFinContrato) {
          if (evaluacion.fechaFinContrato !== contrato.fechaFinContrato) {
            updates.fechaFinContrato = contrato.fechaFinContrato;
          }

          const fechaFin = new Date(contrato.fechaFinContrato + 'T00:00:00');
          const fechaCorrecta = new Date(fechaFin);
          fechaCorrecta.setDate(fechaCorrecta.getDate() - 7);
          const fechaCorrectaStr = fechaCorrecta.toISOString().split('T')[0];

          if (evaluacion.fechaProgramada !== fechaCorrectaStr) {
            updates.fechaProgramada = fechaCorrectaStr;
            console.log(`📅 Evaluación ${evaluacion.id} fecha: ${evaluacion.fechaProgramada} → ${fechaCorrectaStr}`);
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.db.collection(this.evaluationsCollection).doc(evaluacion.id).update(updates);
          updated++;
        }
      }

      return { total: evaluaciones.length, updated };
    } catch (error) {
      console.error('Error sincronizando evaluaciones:', error);
      throw error;
    }
  }

  /**
   * Sincronizar evaluaciones pendientes de un usuario específico
   * Se llama cuando se actualizan datos de un usuario
   */
  async syncEvaluationsForUser(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const nombreActual = userData.nombre || '';
      const emailActual = userData.correo || userData.email || '';
      const deptoActual = userData.departamento || '';

      // Buscar evaluaciones pendientes de este usuario
      const snapshot = await this.db.collection(this.evaluationsCollection)
        .where('empleadoUid', '==', uid)
        .where('estado', '==', ESTADOS_EVALUACION_CONTRATO.PENDIENTE)
        .get();

      for (const doc of snapshot.docs) {
        const eval_ = doc.data();
        const updates = {};

        if (eval_.empleadoNombre !== nombreActual) updates.empleadoNombre = nombreActual;
        if (eval_.empleadoEmail !== emailActual) updates.empleadoEmail = emailActual;
        if (eval_.departamento !== deptoActual) updates.departamento = deptoActual;

        if (Object.keys(updates).length > 0) {
          await this.db.collection(this.evaluationsCollection).doc(doc.id).update(updates);
        }
      }
    } catch (error) {
      console.error('Error sincronizando evaluaciones del usuario:', error);
    }
  }

  /**
   * Verificar evaluaciones próximas a vencer y enviar notificaciones
   * Se ejecuta diariamente via cron job
   */
  async checkPendingEvaluations() {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const evaluaciones = await this.getPendingEvaluations();

      for (const evaluacion of evaluaciones) {
        // Usar fechaFinContrato para determinar vencimiento real del contrato
        const fechaReferencia = evaluacion.fechaFinContrato || evaluacion.fechaProgramada;
        const fechaRef = new Date(fechaReferencia + 'T00:00:00');
        const diffDiasContrato = Math.ceil((fechaRef - hoy) / (1000 * 60 * 60 * 24));

        // Marcar como vencida solo cuando el contrato ha expirado
        if (diffDiasContrato < 0) {
          await this.db.collection(this.evaluationsCollection).doc(evaluacion.id).update({
            estado: ESTADOS_EVALUACION_CONTRATO.VENCIDA
          });
          continue;
        }

        // Notificar a admins RH si faltan 7 días o menos para que venza el contrato
        if (diffDiasContrato <= 7) {
          await this.notifyAdminsAboutEvaluation(evaluacion, diffDiasContrato);
        }
      }

      return { checked: evaluaciones.length };
    } catch (error) {
      console.error('Error verificando evaluaciones pendientes:', error);
      throw error;
    }
  }

  /**
   * Verificar contratos próximos a vencer y notificar a HR
   * Se ejecuta diariamente via cron job
   */
  async checkExpiringContracts() {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const usersSnapshot = await this.db.collection(this.usersCollection)
        .where('activo', '!=', false)
        .get();

      let notified = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const contrato = userData.contrato;

        if (!contrato || !contrato.fechaFinContrato ||
            contrato.tipo === TIPOS_CONTRATO.INDEFINIDO ||
            contrato.estado === ESTADOS_CONTRATO.TERMINADO) {
          continue;
        }

        const fechaFin = new Date(contrato.fechaFinContrato + 'T00:00:00');
        const diffDias = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));

        // Notificar a HR si el contrato vence en 7 días o menos
        if (diffDias >= 0 && diffDias <= 7) {
          await this.notifyAdminsAboutExpiringContract(userDoc.id, userData, contrato, diffDias);
          notified++;
        }
      }

      return { checked: usersSnapshot.size, notified };
    } catch (error) {
      console.error('Error verificando contratos por vencer:', error);
      throw error;
    }
  }

  /**
   * Notificar a administradores RH sobre contrato próximo a vencer
   */
  async notifyAdminsAboutExpiringContract(uid, userData, contrato, diasRestantes) {
    try {
      const adminsSnapshot = await this.db.collection(this.usersCollection)
        .where('role', '==', ROLES.ADMIN_RH)
        .get();

      const tipoContrato = contrato.tipo === TIPOS_CONTRATO.INICIAL_1_MES
        ? '1 mes' : '2 meses';

      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data();

        await NotificationService.createNotification({
          uid: adminDoc.id,
          tipo: TIPOS_NOTIFICACION.CONTRATO_POR_VENCER,
          titulo: 'Contrato Por Vencer',
          mensaje: `El contrato de ${tipoContrato} de ${userData.nombre || 'Empleado'} vence en ${diasRestantes} día(s). Fecha fin: ${contrato.fechaFinContrato}`,
          emailUsuario: adminData.correo || adminData.email,
          metadata: {
            empleadoUid: uid,
            fechaFinContrato: contrato.fechaFinContrato,
            tipoContrato: contrato.tipo
          }
        });
      }
    } catch (error) {
      console.error('Error notificando contrato por vencer:', error);
    }
  }

  /**
   * Notificar a administradores RH sobre evaluación próxima
   */
  async notifyAdminsAboutEvaluation(evaluacion, diasRestantes) {
    try {
      // Obtener todos los admin_rh
      const adminsSnapshot = await this.db.collection(this.usersCollection)
        .where('role', '==', ROLES.ADMIN_RH)
        .get();

      const tipoEval = evaluacion.tipoEvaluacion === TIPOS_EVALUACION_CONTRATO.EVALUACION_1_MES
        ? '1 mes' : '2 meses';

      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data();

        await NotificationService.createNotification({
          uid: adminDoc.id,
          tipo: TIPOS_NOTIFICACION.EVALUACION_CONTRATO_PROXIMA,
          titulo: 'Evaluación de Contrato Próxima',
          mensaje: `La evaluación de ${tipoEval} de ${evaluacion.empleadoNombre} vence en ${diasRestantes} día(s). Fecha programada: ${evaluacion.fechaProgramada}`,
          emailUsuario: adminData.correo || adminData.email,
          metadata: {
            evaluacionId: evaluacion.id,
            empleadoUid: evaluacion.empleadoUid
          }
        });
      }
    } catch (error) {
      console.error('Error notificando a admins:', error);
    }
  }

  /**
   * Obtener estadísticas de evaluaciones
   */
  async getStats() {
    try {
      const evaluaciones = await this.getEvaluations();

      return {
        total: evaluaciones.length,
        pendientes: evaluaciones.filter(e => e.estado === ESTADOS_EVALUACION_CONTRATO.PENDIENTE).length,
        completadas: evaluaciones.filter(e => e.estado === ESTADOS_EVALUACION_CONTRATO.COMPLETADA).length,
        vencidas: evaluaciones.filter(e => e.estado === ESTADOS_EVALUACION_CONTRATO.VENCIDA).length,
        aprobadas: evaluaciones.filter(e => e.resultado === RESULTADOS_EVALUACION.APROBADO).length,
        rechazadas: evaluaciones.filter(e => e.resultado === RESULTADOS_EVALUACION.RECHAZADO).length
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}

export default new ContractEvaluationService();
