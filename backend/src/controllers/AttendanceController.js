import AttendanceService from '../services/AttendanceService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';
import { isAdmin } from '../config/firebase.js';

class AttendanceController {
  constructor() {
    // Vincular métodos para que 'this' no se pierda al ser llamados por Express
    this.checkIn = this.checkIn.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getWeekly = this.getWeekly.bind(this);
    this.getToday = this.getToday.bind(this);
    this.getSummary = this.getSummary.bind(this);
    this.getMonthlyReport = this.getMonthlyReport.bind(this);
    this.getTodayRecord = this.getTodayRecord.bind(this);
  }

  // Helper para verificar si el usuario tiene permisos de admin (Email o Rol)
  _isUserAdmin(user) {
    return isAdmin(user.email) || user.role === ROLES.ADMIN_RH;
  }

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
   */
  async getHistory(req, res) {
    try {
      const { userId } = req.params;

      // Solo admins pueden ver historial de otros usuarios
      if (!this._isUserAdmin(req.user) && req.user.uid !== userId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado para ver este historial'
        });
      }

      const history = await AttendanceService.getHistory(
        userId,
        parseInt(req.query.limit) || 30,
        req.query.startDate,
        req.query.endDate
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

      if (!this._isUserAdmin(req.user) && req.user.uid !== userId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const weekly = await AttendanceService.getWeeklyAttendance(userId);

      res.json({
        success: true,
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
      if (!this._isUserAdmin(req.user)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Acceso restringido a administradores'
        });
      }

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

  /**
   * GET /api/v1/attendance/summary/:uid
   * Obtiene resumen de horas trabajadas (semana/mes)
   */
  async getSummary(req, res) {
    try {
      const { uid } = req.params;

      if (uid !== req.user.uid && !this._isUserAdmin(req.user)) {
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
      console.error('Error obteniendo resumen:', error);
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

      if (uid !== req.user.uid && !this._isUserAdmin(req.user)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const report = await AttendanceService.getMonthlyReport(uid, parseInt(year), parseInt(month));

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
   */
  async getTodayRecord(req, res) {
    try {
      const { uid } = req.params;

      if (uid !== req.user.uid && !this._isUserAdmin(req.user)) {
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
