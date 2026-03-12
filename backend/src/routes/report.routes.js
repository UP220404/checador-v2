/**
 * Rutas de Reportes
 */

import express from 'express';
import ReportController from '../controllers/ReportController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminAreaOrRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación y permisos de administrador (admin_area o admin_rh)
router.use(authMiddleware, adminAreaOrRHMiddleware);

// GET /api/v1/reports/daily - Reporte diario de asistencias
router.get('/daily', ReportController.getDailyReport.bind(ReportController));

// GET /api/v1/reports/weekly - Reporte semanal de asistencias
router.get('/weekly', ReportController.getWeeklyReport.bind(ReportController));

// GET /api/v1/reports/absences - Reporte de ausencias
router.get('/absences', ReportController.getAbsenceReport.bind(ReportController));

// GET /api/v1/reports/payroll/:periodoId - Reporte de nómina
router.get('/payroll/:periodoId', ReportController.getPayrollReport.bind(ReportController));

// Exportaciones

// GET /api/v1/reports/export/attendance-excel - Exportar asistencias a Excel
router.get('/export/attendance-excel', ReportController.exportAttendanceExcel.bind(ReportController));

// GET /api/v1/reports/export/payroll-excel/:periodoId - Exportar nómina a Excel
router.get('/export/payroll-excel/:periodoId', ReportController.exportPayrollExcel.bind(ReportController));

// GET /api/v1/reports/export/absences-pdf - Exportar ausencias a PDF
router.get('/export/absences-pdf', ReportController.exportAbsencesPDF.bind(ReportController));

// Rankings
// POST /api/v1/reports/generate-rankings - Generar rankings mensuales faltantes
router.post('/generate-rankings', ReportController.generateMissingRankings.bind(ReportController));

// Analytics
// GET /api/v1/reports/analytics - Resumen optimizado para dashboard de análisis
router.get('/analytics', ReportController.getAnalyticsSummary.bind(ReportController));

export default router;
