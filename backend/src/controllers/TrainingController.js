/**
 * Controlador de Capacitaciones
 */

import TrainingService from '../services/TrainingService.js';
import UserService from '../services/UserService.js';
import AuditService from '../services/AuditService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class TrainingController {
  /**
   * GET /api/v1/training
   * Obtiene todas las capacitaciones
   */
  async getAllTrainings(req, res) {
    try {
      const { tipo, activa } = req.query;
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;

      const filters = {};
      if (tipo) filters.tipo = tipo;
      if (activa !== undefined) filters.activa = activa === 'true';

      const trainings = await TrainingService.getTrainings(filters, departmentFilter);

      res.json({
        success: true,
        count: trainings.length,
        data: trainings
      });
    } catch (error) {
      console.error('Error en getAllTrainings:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/training/my
   * Obtiene las capacitaciones del usuario actual
   */
  async getMyTrainings(req, res) {
    try {
      const uid = req.user.uid;

      const trainings = await TrainingService.getTrainingsByEmployee(uid);

      res.json({
        success: true,
        count: trainings.length,
        data: trainings
      });
    } catch (error) {
      console.error('Error en getMyTrainings:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/training/:id
   * Obtiene una capacitación por ID
   */
  async getTrainingById(req, res) {
    try {
      const { id } = req.params;

      const training = await TrainingService.getTrainingById(id);

      if (!training) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Capacitación no encontrada'
        });
      }

      res.json({
        success: true,
        data: training
      });
    } catch (error) {
      console.error('Error en getTrainingById:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/training
   * Crea una nueva capacitación
   */
  async createTraining(req, res) {
    try {
      const trainingData = req.body;

      // Si es admin_area, asignar solo a su departamento
      if (req.user.role === ROLES.ADMIN_AREA) {
        trainingData.departamentos = [req.user.departamento];
      }

      const training = await TrainingService.createTraining(trainingData, req.user.uid);

      // Registrar en auditoría
      await AuditService.logTrainingAction(
        'crear_capacitacion',
        training.id,
        { titulo: training.titulo },
        {
          uid: req.user.uid,
          email: req.user.email,
          nombre: req.user.roleData?.nombre || req.user.name || '',
          role: req.user.role
        }
      );

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Capacitación creada exitosamente',
        data: training
      });
    } catch (error) {
      console.error('Error en createTraining:', error);

      if (error.message.includes('requerido')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/training/:id
   * Actualiza una capacitación
   */
  async updateTraining(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const training = await TrainingService.updateTraining(id, updateData);

      res.json({
        success: true,
        message: 'Capacitación actualizada exitosamente',
        data: training
      });
    } catch (error) {
      console.error('Error en updateTraining:', error);

      if (error.message === 'Capacitación no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/training/:id
   * Elimina una capacitación
   */
  async deleteTraining(req, res) {
    try {
      const { id } = req.params;

      const result = await TrainingService.deleteTraining(id);

      res.json({
        success: true,
        message: result.mensaje
      });
    } catch (error) {
      console.error('Error en deleteTraining:', error);

      if (error.message === 'Capacitación no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/training/:id/enroll/:uid
   * Inscribe un empleado a una capacitación
   */
  async enrollEmployee(req, res) {
    try {
      const { id, uid } = req.params;

      // Obtener datos del empleado
      const user = await UserService.getUserByUid(uid);
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const participante = await TrainingService.enrollEmployee(id, {
        uid: user.uid,
        email: user.correo,
        nombre: user.nombre,
        departamento: user.departamento
      });

      // Registrar en auditoría
      await AuditService.log({
        accion: 'inscribir_empleado',
        entidad: 'capacitaciones',
        entidadId: id,
        ejecutadoPor: {
          uid: req.user.uid,
          email: req.user.email,
          nombre: req.user.roleData?.nombre || req.user.name || '',
          role: req.user.role
        },
        detalles: {
          empleadoAfectado: user.correo,
          empleadoNombre: user.nombre
        }
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Empleado inscrito exitosamente',
        data: participante
      });
    } catch (error) {
      console.error('Error en enrollEmployee:', error);

      if (error.message.includes('no encontrada') || error.message.includes('ya está inscrito')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/training/:id/enroll/:uid
   * Desinscribe un empleado de una capacitación
   */
  async unenrollEmployee(req, res) {
    try {
      const { id, uid } = req.params;

      const result = await TrainingService.unenrollEmployee(id, uid);

      res.json({
        success: true,
        message: result.mensaje
      });
    } catch (error) {
      console.error('Error en unenrollEmployee:', error);

      if (error.message.includes('no encontrada') || error.message.includes('no está inscrito')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/training/:id/complete/:uid
   * Actualiza el estado de un participante (completar, reprobar, etc.)
   */
  async updateParticipantStatus(req, res) {
    try {
      const { id, uid } = req.params;
      const { estado, calificacion } = req.body;

      if (!estado) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El campo estado es requerido'
        });
      }

      const participante = await TrainingService.updateParticipantStatus(id, uid, {
        estado,
        calificacion
      });

      res.json({
        success: true,
        message: 'Estado actualizado exitosamente',
        data: participante
      });
    } catch (error) {
      console.error('Error en updateParticipantStatus:', error);

      if (error.message.includes('no encontrada') || error.message.includes('no está inscrito')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/training/stats
   * Obtiene estadísticas de capacitaciones
   */
  async getTrainingStats(req, res) {
    try {
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;

      const stats = await TrainingService.getTrainingStats(departmentFilter);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getTrainingStats:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new TrainingController();
