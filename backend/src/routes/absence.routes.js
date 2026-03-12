/**
 * Rutas de Ausencias
 */

import express from 'express';
import AbsenceController from '../controllers/AbsenceController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticacion
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS (Portal del Empleado)
// ============================================

// POST /api/v1/absences/request - Empleado crea su propia solicitud
router.post('/request', AbsenceController.createEmployeeRequest);

// GET /api/v1/absences/my-requests - Empleado ve sus solicitudes
router.get('/my-requests', AbsenceController.getMyRequests);

// DELETE /api/v1/absences/my-requests/:id - Empleado cancela solicitud pendiente
router.delete('/my-requests/:id', AbsenceController.cancelMyRequest);

// ============================================
// RUTAS PARA ADMINISTRADORES (admin_rh y admin_area)
// ============================================

// GET /api/v1/absences/urgent - Obtener solicitudes urgentes (emergencias o poca anticipacion)
router.get('/urgent', adminAreaOrRHMiddleware, AbsenceController.getUrgentRequests);

// GET /api/v1/absences/stats - Obtener estadisticas de ausencias
router.get('/stats', adminAreaOrRHMiddleware, AbsenceController.getAbsenceStats);

// GET /api/v1/absences/retardos/:emailUsuario - Obtener retardos de un usuario
router.get('/retardos/:emailUsuario', adminAreaOrRHMiddleware, AbsenceController.getRetardosByUser);

// GET /api/v1/absences - Listar ausencias con filtros
router.get('/', adminAreaOrRHMiddleware, AbsenceController.getAbsences);

// GET /api/v1/absences/:id - Obtener ausencia especifica
router.get('/:id', adminAreaOrRHMiddleware, AbsenceController.getAbsenceById);

// POST /api/v1/absences - Crear nueva ausencia
router.post('/', adminAreaOrRHMiddleware, AbsenceController.createAbsence);

// PUT /api/v1/absences/:id - Actualizar ausencia
router.put('/:id', adminAreaOrRHMiddleware, AbsenceController.updateAbsence);

// PUT /api/v1/absences/:id/approve - Aprobar ausencia
router.put('/:id/approve', adminAreaOrRHMiddleware, AbsenceController.approveAbsence);

// PUT /api/v1/absences/:id/reject - Rechazar ausencia
router.put('/:id/reject', adminAreaOrRHMiddleware, AbsenceController.rejectAbsence);

// PUT /api/v1/absences/:id/revert-correction - Revertir correccion de hora
router.put('/:id/revert-correction', adminAreaOrRHMiddleware, AbsenceController.revertCorrection);

// DELETE /api/v1/absences/:id - Eliminar ausencia
router.delete('/:id', adminAreaOrRHMiddleware, AbsenceController.deleteAbsence);

export default router;
