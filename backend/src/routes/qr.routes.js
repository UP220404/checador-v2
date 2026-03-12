/**
 * Rutas de QR Tokens
 */

import express from 'express';
import QRController from '../controllers/QRController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

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
router.post('/generate', authMiddleware, adminMiddleware, QRController.generateToken);

/**
 * POST /api/v1/qr/validate
 * Valida un token QR (usado internamente)
 * Requiere: autenticación
 * Body: { qrCode: string, token: string }
 */
router.post('/validate', authMiddleware, QRController.validateToken);

/**
 * GET /api/v1/qr/stats
 * Obtiene estadísticas de uso de QR
 * Requiere: autenticación + admin
 * Query: ?fecha=YYYY-MM-DD (opcional)
 */
router.get('/stats', authMiddleware, adminMiddleware, QRController.getStats);

export default router;
