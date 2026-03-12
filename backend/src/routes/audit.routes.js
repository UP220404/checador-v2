/**
 * Rutas de Auditoría
 */

import express from 'express';
import AuditController from '../controllers/AuditController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol admin_rh
router.use(authMiddleware, adminRHMiddleware);

// GET /api/v1/audit - Obtener registros de auditoría
router.get('/', AuditController.getAuditLogs);

// GET /api/v1/audit/stats - Estadísticas de auditoría
router.get('/stats', AuditController.getAuditStats);

// GET /api/v1/audit/entity/:tipo/:id - Historial de una entidad
router.get('/entity/:tipo/:id', AuditController.getEntityHistory);

// POST /api/v1/audit/cleanup - Limpiar registros antiguos
router.post('/cleanup', AuditController.cleanupOldLogs);

export default router;
