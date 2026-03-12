/**
 * Servicio para gestión de evaluaciones de desempeño
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_NOTIFICACION } from '../config/constants.js';
import NotificationService from './NotificationService.js';

class EvaluationService {
  constructor() {
    this.evaluationsCollection = COLLECTIONS.EVALUACIONES;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Crear una nueva evaluación
   */
  async createEvaluation(evaluationData) {
    try {
      // Validar campos requeridos
      if (!evaluationData.empleadoUid || !evaluationData.empleadoEmail) {
        throw new Error('Datos del empleado son requeridos');
      }

      if (!evaluationData.evaluador || !evaluationData.evaluador.uid) {
        throw new Error('Datos del evaluador son requeridos');
      }

      const nuevaEvaluacion = {
        empleadoUid: evaluationData.empleadoUid,
        empleadoEmail: evaluationData.empleadoEmail,
        empleadoNombre: evaluationData.empleadoNombre || '',
        departamento: evaluationData.departamento || '',

        periodo: {
          tipo: evaluationData.periodo?.tipo || 'trimestral',
          fechaInicio: evaluationData.periodo?.fechaInicio || '',
          fechaFin: evaluationData.periodo?.fechaFin || ''
        },

        evaluador: {
          uid: evaluationData.evaluador.uid,
          email: evaluationData.evaluador.email,
          nombre: evaluationData.evaluador.nombre || ''
        },

        categorias: evaluationData.categorias || [],
        calificacionGeneral: evaluationData.calificacionGeneral || 0,
        fortalezas: evaluationData.fortalezas || '',
        areasOportunidad: evaluationData.areasOportunidad || '',
        metas: evaluationData.metas || [],

        estado: evaluationData.estado || 'borrador', // borrador, completada, revisada
        fechaCreacion: new Date(),
        fechaCompletada: null
      };

      const docRef = await this.db.collection(this.evaluationsCollection).add(nuevaEvaluacion);

      // Notificar al empleado si la evaluación no es borrador
      if (nuevaEvaluacion.estado !== 'borrador') {
        NotificationService.notifyEvaluacionCreada(
          nuevaEvaluacion.empleadoUid,
          nuevaEvaluacion.empleadoEmail
        ).catch(e => console.error('Error notificando evaluación creada:', e));
      }

      return {
        id: docRef.id,
        ...nuevaEvaluacion
      };
    } catch (error) {
      console.error('Error creando evaluación:', error);
      throw error;
    }
  }

  /**
   * Obtener evaluaciones con filtros
   * @param {Object} filters - Filtros opcionales
   * @param {string} departmentFilter - Filtrar por departamento (para admin_area)
   */
  async getEvaluations(filters = {}, departmentFilter = null) {
    try {
      let query = this.db.collection(this.evaluationsCollection);

      // Filtrar por empleado
      if (filters.empleadoUid) {
        query = query.where('empleadoUid', '==', filters.empleadoUid);
      }

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
   * Obtener evaluaciones de un empleado
   */
  async getEvaluationsByEmployee(empleadoUid) {
    try {
      const snapshot = await this.db.collection(this.evaluationsCollection)
        .where('empleadoUid', '==', empleadoUid)
        .get();

      const evaluaciones = [];
      snapshot.forEach(doc => {
        evaluaciones.push({
          id: doc.id,
          ...doc.data(),
          fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion,
          fechaCompletada: doc.data().fechaCompletada?.toDate?.() || doc.data().fechaCompletada
        });
      });

      // Ordenar por fecha descendente
      evaluaciones.sort((a, b) => {
        const fechaA = a.fechaCreacion instanceof Date ? a.fechaCreacion : new Date(a.fechaCreacion);
        const fechaB = b.fechaCreacion instanceof Date ? b.fechaCreacion : new Date(b.fechaCreacion);
        return fechaB - fechaA;
      });

      return evaluaciones;
    } catch (error) {
      console.error('Error obteniendo evaluaciones del empleado:', error);
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
   * Actualizar evaluación
   */
  async updateEvaluation(evaluationId, updateData) {
    try {
      const evaluacion = await this.getEvaluationById(evaluationId);
      if (!evaluacion) {
        throw new Error('Evaluación no encontrada');
      }

      // Preparar datos de actualización
      const updates = {
        ...updateData,
        fechaActualizacion: new Date()
      };

      // Si se marca como completada, agregar fecha
      if (updateData.estado === 'completada' && evaluacion.estado !== 'completada') {
        updates.fechaCompletada = new Date();
      }

      // Recalcular calificación general si se actualizan las categorías
      if (updateData.categorias && updateData.categorias.length > 0) {
        const total = updateData.categorias.reduce((sum, cat) => sum + (cat.calificacion || 0), 0);
        updates.calificacionGeneral = total / updateData.categorias.length;
      }

      await this.db.collection(this.evaluationsCollection).doc(evaluationId).update(updates);

      // Notificar al empleado si la evaluación fue completada
      if (updateData.estado === 'completada' && evaluacion.estado !== 'completada') {
        const calificacion = updates.calificacionGeneral ?? evaluacion.calificacionGeneral ?? null;
        NotificationService.notifyEvaluacionCompletada(
          evaluacion.empleadoUid,
          evaluacion.empleadoEmail,
          calificacion
        ).catch(e => console.error('Error notificando evaluación completada:', e));
      }

      return await this.getEvaluationById(evaluationId);
    } catch (error) {
      console.error('Error actualizando evaluación:', error);
      throw error;
    }
  }

  /**
   * Eliminar evaluación (solo borradores)
   */
  async deleteEvaluation(evaluationId) {
    try {
      const evaluacion = await this.getEvaluationById(evaluationId);
      if (!evaluacion) {
        throw new Error('Evaluación no encontrada');
      }

      if (evaluacion.estado !== 'borrador') {
        throw new Error('Solo se pueden eliminar evaluaciones en estado borrador');
      }

      await this.db.collection(this.evaluationsCollection).doc(evaluationId).delete();

      return { success: true, mensaje: 'Evaluación eliminada correctamente' };
    } catch (error) {
      console.error('Error eliminando evaluación:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de evaluaciones
   */
  async getEvaluationStats(departmentFilter = null) {
    try {
      const evaluaciones = await this.getEvaluations({}, departmentFilter);

      const stats = {
        total: evaluaciones.length,
        porEstado: {
          borrador: 0,
          completada: 0,
          revisada: 0
        },
        promedioGeneral: 0,
        empleadosEvaluados: new Set()
      };

      let sumaCalificaciones = 0;
      let evaluacionesConCalificacion = 0;

      evaluaciones.forEach(e => {
        stats.porEstado[e.estado] = (stats.porEstado[e.estado] || 0) + 1;
        stats.empleadosEvaluados.add(e.empleadoUid);

        if (e.calificacionGeneral > 0) {
          sumaCalificaciones += e.calificacionGeneral;
          evaluacionesConCalificacion++;
        }
      });

      stats.empleadosEvaluados = stats.empleadosEvaluados.size;
      stats.promedioGeneral = evaluacionesConCalificacion > 0
        ? (sumaCalificaciones / evaluacionesConCalificacion).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de evaluaciones:', error);
      throw error;
    }
  }
}

export default new EvaluationService();
