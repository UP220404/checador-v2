import AttendanceService from '../services/AttendanceService.js';
import UserService from '../services/UserService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES, USUARIOS_REMOTOS } from '../config/constants.js';
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
    this.registerManual = this.registerManual.bind(this);
  }

  // Helper para verificar si el usuario tiene permisos de admin (Email o Rol)
  _normalizeEmail(email) {
    return (email || '').toString().trim().toLowerCase();
  }

  _isUserAdmin(user) {
    if (!user || !user.role) return false;
    const userRole = user.role.toLowerCase();
    const adminRoles = [
      ROLES.ADMIN_RH, 
      ROLES.SUPER_ADMIN, 
      ROLES.DIRECTOR, 
      ROLES.ADMIN_AREA
    ].map(r => r.toLowerCase());

    return isAdmin(user.email) || adminRoles.includes(userRole);
  }

  _isUserRemote(user) {
    if (!user) return false;
    if (user.remoto === true || user.remoto === 'true') return true;
    const email = this._normalizeEmail(user?.email || user?.correo);
    return USUARIOS_REMOTOS.some(remoteEmail => this._normalizeEmail(remoteEmail) === email);
  }

  /**
   * POST /api/v1/attendance/check-in
   * Registra entrada o salida
   */
  async checkIn(req, res) {
    try {
      const { qrCode, token, location } = req.body;
      const esRemoto = this._isUserRemote(req.user);

      if (!qrCode && !esRemoto) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      const result = await AttendanceService.checkIn(
        req.user.uid,
        { qrCode: qrCode || 'OFICINA2025', token },
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

      let today = await AttendanceService.getTodayAttendance();

      // Si es ADMIN_AREA, filtrar por departamento en el backend
      // Usa in-memory para evitar problemas de case-sensitivity en Firestore
      if (req.user.role?.toLowerCase() === ROLES.ADMIN_AREA && req.user.departamento) {
        const userDept = req.user.departamento.trim().toLowerCase();
        
        // Obtener TODOS los usuarios y filtrar en memoria (permite comparación flexible)
        const allUsers = await UserService.getAllUsers();
        const deptUserUIDs = new Set(
          allUsers
            .filter(u => u.departamento?.trim().toLowerCase() === userDept)
            .map(u => u.uid || u.id)
        );
        
        today = today.filter(reg => {
          // Registros nuevos traen campo 'departamento'
          if (reg.departamento) {
            return reg.departamento.trim().toLowerCase() === userDept;
          }
          // Registros antiguos sin campo 'departamento': verificar por UID
          return deptUserUIDs.has(reg.uid);
        });
      }

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

  /**
   * POST /api/v1/attendance/manual
   * Registra una asistencia manualmente (solo admin)
   */
  async registerManual(req, res) {
    try {
      const { uid, fecha, tipoEvento, hora, estado, observaciones } = req.body;

      if (!uid || !fecha || !tipoEvento || !hora || !estado) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Todos los campos son requeridos: Empleado, fecha, tipo de evento, hora y estado'
        });
      }

      // El usuario administrador realizando la acción está en req.user
      const result = await AttendanceService.registerManualAttendance(req.user, {
        uid,
        fecha,
        tipoEvento,
        hora,
        estado,
        observaciones
      });

      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      console.error('Error en registro manual de asistencia:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR,
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
}

export default new AttendanceController();
