/**
 * Servicio para gestión de capacitaciones
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_NOTIFICACION } from '../config/constants.js';
import NotificationService from './NotificationService.js';
import UserService from './UserService.js';

class TrainingService {
  constructor() {
    this.trainingsCollection = COLLECTIONS.CAPACITACIONES;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Crear una nueva capacitación
   */
  async createTraining(trainingData, creadorUid) {
    try {
      if (!trainingData.titulo) {
        throw new Error('El título es requerido');
      }

      const nuevaCapacitacion = {
        titulo: trainingData.titulo,
        descripcion: trainingData.descripcion || '',
        tipo: trainingData.tipo || 'curso', // curso, certificacion, taller
        proveedor: trainingData.proveedor || 'Interno',

        fechaInicio: trainingData.fechaInicio || '',
        fechaFin: trainingData.fechaFin || '',
        duracionHoras: trainingData.duracionHoras || 0,

        departamentos: trainingData.departamentos || ['Todos'],
        obligatoria: trainingData.obligatoria || false,

        participantes: [],

        creadoPor: creadorUid,
        fechaCreacion: new Date(),
        activa: true
      };

      const docRef = await this.db.collection(this.trainingsCollection).add(nuevaCapacitacion);

      // Notificar a los empleados si la capacitación es obligatoria
      if (nuevaCapacitacion.obligatoria) {
        const departamentos = nuevaCapacitacion.departamentos || [];
        const notifData = {
          tipo: TIPOS_NOTIFICACION.CAPACITACION_NUEVA,
          titulo: 'Nueva Capacitación Obligatoria',
          mensaje: `Se ha publicado una capacitación obligatoria: ${nuevaCapacitacion.titulo}.`
        };

        if (departamentos.includes('Todos')) {
          NotificationService.sendNotificationToAll(notifData).catch(e =>
            console.error('Error notificando capacitación nueva (todos):', e)
          );
        } else {
          for (const depto of departamentos) {
            NotificationService.sendNotificationToDepartment(depto, notifData).catch(e =>
              console.error(`Error notificando capacitación nueva (${depto}):`, e)
            );
          }
        }
      }

      return {
        id: docRef.id,
        ...nuevaCapacitacion
      };
    } catch (error) {
      console.error('Error creando capacitación:', error);
      throw error;
    }
  }

  /**
   * Obtener capacitaciones con filtros
   */
  async getTrainings(filters = {}, departmentFilter = null) {
    try {
      const snapshot = await this.db.collection(this.trainingsCollection).get();

      let capacitaciones = [];
      const tsToISO = (ts) => ts?.toDate?.()?.toISOString() ?? ts ?? null;

      snapshot.forEach(doc => {
        const data = doc.data();
        capacitaciones.push({
          id: doc.id,
          ...data,
          fechaCreacion: tsToISO(data.fechaCreacion),
          // Serializar Timestamps dentro de cada participante
          participantes: (data.participantes || []).map(p => ({
            ...p,
            fechaInscripcion: tsToISO(p.fechaInscripcion),
            fechaCompletado:  tsToISO(p.fechaCompletado)
          }))
        });
      });

      // Filtrar por estado activo
      if (filters.activa !== undefined) {
        capacitaciones = capacitaciones.filter(c => c.activa === filters.activa);
      } else {
        // Por defecto solo mostrar activas
        capacitaciones = capacitaciones.filter(c => c.activa !== false);
      }

      // Filtrar por tipo
      if (filters.tipo) {
        capacitaciones = capacitaciones.filter(c => c.tipo === filters.tipo);
      }

      // Filtrar por departamento
      if (departmentFilter) {
        capacitaciones = capacitaciones.filter(c =>
          c.departamentos.includes('Todos') || c.departamentos.includes(departmentFilter)
        );
      }

      // Ordenar por fecha de creación descendente
      capacitaciones.sort((a, b) => {
        const fechaA = a.fechaCreacion instanceof Date ? a.fechaCreacion : new Date(a.fechaCreacion);
        const fechaB = b.fechaCreacion instanceof Date ? b.fechaCreacion : new Date(b.fechaCreacion);
        return fechaB - fechaA;
      });

      return capacitaciones;
    } catch (error) {
      console.error('Error obteniendo capacitaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener capacitaciones de un empleado (donde está inscrito)
   */
  async getTrainingsByEmployee(empleadoUid) {
    try {
      const allTrainings = await this.getTrainings({});

      // Filtrar las que tienen al empleado inscrito
      const myTrainings = allTrainings.filter(t =>
        t.participantes?.some(p => p.uid === empleadoUid)
      );

      // Agregar datos de participación del empleado
      return myTrainings.map(t => {
        const participacion = t.participantes.find(p => p.uid === empleadoUid);
        return {
          ...t,
          miParticipacion: participacion
        };
      });
    } catch (error) {
      console.error('Error obteniendo capacitaciones del empleado:', error);
      throw error;
    }
  }

  /**
   * Obtener una capacitación por ID
   */
  async getTrainingById(trainingId) {
    try {
      const doc = await this.db.collection(this.trainingsCollection).doc(trainingId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
        fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion
      };
    } catch (error) {
      console.error('Error obteniendo capacitación:', error);
      throw error;
    }
  }

  /**
   * Actualizar capacitación
   */
  async updateTraining(trainingId, updateData) {
    try {
      const training = await this.getTrainingById(trainingId);
      if (!training) {
        throw new Error('Capacitación no encontrada');
      }

      const updates = {
        ...updateData,
        fechaActualizacion: new Date()
      };

      // No permitir actualizar participantes directamente
      delete updates.participantes;

      await this.db.collection(this.trainingsCollection).doc(trainingId).update(updates);

      return await this.getTrainingById(trainingId);
    } catch (error) {
      console.error('Error actualizando capacitación:', error);
      throw error;
    }
  }

  /**
   * Eliminar capacitación (soft delete)
   */
  async deleteTraining(trainingId) {
    try {
      const training = await this.getTrainingById(trainingId);
      if (!training) {
        throw new Error('Capacitación no encontrada');
      }

      await this.db.collection(this.trainingsCollection).doc(trainingId).update({
        activa: false,
        fechaEliminacion: new Date()
      });

      return { success: true, mensaje: 'Capacitación eliminada correctamente' };
    } catch (error) {
      console.error('Error eliminando capacitación:', error);
      throw error;
    }
  }

  /**
   * Inscribir empleado a capacitación
   */
  async enrollEmployee(trainingId, empleadoData) {
    try {
      const training = await this.getTrainingById(trainingId);
      if (!training) {
        throw new Error('Capacitación no encontrada');
      }

      // Verificar si ya está inscrito
      const yaInscrito = training.participantes?.some(p => p.uid === empleadoData.uid);
      if (yaInscrito) {
        throw new Error('El empleado ya está inscrito en esta capacitación');
      }

      const nuevoParticipante = {
        uid: empleadoData.uid,
        email: empleadoData.email,
        nombre: empleadoData.nombre || '',
        departamento: empleadoData.departamento || '',
        estado: 'inscrito', // inscrito, en_progreso, completada, reprobada
        calificacion: null,
        fechaInscripcion: new Date(),
        fechaCompletado: null
      };

      const participantes = training.participantes || [];
      participantes.push(nuevoParticipante);

      await this.db.collection(this.trainingsCollection).doc(trainingId).update({
        participantes,
        fechaActualizacion: new Date()
      });

      // Notificar al empleado
      NotificationService.notifyCapacitacionInscripcion(
        empleadoData.uid,
        empleadoData.email,
        training.titulo
      ).catch(e => console.error('Error notificando inscripción:', e));

      return nuevoParticipante;
    } catch (error) {
      console.error('Error inscribiendo empleado:', error);
      throw error;
    }
  }

  /**
   * Desinscribir empleado de capacitación
   */
  async unenrollEmployee(trainingId, empleadoUid) {
    try {
      const training = await this.getTrainingById(trainingId);
      if (!training) {
        throw new Error('Capacitación no encontrada');
      }

      const participantes = training.participantes || [];
      const index = participantes.findIndex(p => p.uid === empleadoUid);

      if (index === -1) {
        throw new Error('El empleado no está inscrito en esta capacitación');
      }

      const participanteRemovido = participantes[index];

      participantes.splice(index, 1);

      await this.db.collection(this.trainingsCollection).doc(trainingId).update({
        participantes,
        fechaActualizacion: new Date()
      });

      // Notificar al empleado
      if (participanteRemovido) {
        NotificationService.notifyCapacitacionDesinscripcion(
          empleadoUid,
          participanteRemovido.email,
          training.titulo
        ).catch(e => console.error('Error notificando desinscripción:', e));
      }

      return { success: true, mensaje: 'Empleado desinscrito correctamente' };
    } catch (error) {
      console.error('Error desinscribiendo empleado:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de participante (completar, reprobar, etc.)
   */
  async updateParticipantStatus(trainingId, empleadoUid, statusData) {
    try {
      const training = await this.getTrainingById(trainingId);
      if (!training) {
        throw new Error('Capacitación no encontrada');
      }

      const participantes = training.participantes || [];
      const index = participantes.findIndex(p => p.uid === empleadoUid);

      if (index === -1) {
        throw new Error('El empleado no está inscrito en esta capacitación');
      }

      // Actualizar datos del participante
      participantes[index] = {
        ...participantes[index],
        estado: statusData.estado || participantes[index].estado,
        calificacion: statusData.calificacion !== undefined ? statusData.calificacion : participantes[index].calificacion,
        fechaCompletado: statusData.estado === 'completada' ? new Date() : participantes[index].fechaCompletado
      };

      await this.db.collection(this.trainingsCollection).doc(trainingId).update({
        participantes,
        fechaActualizacion: new Date()
      });

      // Notificar si el estado es completada o reprobada
      const nuevoEstado = statusData.estado;
      if (nuevoEstado === 'completada' || nuevoEstado === 'reprobada') {
        const participante = participantes[index];
        NotificationService.notifyCapacitacionEstado(
          empleadoUid,
          participante.email,
          training.titulo,
          nuevoEstado,
          statusData.calificacion !== undefined ? statusData.calificacion : null
        ).catch(e => console.error('Error notificando estado capacitación:', e));
      }

      return participantes[index];
    } catch (error) {
      console.error('Error actualizando estado de participante:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de capacitaciones
   */
  async getTrainingStats(departmentFilter = null) {
    try {
      const capacitaciones = await this.getTrainings({}, departmentFilter);

      const stats = {
        total: capacitaciones.length,
        porTipo: {
          curso: 0,
          certificacion: 0,
          taller: 0
        },
        obligatorias: 0,
        totalParticipantes: 0,
        participantesCompletados: 0
      };

      capacitaciones.forEach(c => {
        stats.porTipo[c.tipo] = (stats.porTipo[c.tipo] || 0) + 1;
        if (c.obligatoria) stats.obligatorias++;

        if (c.participantes) {
          stats.totalParticipantes += c.participantes.length;
          stats.participantesCompletados += c.participantes.filter(p => p.estado === 'completada').length;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de capacitaciones:', error);
      throw error;
    }
  }
}

export default new TrainingService();
