/**
 * Rutas de Capacitaciones
 */

import express from 'express';
import TrainingController from '../controllers/TrainingController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware, adminRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS
// ============================================

// GET /api/v1/training/my - Mis capacitaciones (donde estoy inscrito)
router.get('/my', TrainingController.getMyTrainings);

// ============================================
// RUTAS PARA ADMINISTRADORES
// ============================================

// GET /api/v1/training/stats - Estadísticas de capacitaciones
router.get('/stats', adminAreaOrRHMiddleware, TrainingController.getTrainingStats);

// GET /api/v1/training - Listar capacitaciones
router.get('/', adminAreaOrRHMiddleware, TrainingController.getAllTrainings);

// GET /api/v1/training/:id - Obtener capacitación por ID
router.get('/:id', TrainingController.getTrainingById);

// POST /api/v1/training - Crear capacitación (solo admin_rh puede crear para todos)
router.post('/', adminRHMiddleware, TrainingController.createTraining);

// PUT /api/v1/training/:id - Actualizar capacitación
router.put('/:id', adminRHMiddleware, TrainingController.updateTraining);

// DELETE /api/v1/training/:id - Eliminar capacitación
router.delete('/:id', adminRHMiddleware, TrainingController.deleteTraining);

// POST /api/v1/training/:id/enroll/:uid - Inscribir empleado
router.post('/:id/enroll/:uid', adminAreaOrRHMiddleware, TrainingController.enrollEmployee);

// DELETE /api/v1/training/:id/enroll/:uid - Desinscribir empleado
router.delete('/:id/enroll/:uid', adminAreaOrRHMiddleware, TrainingController.unenrollEmployee);

// PUT /api/v1/training/:id/complete/:uid - Actualizar estado de participante
router.put('/:id/complete/:uid', adminAreaOrRHMiddleware, TrainingController.updateParticipantStatus);

export default router;
