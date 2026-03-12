import { Router } from 'express';
import PayrollController from '../controllers/PayrollController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminRHMiddleware } from '../middleware/role.middleware.js';

const router = Router();

/**
 * Rutas de Nómina
 *
 * Todas las rutas requieren autenticación.
 * Las rutas de modificación requieren rol de administrador.
 */

// ===== RUTAS DE AUTENTICACIÓN =====

/**
 * POST /api/v1/payroll/validate-password
 * Validar contraseña de acceso a nómina
 * Auth: Admin required
 */
router.post(
  '/validate-password',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.validatePassword
);

// ===== RUTAS DE EMPLEADO (Portal) =====

/**
 * GET /api/v1/payroll/my-projection
 * Obtener proyección de nómina del periodo actual
 * Auth: Cualquier empleado autenticado
 * Query params: ?mes=2&anio=2026&periodo=primera
 */
router.get(
  '/my-projection',
  authMiddleware,
  PayrollController.getMyProjection
);

/**
 * GET /api/v1/payroll/my-history
 * Obtener historial de nóminas del empleado autenticado
 * Auth: Cualquier empleado autenticado
 * Query params: ?anio=2026&mes=1
 */
router.get(
  '/my-history',
  authMiddleware,
  PayrollController.getMyPayrollHistory
);

// ===== RUTAS DE CÁLCULO =====

/**
 * POST /api/v1/payroll/calculate
 * Calcular nómina (no guarda)
 * Auth: Admin
 */
router.post(
  '/calculate',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.calculatePayroll
);

/**
 * POST /api/v1/payroll/save
 * Guardar nómina previamente calculada
 * Auth: Admin
 */
router.post(
  '/save',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.savePayroll
);

/**
 * POST /api/v1/payroll/calculate-and-save
 * Calcular y guardar nómina en un solo paso
 * Auth: Admin
 */
router.post(
  '/calculate-and-save',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.calculateAndSave
);

// ===== RUTAS DE CONSULTA =====

/**
 * GET /api/v1/payroll/employees
 * Obtener empleados con configuración de nómina
 * Auth: Admin
 * Query params: ?tipoNomina=quincenal
 */
router.get(
  '/employees',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.getEmployeesWithPayrollConfig
);

/**
 * GET /api/v1/payroll/weeks/:anio/:mes
 * Obtener semanas del mes (para nómina semanal)
 * Auth: Admin
 */
router.get(
  '/weeks/:anio/:mes',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.getWeeksOfMonth
);

/**
 * GET /api/v1/payroll/holidays/:anio
 * Obtener días festivos de un año
 * Auth: Admin
 */
router.get(
  '/holidays/:anio',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.getHolidays
);

/**
 * POST /api/v1/payroll/holidays
 * Guardar día festivo
 * Auth: Admin
 * Body: { "fecha": "2025-12-25", "nombre": "Navidad", "tipo": "federal" }
 */
router.post(
  '/holidays',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.saveHoliday
);

/**
 * DELETE /api/v1/payroll/holidays/:festivoId
 * Eliminar día festivo
 * Auth: Admin
 */
router.delete(
  '/holidays/:festivoId',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.deleteHoliday
);

/**
 * GET /api/v1/payroll/period/:mes/:anio
 * Obtener nóminas de un período específico
 * Auth: Admin
 * Query params: ?tipoNomina=quincenal
 */
router.get(
  '/period/:mes/:anio',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.getPayrollsByPeriod
);

/**
 * GET /api/v1/payroll/:periodoId
 * Obtener nómina guardada por ID
 * Auth: Admin
 */
router.get(
  '/:periodoId',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.getPayroll
);

// ===== RUTAS DE EDICIÓN =====

/**
 * PUT /api/v1/payroll/:periodoId/employee/:empleadoId/concept
 * Actualizar concepto manual en nómina de un empleado
 * Auth: Admin
 * Body: { "concepto": "bono", "valor": 500 }
 */
router.put(
  '/:periodoId/employee/:empleadoId/concept',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.updateManualConcept
);

// ===== RUTAS DE EMAILS =====

/**
 * POST /api/v1/payroll/send-emails
 * Enviar nóminas por correo electrónico a empleados
 * Auth: Admin
 * Body: {
 *   "nominasCalculadas": [...],
 *   "periodo": { "mes": 12, "anio": 2025, "quincena": "segunda" }
 * }
 */
router.post(
  '/send-emails',
  authMiddleware,
  adminRHMiddleware,
  PayrollController.sendPayrollEmails
);

export default router;
