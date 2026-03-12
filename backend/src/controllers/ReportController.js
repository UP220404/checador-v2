/**
 * Controlador de Reportes
 */

import ReportService from '../services/ReportService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class ReportController {
  /**
   * Filtra los registros por departamento si el usuario es admin_area
   */
  filterByDepartment(data, req) {
    if (req.user.role !== ROLES.ADMIN_AREA || !req.user.departamento) {
      return data;
    }

    const departamento = req.user.departamento;

    // Si es un objeto con registros por usuario
    if (data.registros && typeof data.registros === 'object' && !Array.isArray(data.registros)) {
      const filteredRegistros = {};
      Object.entries(data.registros).forEach(([email, userData]) => {
        if (userData.departamento === departamento) {
          filteredRegistros[email] = userData;
        }
      });
      return { ...data, registros: filteredRegistros };
    }

    // Si es un objeto con usuarios
    if (data.usuarios && typeof data.usuarios === 'object') {
      const filteredUsuarios = {};
      Object.entries(data.usuarios).forEach(([email, userData]) => {
        if (userData.departamento === departamento) {
          filteredUsuarios[email] = userData;
        }
      });
      return { ...data, usuarios: filteredUsuarios };
    }

    // Si es un objeto con ausencias (array)
    if (data.ausencias && Array.isArray(data.ausencias)) {
      return {
        ...data,
        ausencias: data.ausencias.filter(a => a.departamentoUsuario === departamento)
      };
    }

    return data;
  }

  /**
   * GET /api/v1/reports/daily
   * Generar reporte diario de asistencias
   * Query params: fecha (YYYY-MM-DD)
   */
  async getDailyReport(req, res) {
    try {
      const { fecha } = req.query;

      if (!fecha) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere el parámetro fecha (YYYY-MM-DD)'
        });
      }

      let reporte = await ReportService.generateDailyAttendanceReport(fecha);

      // Filtrar por departamento si es admin_area
      reporte = this.filterByDepartment(reporte, req);

      res.json({
        success: true,
        data: reporte
      });
    } catch (error) {
      console.error('Error en getDailyReport:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/reports/weekly
   * Generar reporte semanal de asistencias
   * Query params: fechaInicio, fechaFin (YYYY-MM-DD)
   */
  async getWeeklyReport(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      if (!fechaInicio || !fechaFin) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requieren los parámetros fechaInicio y fechaFin (YYYY-MM-DD)'
        });
      }

      let reporte = await ReportService.generateWeeklyAttendanceReport(fechaInicio, fechaFin);

      // Filtrar por departamento si es admin_area
      reporte = this.filterByDepartment(reporte, req);

      res.json({
        success: true,
        data: reporte
      });
    } catch (error) {
      console.error('Error en getWeeklyReport:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/reports/absences
   * Generar reporte de ausencias
   * Query params: mes, anio
   */
  async getAbsenceReport(req, res) {
    try {
      const { mes, anio } = req.query;

      if (!mes || !anio) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requieren los parámetros mes y anio'
        });
      }

      let reporte = await ReportService.generateAbsenceReport(mes, anio);

      // Filtrar por departamento si es admin_area
      reporte = this.filterByDepartment(reporte, req);

      res.json({
        success: true,
        data: reporte
      });
    } catch (error) {
      console.error('Error en getAbsenceReport:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/reports/payroll/:periodoId
   * Generar reporte de nómina
   */
  async getPayrollReport(req, res) {
    try {
      const { periodoId } = req.params;

      const reporte = await ReportService.generatePayrollReport(periodoId);

      res.json({
        success: true,
        data: reporte
      });
    } catch (error) {
      console.error('Error en getPayrollReport:', error);

      if (error.message === 'Nómina no encontrada') {
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
   * GET /api/v1/reports/export/attendance-excel
   * Exportar reporte de asistencias a Excel
   * Query params: fechaInicio, fechaFin
   */
  async exportAttendanceExcel(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      if (!fechaInicio || !fechaFin) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requieren los parámetros fechaInicio y fechaFin'
        });
      }

      const buffer = await ReportService.exportAttendanceToExcel(fechaInicio, fechaFin);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=asistencias_${fechaInicio}_${fechaFin}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error en exportAttendanceExcel:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/reports/export/payroll-excel/:periodoId
   * Exportar nómina a Excel
   */
  async exportPayrollExcel(req, res) {
    try {
      const { periodoId } = req.params;

      const buffer = await ReportService.exportPayrollToExcel(periodoId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=nomina_${periodoId}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error en exportPayrollExcel:', error);

      if (error.message === 'Nómina no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
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
   * GET /api/v1/reports/export/absences-pdf
   * Exportar ausencias a PDF
   * Query params: mes, anio
   */
  async exportAbsencesPDF(req, res) {
    try {
      const { mes, anio } = req.query;

      if (!mes || !anio) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requieren los parámetros mes y anio'
        });
      }

      const buffer = await ReportService.exportAbsencesToPDF(mes, anio);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ausencias_${mes}_${anio}.pdf`);
      res.send(buffer);
    } catch (error) {
      console.error('Error en exportAbsencesPDF:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/reports/generate-rankings
   * Generar rankings mensuales faltantes
   */
  async generateMissingRankings(req, res) {
    try {
      console.log('Generando rankings mensuales faltantes...');
      const result = await ReportService.generateMissingRankings();

      res.json({
        success: true,
        message: `Se generaron ${result.rankingsGenerados} rankings mensuales`,
        data: result
      });
    } catch (error) {
      console.error('Error en generateMissingRankings:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/reports/analytics
   * Obtener resumen optimizado para dashboard de análisis
   * Incluye: ranking de puntualidad, tendencia mensual, top usuarios
   */
  async getAnalyticsSummary(req, res) {
    try {
      console.log('[API] Solicitando resumen de análisis optimizado...');
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;
      const summary = await ReportService.generateAnalyticsSummary(departmentFilter);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error en getAnalyticsSummary:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new ReportController();
