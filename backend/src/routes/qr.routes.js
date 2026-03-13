/**
 * Rutas de QR Tokens
 */

import express from 'express';
import QRController from '../controllers/QRController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData } from '../middleware/role.middleware.js';

const router = express.Router();

// Carga de roles para todas las rutas
router.use(authMiddleware);
router.use(attachRoleData);

/**
 * GET /api/v1/qr/current
 * Obtiene el token QR actual
 * Requiere: autenticación
 */
router.get('/current', authMiddleware, QRController.getCurrentToken);

/**
 * POST /api/v1/qr/generate
 * Genera un nuevo token QR
 * Requiere: autenticación + admin
 * Body: { modo: 'dinamico' | 'estatico', duracionMinutos: number }
 */
router.post('/generate', adminMiddleware, QRController.generateToken);

/**
 * POST /api/v1/qr/validate
 * Valida un token QR (usado internamente)
 * Requiere: autenticación
 * Body: { qrCode: string, token: string }
 */
router.post('/validate', QRController.validateToken);

/**
 * GET /api/v1/qr/stats
 * Obtiene estadísticas de uso de QR
 * Requiere: autenticación + admin
 * Query: ?fecha=YYYY-MM-DD (opcional)
 */
router.get('/stats', adminMiddleware, QRController.getStats);

export default router;
