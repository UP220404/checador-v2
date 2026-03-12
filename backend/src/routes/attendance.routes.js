/**
 * Rutas de Asistencias
 */

import express from 'express';
import AttendanceController from '../controllers/AttendanceController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * POST /api/v1/attendance/check-in
 * Registra entrada o salida
 * Requiere: autenticación
 */
router.post('/check-in', authMiddleware, AttendanceController.checkIn);

/**
 * GET /api/v1/attendance/history/:userId
 * Obtiene historial de asistencias de un usuario
 * Requiere: autenticación (admins pueden ver cualquiera, usuarios solo el suyo)
 */
router.get('/history/:userId', authMiddleware, AttendanceController.getHistory);

/**
 * GET /api/v1/attendance/weekly/:userId
 * Obtiene asistencias semanales de un usuario
 * Requiere: autenticación (admins pueden ver cualquiera, usuarios solo el suyo)
 */
router.get('/weekly/:userId', authMiddleware, AttendanceController.getWeekly);

/**
 * GET /api/v1/attendance/today
 * Obtiene todas las asistencias del día
 * Requiere: autenticación + admin
 */
router.get('/today', authMiddleware, adminMiddleware, AttendanceController.getToday);

// ============================================
// RUTAS PORTAL EMPLEADO V2
// ============================================

/**
 * GET /api/v1/attendance/summary/:uid
 * Obtiene resumen de horas trabajadas (semana/mes)
 * Requiere: autenticación (usuarios solo el suyo, admins cualquiera)
 */
router.get('/summary/:uid', authMiddleware, AttendanceController.getSummary);

/**
 * GET /api/v1/attendance/monthly/:uid/:year/:month
 * Obtiene reporte mensual detallado
 * Requiere: autenticación (usuarios solo el suyo, admins cualquiera)
 */
router.get('/monthly/:uid/:year/:month', authMiddleware, AttendanceController.getMonthlyReport);

/**
 * GET /api/v1/attendance/today-record/:uid
 * Obtiene el registro de hoy para un usuario
 * Requiere: autenticación (usuarios solo el suyo, admins cualquiera)
 */
router.get('/today-record/:uid', authMiddleware, AttendanceController.getTodayRecord);

export default router;
