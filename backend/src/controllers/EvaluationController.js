/**
 * Controlador de Evaluaciones de Desempeño
 */

import EvaluationService from '../services/EvaluationService.js';
import AuditService from '../services/AuditService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class EvaluationController {
  /**
   * GET /api/v1/evaluations
   * Obtiene todas las evaluaciones (filtradas por departamento si es admin_area)
   */
  async getAllEvaluations(req, res) {
    try {
      const { estado } = req.query;
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;

      const evaluations = await EvaluationService.getEvaluations(
        { estado },
        departmentFilter
      );

      res.json({
        success: true,
        count: evaluations.length,
        data: evaluations
      });
    } catch (error) {
      console.error('Error en getAllEvaluations:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/evaluations/employee/:uid
   * Obtiene las evaluaciones de un empleado específico
   */
  async getEvaluationsByEmployee(req, res) {
    try {
      const { uid } = req.params;

      const evaluations = await EvaluationService.getEvaluationsByEmployee(uid);

      res.json({
        success: true,
        count: evaluations.length,
        data: evaluations
      });
    } catch (error) {
      console.error('Error en getEvaluationsByEmployee:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/evaluations/my
   * Obtiene las evaluaciones del usuario actual (empleado)
   */
  async getMyEvaluations(req, res) {
    try {
      const uid = req.user.uid;

      // Solo mostrar evaluaciones completadas o revisadas al empleado
      const allEvaluations = await EvaluationService.getEvaluationsByEmployee(uid);
      const evaluations = allEvaluations.filter(e => e.estado !== 'borrador');

      res.json({
        success: true,
        count: evaluations.length,
        data: evaluations
      });
    } catch (error) {
      console.error('Error en getMyEvaluations:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/evaluations/:id
   * Obtiene una evaluación por ID
   */
  async getEvaluationById(req, res) {
    try {
      const { id } = req.params;

      const evaluation = await EvaluationService.getEvaluationById(id);

      if (!evaluation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Evaluación no encontrada'
        });
      }

      // Si es empleado, solo puede ver sus propias evaluaciones completadas
      if (req.user.role === ROLES.EMPLEADO) {
        if (evaluation.empleadoUid !== req.user.uid) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'No autorizado'
          });
        }
        if (evaluation.estado === 'borrador') {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Esta evaluación aún no está disponible'
          });
        }
      }

      // Si es admin_area, solo puede ver evaluaciones de su departamento
      if (req.user.role === ROLES.ADMIN_AREA) {
        if (evaluation.departamento !== req.user.departamento) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'No autorizado para ver evaluaciones de otro departamento'
          });
        }
      }

      res.json({
        success: true,
        data: evaluation
      });
    } catch (error) {
      console.error('Error en getEvaluationById:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/evaluations
   * Crea una nueva evaluación
   */
  async createEvaluation(req, res) {
    try {
      const evaluationData = {
        ...req.body,
        evaluador: {
          uid: req.user.uid,
          email: req.user.email,
          nombre: req.user.roleData?.nombre || req.user.name || ''
        }
      };

      // Si es admin_area, asignar el departamento
      if (req.user.role === ROLES.ADMIN_AREA) {
        evaluationData.departamento = req.user.departamento;
      }

      const evaluation = await EvaluationService.createEvaluation(evaluationData);

      // Registrar en auditoría
      await AuditService.logEvaluationAction(
        'crear_evaluacion',
        evaluation.id,
        { empleadoEmail: evaluationData.empleadoEmail },
        {
          uid: req.user.uid,
          email: req.user.email,
          nombre: req.user.roleData?.nombre || req.user.name || '',
          role: req.user.role
        }
      );

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Evaluación creada exitosamente',
        data: evaluation
      });
    } catch (error) {
      console.error('Error en createEvaluation:', error);

      if (error.message.includes('requeridos')) {
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
   * PUT /api/v1/evaluations/:id
   * Actualiza una evaluación
   */
  async updateEvaluation(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar que la evaluación exista
      const evaluation = await EvaluationService.getEvaluationById(id);
      if (!evaluation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Evaluación no encontrada'
        });
      }

      // Si es admin_area, verificar departamento
      if (req.user.role === ROLES.ADMIN_AREA) {
        if (evaluation.departamento !== req.user.departamento) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'No autorizado para modificar evaluaciones de otro departamento'
          });
        }
      }

      const updated = await EvaluationService.updateEvaluation(id, updateData);

      res.json({
        success: true,
        message: 'Evaluación actualizada exitosamente',
        data: updated
      });
    } catch (error) {
      console.error('Error en updateEvaluation:', error);

      if (error.message === 'Evaluación no encontrada') {
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
   * DELETE /api/v1/evaluations/:id
   * Elimina una evaluación (solo borradores)
   */
  async deleteEvaluation(req, res) {
    try {
      const { id } = req.params;

      // Verificar que la evaluación exista
      const evaluation = await EvaluationService.getEvaluationById(id);
      if (!evaluation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Evaluación no encontrada'
        });
      }

      // Si es admin_area, verificar departamento
      if (req.user.role === ROLES.ADMIN_AREA) {
        if (evaluation.departamento !== req.user.departamento) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'No autorizado para eliminar evaluaciones de otro departamento'
          });
        }
      }

      const result = await EvaluationService.deleteEvaluation(id);

      res.json({
        success: true,
        message: result.mensaje
      });
    } catch (error) {
      console.error('Error en deleteEvaluation:', error);

      if (error.message.includes('no encontrada') || error.message.includes('borrador')) {
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
   * GET /api/v1/evaluations/stats
   * Obtiene estadísticas de evaluaciones
   */
  async getEvaluationStats(req, res) {
    try {
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;

      const stats = await EvaluationService.getEvaluationStats(departmentFilter);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getEvaluationStats:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new EvaluationController();
