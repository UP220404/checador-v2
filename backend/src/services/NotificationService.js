/**
 * Servicio para gestión de notificaciones
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_NOTIFICACION } from '../config/constants.js';
import UserService from './UserService.js';

class NotificationService {
  constructor() {
    this.notificationsCollection = COLLECTIONS.NOTIFICACIONES;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Obtiene las notificaciones de un usuario
   * Nota: Ordenamos en memoria para evitar índices compuestos en Firestore
   */
  async getNotificationsByUser(uid, options = {}) {
    try {
      const { limit = 50, onlyUnread = false } = options;

      // Consulta simple sin orderBy para evitar índices compuestos
      const querySnapshot = await this.db
        .collection(this.notificationsCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar y ordenar en memoria
      // Convertir Timestamps de Firestore a ISO string para que el frontend pueda parsearlos
      let notifications = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaCreacion: data.fechaCreacion?.toDate?.()?.toISOString() ?? data.fechaCreacion ?? null
        };
      });

      // Filtrar solo no leídas si se solicita
      if (onlyUnread) {
        notifications = notifications.filter(n => n.leida === false);
      }

      // Ordenar por fecha de creación descendente
      notifications.sort((a, b) => {
        const fechaA = a.fechaCreacion?.toDate?.() || new Date(a.fechaCreacion) || new Date(0);
        const fechaB = b.fechaCreacion?.toDate?.() || new Date(b.fechaCreacion) || new Date(0);
        return fechaB - fechaA;
      });

      // Aplicar límite
      if (limit) {
        notifications = notifications.slice(0, limit);
      }

      return notifications;
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene una notificación por su ID
   */
  async getNotificationById(notifId) {
    try {
      const docRef = await this.db.collection(this.notificationsCollection).doc(notifId).get();

      if (!docRef.exists) {
        return null;
      }

      return {
        id: docRef.id,
        ...docRef.data()
      };
    } catch (error) {
      console.error('Error obteniendo notificación:', error);
      throw error;
    }
  }

  /**
   * Crea una nueva notificación
   */
  async createNotification(notificationData) {
    try {
      // Validar tipo de notificación
      const tiposValidos = Object.values(TIPOS_NOTIFICACION);
      if (!tiposValidos.includes(notificationData.tipo)) {
        throw new Error(`Tipo de notificación inválido. Tipos válidos: ${tiposValidos.join(', ')}`);
      }

      const notifData = {
        uid: notificationData.uid,
        emailUsuario: notificationData.emailUsuario,
        tipo: notificationData.tipo,
        titulo: notificationData.titulo,
        mensaje: notificationData.mensaje,
        leida: false,
        fechaCreacion: new Date(),
        referencia: notificationData.referencia || null
      };

      const docRef = await this.db.collection(this.notificationsCollection).add(notifData);

      return {
        id: docRef.id,
        ...notifData
      };
    } catch (error) {
      console.error('Error creando notificación:', error);
      throw error;
    }
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notifId) {
    try {
      const docRef = this.db.collection(this.notificationsCollection).doc(notifId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        throw new Error('Notificación no encontrada');
      }

      await docRef.update({
        leida: true,
        fechaLectura: new Date()
      });

      return { success: true, message: 'Notificación marcada como leída' };
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(uid) {
    try {
      const querySnapshot = await this.db
        .collection(this.notificationsCollection)
        .where('uid', '==', uid)
        .where('leida', '==', false)
        .get();

      const batch = this.db.batch();
      const now = new Date();

      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          leida: true,
          fechaLectura: now
        });
      });

      await batch.commit();

      return {
        success: true,
        message: `${querySnapshot.size} notificaciones marcadas como leídas`
      };
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error);
      throw error;
    }
  }

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  async getUnreadCount(uid) {
    try {
      const querySnapshot = await this.db
        .collection(this.notificationsCollection)
        .where('uid', '==', uid)
        .where('leida', '==', false)
        .get();

      return querySnapshot.size;
    } catch (error) {
      console.error('Error contando notificaciones no leídas:', error);
      throw error;
    }
  }

  /**
   * Elimina una notificación
   */
  async deleteNotification(notifId) {
    try {
      const docRef = this.db.collection(this.notificationsCollection).doc(notifId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        throw new Error('Notificación no encontrada');
      }

      await docRef.delete();

      return { success: true, message: 'Notificación eliminada' };
    } catch (error) {
      console.error('Error eliminando notificación:', error);
      throw error;
    }
  }

  /**
   * Elimina notificaciones antiguas (más de 30 días)
   */
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Consulta simple - filtrar en memoria para evitar índices compuestos
      const querySnapshot = await this.db
        .collection(this.notificationsCollection)
        .where('leida', '==', true)
        .get();

      const batch = this.db.batch();
      let deleteCount = 0;

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const fechaCreacion = data.fechaCreacion?.toDate?.() || new Date(data.fechaCreacion);
        if (fechaCreacion < cutoffDate && deleteCount < 500) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });

      await batch.commit();

      return {
        success: true,
        deleted: deleteCount
      };
    } catch (error) {
      console.error('Error limpiando notificaciones antiguas:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE AYUDA PARA CREAR NOTIFICACIONES ESPECÍFICAS
  // ============================================

  /**
   * Notifica que un permiso fue aprobado
   */
  async notifyPermisoAprobado(uid, emailUsuario, tipoAusencia, fechas) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.PERMISO_APROBADO,
      titulo: 'Solicitud Aprobada',
      mensaje: `Tu solicitud de ${tipoAusencia} para ${fechas} ha sido aprobada.`,
      referencia: {
        tipo: 'ausencia',
        tipoAusencia
      }
    });
  }

  /**
   * Notifica que un permiso fue rechazado
   */
  async notifyPermisoRechazado(uid, emailUsuario, tipoAusencia, motivo = null) {
    let mensaje = `Tu solicitud de ${tipoAusencia} ha sido rechazada.`;
    if (motivo) {
      mensaje += ` Motivo: ${motivo}`;
    }

    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.PERMISO_RECHAZADO,
      titulo: 'Solicitud Rechazada',
      mensaje,
      referencia: {
        tipo: 'ausencia',
        tipoAusencia
      }
    });
  }

  /**
   * Notifica cumpleaños
   */
  async notifyCumpleanos(uid, emailUsuario, nombreCumpleanero, esMio = false) {
    const titulo = esMio ? '¡Feliz Cumpleaños!' : 'Cumpleaños de compañero';
    const mensaje = esMio
      ? '¡Todo el equipo te desea un muy feliz cumpleaños!'
      : `Hoy es cumpleaños de ${nombreCumpleanero}. ¡No olvides felicitarlo!`;

    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.CUMPLEANOS,
      titulo,
      mensaje
    });
  }

  /**
   * Notifica recordatorio general
   */
  async notifyRecordatorio(uid, emailUsuario, titulo, mensaje) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.RECORDATORIO,
      titulo,
      mensaje
    });
  }

  /**
   * Notifica inscripción a una capacitación
   */
  async notifyCapacitacionInscripcion(uid, emailUsuario, trainingTitle) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.CAPACITACION_INSCRIPCION,
      titulo: 'Inscripción a Capacitación',
      mensaje: `Has sido inscrito a la capacitación: ${trainingTitle}.`
    });
  }

  /**
   * Notifica desinscripción de una capacitación
   */
  async notifyCapacitacionDesinscripcion(uid, emailUsuario, trainingTitle) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.CAPACITACION_DESINSCRIPCION,
      titulo: 'Baja de Capacitación',
      mensaje: `Has sido dado de baja de la capacitación: ${trainingTitle}.`
    });
  }

  /**
   * Notifica cambio de estado en una capacitación (completada/reprobada/en_progreso)
   */
  async notifyCapacitacionEstado(uid, emailUsuario, trainingTitle, estado, calificacion = null) {
    const esCompletada = estado === 'completada';
    const tipo = esCompletada
      ? TIPOS_NOTIFICACION.CAPACITACION_COMPLETADA
      : TIPOS_NOTIFICACION.CAPACITACION_REPROBADA;

    let mensaje = esCompletada
      ? `Has completado la capacitación: ${trainingTitle}.`
      : `No aprobaste la capacitación: ${trainingTitle}.`;

    if (calificacion !== null) {
      mensaje += ` Calificación: ${calificacion}.`;
    }

    return this.createNotification({
      uid,
      emailUsuario,
      tipo,
      titulo: esCompletada ? 'Capacitación Completada' : 'Capacitación No Aprobada',
      mensaje
    });
  }

  /**
   * Notifica nueva capacitación disponible
   */
  async notifyCapacitacionNueva(uid, emailUsuario, trainingTitle) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.CAPACITACION_NUEVA,
      titulo: 'Nueva Capacitación Disponible',
      mensaje: `Se ha publicado una nueva capacitación: ${trainingTitle}.`
    });
  }

  /**
   * Notifica que se creó una evaluación de desempeño para el empleado
   */
  async notifyEvaluacionCreada(uid, emailUsuario) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.EVALUACION_CREADA,
      titulo: 'Nueva Evaluación de Desempeño',
      mensaje: 'Se ha creado una evaluación de desempeño para ti. Puedes consultarla en tu portal.'
    });
  }

  /**
   * Notifica que se completó una evaluación de desempeño
   */
  async notifyEvaluacionCompletada(uid, emailUsuario, calificacion = null) {
    let mensaje = 'Tu evaluación de desempeño ha sido completada.';
    if (calificacion !== null) {
      mensaje += ` Calificación general: ${Number(calificacion).toFixed(1)}.`;
    }

    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.EVALUACION_COMPLETADA,
      titulo: 'Evaluación de Desempeño Completada',
      mensaje
    });
  }

  /**
   * Notifica bienvenida al nuevo empleado
   */
  async notifyBienvenida(uid, emailUsuario, nombre) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.USUARIO_BIENVENIDA,
      titulo: '¡Bienvenido al equipo!',
      mensaje: `Hola ${nombre}, tu cuenta ha sido creada. Bienvenido a Cielito Home.`
    });
  }

  /**
   * Notifica a los admins que hay una nueva solicitud de ausencia pendiente
   * @param {string} uid - UID del admin destinatario
   * @param {string} emailUsuario - Email del admin
   * @param {string} nombreEmpleado - Nombre del empleado que solicitó
   * @param {string} tipoAusencia - Tipo de ausencia (vacaciones, permiso, etc.)
   * @param {string} fechas - Rango de fechas (ej: "2026-03-01 al 2026-03-05")
   * @param {boolean} esUrgente - Si es emergencia o requiere revisión urgente
   */
  async notifyNuevaSolicitudAusencia(uid, emailUsuario, nombreEmpleado, tipoAusencia, fechas, esUrgente = false) {
    const titulo = esUrgente
      ? `⚠️ Solicitud urgente de ${tipoAusencia}`
      : `Nueva solicitud de ${tipoAusencia}`;
    const mensaje = `${nombreEmpleado} solicitó ${tipoAusencia} para ${fechas}.${esUrgente ? ' Requiere revisión urgente.' : ''}`;

    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.NUEVA_SOLICITUD_AUSENCIA,
      titulo,
      mensaje,
      referencia: { tipo: 'ausencia', tipoAusencia, nombreEmpleado }
    });
  }

  /**
   * Confirma al empleado que su solicitud fue recibida y está pendiente
   */
  async notifySolicitudAusenciaConfirmacion(uid, emailUsuario, tipoAusencia, fechas) {
    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.SOLICITUD_AUSENCIA_CONFIRMACION,
      titulo: 'Solicitud recibida',
      mensaje: `Tu solicitud de ${tipoAusencia} para ${fechas} ha sido recibida y está pendiente de aprobación.`,
      referencia: { tipo: 'ausencia', tipoAusencia }
    });
  }

  /**
   * Notifica cambio de rol al empleado
   */
  async notifyCambioRol(uid, emailUsuario, nuevoRol) {
    const rolesLabel = {
      empleado: 'Empleado',
      admin_area: 'Administrador de Área',
      admin_rh: 'Administrador de RH'
    };

    return this.createNotification({
      uid,
      emailUsuario,
      tipo: TIPOS_NOTIFICACION.CAMBIO_ROL,
      titulo: 'Cambio de Rol',
      mensaje: `Tu rol en el sistema ha sido actualizado a: ${rolesLabel[nuevoRol] || nuevoRol}.`
    });
  }

  /**
   * Verifica cumpleaños del día y envía notificaciones
   * - Al empleado que cumple años (esMio: true)
   * - A todos sus compañeros (esMio: false)
   */
  async checkAndNotifyBirthdays() {
    try {
      const hoy = new Date();
      const mesHoy = hoy.getMonth() + 1;
      const diaHoy = hoy.getDate();

      const snapshot = await this.db
        .collection(COLLECTIONS.USUARIOS)
        .where('activo', '!=', false)
        .get();

      const todos = [];
      const cumpleaneros = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.fechaNacimiento) return;

        const fnac = new Date(data.fechaNacimiento + 'T00:00:00');
        if (isNaN(fnac.getTime())) return;

        todos.push({ uid: doc.id, ...data });

        if ((fnac.getMonth() + 1) === mesHoy && fnac.getDate() === diaHoy) {
          cumpleaneros.push({ uid: doc.id, ...data });
        }
      });

      let enviadas = 0;

      for (const cumple of cumpleaneros) {
        // Notificar al propio empleado
        try {
          await this.notifyCumpleanos(
            cumple.uid,
            cumple.correo || cumple.email,
            cumple.nombre,
            true
          );
          enviadas++;
        } catch (e) {
          console.error(`Error notificando cumpleaños propio a ${cumple.uid}:`, e);
        }

        // Notificar a todos los demás
        for (const companero of todos) {
          if (companero.uid === cumple.uid) continue;
          try {
            await this.notifyCumpleanos(
              companero.uid,
              companero.correo || companero.email,
              cumple.nombre,
              false
            );
            enviadas++;
          } catch (e) {
            console.error(`Error notificando cumpleaños a compañero ${companero.uid}:`, e);
          }
        }
      }

      return { cumpleaneros: cumpleaneros.length, notificacionesEnviadas: enviadas };
    } catch (error) {
      console.error('Error verificando cumpleaños:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS PARA ADMINISTRADORES
  // ============================================

  /**
   * Envía notificación a todos los usuarios de un departamento
   */
  async sendNotificationToDepartment(departamento, notificationData) {
    try {
      const users = await UserService.getUsersByDepartment(departamento);
      const results = [];

      for (const user of users) {
        try {
          const notification = await this.createNotification({
            uid: user.uid,
            emailUsuario: user.correo,
            tipo: notificationData.tipo || TIPOS_NOTIFICACION.SISTEMA,
            titulo: notificationData.titulo,
            mensaje: notificationData.mensaje,
            referencia: notificationData.referencia || null
          });
          results.push({ uid: user.uid, success: true, notification });
        } catch (error) {
          console.error(`Error enviando notificación a ${user.correo}:`, error);
          results.push({ uid: user.uid, success: false, error: error.message });
        }
      }

      return {
        success: true,
        departamento,
        totalEnviadas: results.filter(r => r.success).length,
        totalFallidas: results.filter(r => !r.success).length,
        details: results
      };
    } catch (error) {
      console.error('Error enviando notificaciones a departamento:', error);
      throw error;
    }
  }

  /**
   * Envía notificación a todos los usuarios del sistema
   */
  async sendNotificationToAll(notificationData) {
    try {
      const users = await UserService.getAllUsers();
      const results = [];

      for (const user of users) {
        try {
          const notification = await this.createNotification({
            uid: user.uid,
            emailUsuario: user.correo,
            tipo: notificationData.tipo || TIPOS_NOTIFICACION.SISTEMA,
            titulo: notificationData.titulo,
            mensaje: notificationData.mensaje,
            referencia: notificationData.referencia || null
          });
          results.push({ uid: user.uid, success: true });
        } catch (error) {
          console.error(`Error enviando notificación a ${user.correo}:`, error);
          results.push({ uid: user.uid, success: false, error: error.message });
        }
      }

      return {
        success: true,
        totalEnviadas: results.filter(r => r.success).length,
        totalFallidas: results.filter(r => !r.success).length
      };
    } catch (error) {
      console.error('Error enviando notificaciones masivas:', error);
      throw error;
    }
  }

  /**
   * Obtiene las solicitudes pendientes para el admin (para mostrar como notificaciones)
   */
  async getAdminPendingItems(departmentFilter = null) {
    try {
      const db = this.db;

      // Obtener ausencias pendientes
      let ausenciasQuery = db.collection(COLLECTIONS.AUSENCIAS)
        .where('estado', '==', 'pendiente');

      const ausenciasSnapshot = await ausenciasQuery.get();

      let pendingAbsences = [];
      ausenciasSnapshot.forEach(doc => {
        const data = doc.data();
        // Filtrar por departamento si se especifica
        if (!departmentFilter || data.departamentoUsuario === departmentFilter) {
          pendingAbsences.push({
            id: doc.id,
            tipo: 'ausencia',
            empleado: data.nombreUsuario,
            email: data.emailUsuario,
            tipoAusencia: data.tipo,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            motivo: data.motivo,
            fechaCreacion: data.fechaCreacion?.toDate?.() || data.fechaCreacion
          });
        }
      });

      // Ordenar por fecha de creación
      pendingAbsences.sort((a, b) => {
        const dateA = a.fechaCreacion instanceof Date ? a.fechaCreacion : new Date(a.fechaCreacion || 0);
        const dateB = b.fechaCreacion instanceof Date ? b.fechaCreacion : new Date(b.fechaCreacion || 0);
        return dateB - dateA;
      });

      return {
        pendingAbsences: pendingAbsences,
        totalPending: pendingAbsences.length
      };
    } catch (error) {
      console.error('Error obteniendo items pendientes para admin:', error);
      throw error;
    }
  }
}

export default new NotificationService();
