/**
 * Controlador de Evaluaciones de Contrato
 */

import ContractEvaluationService from '../services/ContractEvaluationService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class ContractEvaluationController {
  /**
   * GET /api/v1/contract-evaluations
   * Listar evaluaciones con filtros
   */
  async getEvaluations(req, res) {
    try {
      const filters = {
        estado: req.query.estado,
        tipoEvaluacion: req.query.tipoEvaluacion,
        empleadoUid: req.query.empleadoUid
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      // Determinar filtro de departamento para admin_area
      let departmentFilter = null;
      if (req.user.role === ROLES.ADMIN_AREA && req.user.departamento) {
        departmentFilter = req.user.departamento;
      }

      const evaluaciones = await ContractEvaluationService.getEvaluations(filters, departmentFilter);

      res.json({
        success: true,
        count: evaluaciones.length,
        data: evaluaciones
      });
    } catch (error) {
      console.error('Error en getEvaluations:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/contract-evaluations/pending
   * Obtener evaluaciones pendientes
   */
  async getPendingEvaluations(req, res) {
    try {
      // Determinar filtro de departamento para admin_area
      let departmentFilter = null;
      if (req.user.role === ROLES.ADMIN_AREA && req.user.departamento) {
        departmentFilter = req.user.departamento;
      }

      const evaluaciones = await ContractEvaluationService.getPendingEvaluations(departmentFilter);

      res.json({
        success: true,
        count: evaluaciones.length,
        data: evaluaciones
      });
    } catch (error) {
      console.error('Error en getPendingEvaluations:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/contract-evaluations/stats
   * Obtener estadísticas de evaluaciones
   */
  async getStats(req, res) {
    try {
      const stats = await ContractEvaluationService.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getStats:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/contract-evaluations/:id
   * Obtener una evaluación por ID
   */
  async getEvaluationById(req, res) {
    try {
      const { id } = req.params;
      const evaluacion = await ContractEvaluationService.getEvaluationById(id);

      if (!evaluacion) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Evaluación no encontrada'
        });
      }

      res.json({
        success: true,
        data: evaluacion
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
   * POST /api/v1/contract-evaluations/:id/complete
   * Completar una evaluación
   */
  async completeEvaluation(req, res) {
    try {
      const { id } = req.params;
      const { resultado, comentarios } = req.body;

      if (!resultado || !['aprobado', 'rechazado'].includes(resultado)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Resultado inválido. Debe ser "aprobado" o "rechazado"'
        });
      }

      const evaluador = {
        uid: req.user.uid,
        email: req.user.email,
        nombre: req.user.name || req.user.email
      };

      const evaluacion = await ContractEvaluationService.completeEvaluation(
        id,
        resultado,
        evaluador,
        comentarios || ''
      );

      res.json({
        success: true,
        message: `Evaluación completada. Resultado: ${resultado}`,
        data: evaluacion
      });
    } catch (error) {
      console.error('Error en completeEvaluation:', error);

      if (error.message === 'Evaluación no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'La evaluación ya fue completada') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/users/:uid/initialize-contract
   * Inicializar contrato para un empleado
   */
  async initializeContract(req, res) {
    try {
      const { uid } = req.params;
      const { fechaIngreso } = req.body;

      if (!fechaIngreso) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Fecha de ingreso es requerida'
        });
      }

      const contrato = await ContractEvaluationService.initializeContract(uid, fechaIngreso);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Contrato inicializado correctamente',
        data: contrato
      });
    } catch (error) {
      console.error('Error en initializeContract:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/contract-evaluations/check-pending
   * Verificar evaluaciones pendientes (manual trigger)
   */
  async checkPendingEvaluations(req, res) {
    try {
      // Sincronizar evaluaciones pendientes (corrige fechas y datos de empleado)
      const recalcResult = await ContractEvaluationService.syncPendingEvaluations();

      const result = await ContractEvaluationService.checkPendingEvaluations();

      res.json({
        success: true,
        message: `Verificación completada. ${result.checked} evaluaciones revisadas. ${recalcResult.updated} fechas corregidas.`,
        data: { ...result, recalculated: recalcResult.updated }
      });
    } catch (error) {
      console.error('Error en checkPendingEvaluations:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new ContractEvaluationController();
