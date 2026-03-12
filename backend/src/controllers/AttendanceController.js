/**
 * Controlador de Asistencias
 */

import AttendanceService from '../services/AttendanceService.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';
import { isAdmin } from '../config/firebase.js';

class AttendanceController {
  /**
   * POST /api/v1/attendance/check-in
   * Registra entrada o salida
   */
  async checkIn(req, res) {
    try {
      const { qrCode, token, location } = req.body;

      if (!qrCode) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      const result = await AttendanceService.checkIn(
        req.user.uid,
        { qrCode, token },
        location
      );

      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(result);
      }

      res.status(HTTP_STATUS.CREATED).json(result);

    } catch (error) {
      console.error('Error en check-in:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR,
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  /**
   * GET /api/v1/attendance/history/:userId
   * Obtiene historial de asistencias de un usuario
   * Query params: limit, startDate, endDate (YYYY-MM-DD)
   */
  async getHistory(req, res) {
    try {
      const { userId } = req.params;
      const { limit, startDate, endDate } = req.query;

      // Solo admins pueden ver historial de otros usuarios
      if (!isAdmin(req.user.email) && req.user.uid !== userId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado para ver este historial'
        });
      }

      const history = await AttendanceService.getHistory(
        userId,
        parseInt(limit) || 30,
        startDate,
        endDate
      );

      res.json({
        success: true,
        count: history.length,
        data: history
      });

    } catch (error) {
      console.error('Error obteniendo historial:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/attendance/weekly/:userId
   * Obtiene asistencias semanales de un usuario
   */
  async getWeekly(req, res) {
    try {
      const { userId } = req.params;

      // Solo admins pueden ver asistencias de otros usuarios
      if (!isAdmin(req.user.email) && req.user.uid !== userId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado para ver estas asistencias'
        });
      }

      const weekly = await AttendanceService.getWeeklyAttendance(userId);

      res.json({
        success: true,
        count: weekly.length,
        data: weekly
      });

    } catch (error) {
      console.error('Error obteniendo asistencias semanales:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/attendance/today
   * Obtiene todas las asistencias del día (solo admin)
   */
  async getToday(req, res) {
    try {
      const today = await AttendanceService.getTodayAttendance();

      res.json({
        success: true,
        count: today.length,
        data: today
      });

    } catch (error) {
      console.error('Error obteniendo asistencias del día:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  // ============================================
  // MÉTODOS PARA PORTAL EMPLEADO V2
  // ============================================

  /**
   * GET /api/v1/attendance/summary/:uid
   * Obtiene resumen de horas trabajadas (semana/mes)
   */
  async getSummary(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede ver su propio resumen (o admin)
      if (uid !== userUid && !isAdmin(req.user.email)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const summary = await AttendanceService.getAttendanceSummary(uid);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error obteniendo resumen de asistencia:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/attendance/monthly/:uid/:year/:month
   * Obtiene reporte mensual detallado
   */
  async getMonthlyReport(req, res) {
    try {
      const { uid, year, month } = req.params;
      const userUid = req.user.uid;

      // Solo puede ver su propio reporte (o admin)
      if (uid !== userUid && !isAdmin(req.user.email)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      // Validar año y mes
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Año o mes inválido'
        });
      }

      const report = await AttendanceService.getMonthlyReport(uid, yearNum, monthNum);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error obteniendo reporte mensual:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/attendance/today-record/:uid
   * Obtiene el registro de hoy para un usuario
   */
  async getTodayRecord(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede ver su propio registro (o admin)
      if (uid !== userUid && !isAdmin(req.user.email)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const record = await AttendanceService.getTodayRecord(uid);

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error('Error obteniendo registro de hoy:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new AttendanceController();
