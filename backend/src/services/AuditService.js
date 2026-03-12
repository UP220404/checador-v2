/**
 * Servicio para gestión de auditoría de acciones administrativas
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';

class AuditService {
  constructor() {
    this.auditCollection = COLLECTIONS.AUDITORIA;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Registrar una acción en el log de auditoría
   */
  async log(auditData) {
    try {
      const registro = {
        accion: auditData.accion, // crear_usuario, eliminar_usuario, aprobar_ausencia, etc.
        entidad: auditData.entidad, // usuarios, ausencias, evaluaciones, etc.
        entidadId: auditData.entidadId || null,

        ejecutadoPor: {
          uid: auditData.ejecutadoPor?.uid || '',
          email: auditData.ejecutadoPor?.email || '',
          nombre: auditData.ejecutadoPor?.nombre || '',
          role: auditData.ejecutadoPor?.role || ''
        },

        detalles: auditData.detalles || {},
        ip: auditData.ip || null,
        userAgent: auditData.userAgent || null,

        timestamp: new Date()
      };

      const docRef = await this.db.collection(this.auditCollection).add(registro);

      return {
        id: docRef.id,
        ...registro
      };
    } catch (error) {
      console.error('Error registrando acción en auditoría:', error);
      // No lanzar error para no interrumpir el flujo principal
      return null;
    }
  }

  /**
   * Obtener registros de auditoría con filtros
   */
  async getAuditLogs(filters = {}, limit = 100) {
    try {
      let query = this.db.collection(this.auditCollection);

      // Filtrar por acción
      if (filters.accion) {
        query = query.where('accion', '==', filters.accion);
      }

      // Filtrar por entidad
      if (filters.entidad) {
        query = query.where('entidad', '==', filters.entidad);
      }

      // Filtrar por usuario que ejecutó
      if (filters.ejecutadoPorEmail) {
        query = query.where('ejecutadoPor.email', '==', filters.ejecutadoPorEmail);
      }

      const snapshot = await query.get();

      let logs = [];
      snapshot.forEach(doc => {
        logs.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        });
      });

      // Filtrar por rango de fechas en memoria
      if (filters.fechaInicio) {
        const fechaInicio = new Date(filters.fechaInicio);
        logs = logs.filter(log => {
          const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
          return logDate >= fechaInicio;
        });
      }

      if (filters.fechaFin) {
        const fechaFin = new Date(filters.fechaFin);
        fechaFin.setHours(23, 59, 59, 999);
        logs = logs.filter(log => {
          const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
          return logDate <= fechaFin;
        });
      }

      // Ordenar por timestamp descendente
      logs.sort((a, b) => {
        const fechaA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const fechaB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return fechaB - fechaA;
      });

      // Aplicar límite
      return logs.slice(0, limit);
    } catch (error) {
      console.error('Error obteniendo registros de auditoría:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de una entidad específica
   */
  async getEntityHistory(entidad, entidadId) {
    try {
      const snapshot = await this.db.collection(this.auditCollection)
        .where('entidad', '==', entidad)
        .where('entidadId', '==', entidadId)
        .get();

      let logs = [];
      snapshot.forEach(doc => {
        logs.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        });
      });

      // Ordenar por timestamp descendente
      logs.sort((a, b) => {
        const fechaA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const fechaB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return fechaB - fechaA;
      });

      return logs;
    } catch (error) {
      console.error('Error obteniendo historial de entidad:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de auditoría
   */
  async getAuditStats(fechaInicio = null, fechaFin = null) {
    try {
      const logs = await this.getAuditLogs({ fechaInicio, fechaFin }, 1000);

      const stats = {
        total: logs.length,
        porAccion: {},
        porEntidad: {},
        porUsuario: {},
        ultimasAcciones: logs.slice(0, 10)
      };

      logs.forEach(log => {
        stats.porAccion[log.accion] = (stats.porAccion[log.accion] || 0) + 1;
        stats.porEntidad[log.entidad] = (stats.porEntidad[log.entidad] || 0) + 1;

        const email = log.ejecutadoPor?.email || 'desconocido';
        stats.porUsuario[email] = (stats.porUsuario[email] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de auditoría:', error);
      throw error;
    }
  }

  /**
   * Limpiar registros antiguos de auditoría
   */
  async cleanupOldLogs(daysOld = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const snapshot = await this.db.collection(this.auditCollection).get();

      const batch = this.db.batch();
      let deleteCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        if (timestamp < cutoffDate && deleteCount < 500) {
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
      console.error('Error limpiando registros de auditoría:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE AYUDA PARA ACCIONES COMUNES
  // ============================================

  async logUserAction(accion, userData, ejecutadoPor, detalles = {}) {
    return this.log({
      accion,
      entidad: 'usuarios',
      entidadId: userData.uid,
      ejecutadoPor,
      detalles: {
        ...detalles,
        empleadoAfectado: userData.email,
        nombreEmpleadoAfectado: userData.nombre || userData.email?.split('@')[0] || 'Usuario'
      }
    });
  }

  async logAbsenceAction(accion, absenceId, absenceData, ejecutadoPor, detalles = {}) {
    return this.log({
      accion,
      entidad: 'ausencias',
      entidadId: absenceId,
      ejecutadoPor,
      detalles: {
        ...detalles,
        empleadoAfectado: absenceData.emailUsuario,
        nombreEmpleadoAfectado: absenceData.nombreUsuario || absenceData.emailUsuario?.split('@')[0] || 'Empleado',
        tipoAusencia: absenceData.tipo
      }
    });
  }

  async logEvaluationAction(accion, evaluationId, evaluationData, ejecutadoPor, detalles = {}) {
    return this.log({
      accion,
      entidad: 'evaluaciones',
      entidadId: evaluationId,
      ejecutadoPor,
      detalles: {
        ...detalles,
        empleadoAfectado: evaluationData.empleadoEmail,
        nombreEmpleadoAfectado: evaluationData.empleadoNombre || evaluationData.empleadoEmail?.split('@')[0] || 'Empleado'
      }
    });
  }

  async logTrainingAction(accion, trainingId, trainingData, ejecutadoPor, detalles = {}) {
    return this.log({
      accion,
      entidad: 'capacitaciones',
      entidadId: trainingId,
      ejecutadoPor,
      detalles: {
        ...detalles,
        titulo: trainingData.titulo,
        nombreEmpleadoAfectado: trainingData.empleadoNombre || null
      }
    });
  }

  async logPayrollAction(accion, periodoId, ejecutadoPor, detalles = {}) {
    return this.log({
      accion,
      entidad: 'nominas',
      entidadId: periodoId,
      ejecutadoPor,
      detalles
    });
  }

  async logRoleChange(userId, userData, oldRole, newRole, ejecutadoPor) {
    return this.log({
      accion: 'cambiar_rol',
      entidad: 'usuarios',
      entidadId: userId,
      ejecutadoPor,
      detalles: {
        empleadoAfectado: userData?.email,
        nombreEmpleadoAfectado: userData?.nombre || userData?.email?.split('@')[0] || 'Usuario',
        cambios: {
          role: { antes: oldRole, despues: newRole }
        }
      }
    });
  }
}

export default new AuditService();
