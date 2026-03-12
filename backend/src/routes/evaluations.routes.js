/**
 * Rutas de Evaluaciones de Desempeño
 */

import express from 'express';
import EvaluationController from '../controllers/EvaluationController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS
// ============================================

// GET /api/v1/evaluations/my - Mis evaluaciones (completadas/revisadas)
router.get('/my', EvaluationController.getMyEvaluations);

// ============================================
// RUTAS PARA ADMINISTRADORES
// ============================================

// GET /api/v1/evaluations/stats - Estadísticas de evaluaciones
router.get('/stats', adminAreaOrRHMiddleware, EvaluationController.getEvaluationStats);

// GET /api/v1/evaluations/employee/:uid - Evaluaciones de un empleado
router.get('/employee/:uid', adminAreaOrRHMiddleware, EvaluationController.getEvaluationsByEmployee);

// GET /api/v1/evaluations - Todas las evaluaciones (filtradas por departamento si admin_area)
router.get('/', adminAreaOrRHMiddleware, EvaluationController.getAllEvaluations);

// GET /api/v1/evaluations/:id - Evaluación por ID
router.get('/:id', EvaluationController.getEvaluationById);

// POST /api/v1/evaluations - Crear evaluación
router.post('/', adminAreaOrRHMiddleware, EvaluationController.createEvaluation);

// PUT /api/v1/evaluations/:id - Actualizar evaluación
router.put('/:id', adminAreaOrRHMiddleware, EvaluationController.updateEvaluation);

// DELETE /api/v1/evaluations/:id - Eliminar evaluación (solo borradores)
router.delete('/:id', adminAreaOrRHMiddleware, EvaluationController.deleteEvaluation);

export default router;
