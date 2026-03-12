/**
 * Rutas de Evaluaciones de Contrato
 */

import express from 'express';
import ContractEvaluationController from '../controllers/ContractEvaluationController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware, adminRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA ADMINISTRADORES (admin_rh y admin_area)
// ============================================

// GET /api/v1/contract-evaluations/stats - Estadísticas
router.get('/stats', adminAreaOrRHMiddleware, ContractEvaluationController.getStats);

// GET /api/v1/contract-evaluations/pending - Evaluaciones pendientes
router.get('/pending', adminAreaOrRHMiddleware, ContractEvaluationController.getPendingEvaluations);

// POST /api/v1/contract-evaluations/check-pending - Verificar manualmente (solo admin_rh)
router.post('/check-pending', adminRHMiddleware, ContractEvaluationController.checkPendingEvaluations);

// GET /api/v1/contract-evaluations - Listar todas las evaluaciones
router.get('/', adminAreaOrRHMiddleware, ContractEvaluationController.getEvaluations);

// GET /api/v1/contract-evaluations/:id - Obtener una evaluación
router.get('/:id', adminAreaOrRHMiddleware, ContractEvaluationController.getEvaluationById);

// POST /api/v1/contract-evaluations/:id/complete - Completar evaluacion (solo admin_rh)
router.post('/:id/complete', adminRHMiddleware, ContractEvaluationController.completeEvaluation);

export default router;
