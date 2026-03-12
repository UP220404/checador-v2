/**
 * Controlador de Auditoría
 */

import AuditService from '../services/AuditService.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';

class AuditController {
  /**
   * GET /api/v1/audit
   * Obtiene registros de auditoría con filtros
   */
  async getAuditLogs(req, res) {
    try {
      const { accion, entidad, ejecutadoPorEmail, fechaInicio, fechaFin, limit } = req.query;

      const filters = {};
      if (accion) filters.accion = accion;
      if (entidad) filters.entidad = entidad;
      if (ejecutadoPorEmail) filters.ejecutadoPorEmail = ejecutadoPorEmail;
      if (fechaInicio) filters.fechaInicio = fechaInicio;
      if (fechaFin) filters.fechaFin = fechaFin;

      const logs = await AuditService.getAuditLogs(filters, limit ? parseInt(limit) : 100);

      res.json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (error) {
      console.error('Error en getAuditLogs:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/audit/entity/:tipo/:id
   * Obtiene historial de una entidad específica
   */
  async getEntityHistory(req, res) {
    try {
      const { tipo, id } = req.params;

      const history = await AuditService.getEntityHistory(tipo, id);

      res.json({
        success: true,
        count: history.length,
        data: history
      });
    } catch (error) {
      console.error('Error en getEntityHistory:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/audit/stats
   * Obtiene estadísticas de auditoría
   */
  async getAuditStats(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const stats = await AuditService.getAuditStats(fechaInicio, fechaFin);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getAuditStats:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/audit/cleanup
   * Limpia registros de auditoría antiguos
   */
  async cleanupOldLogs(req, res) {
    try {
      const { daysOld } = req.query;

      const result = await AuditService.cleanupOldLogs(daysOld ? parseInt(daysOld) : 365);

      res.json({
        success: true,
        message: `${result.deleted} registros eliminados`
      });
    } catch (error) {
      console.error('Error en cleanupOldLogs:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new AuditController();
