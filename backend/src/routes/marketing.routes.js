import express from 'express';
import MarketingController from '../controllers/MarketingController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { marketingMiddleware } from '../middleware/role.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/v1/marketing/carousel
 * Obtiene las imágenes del carrusel (todos los empleados pueden verlas para el QR)
 */
router.get('/carousel', MarketingController.getCarouselImages);

/**
 * POST /api/v1/marketing/carousel
 * Sube una nueva imagen (Solo Marketing/Admin)
 */
router.post('/carousel', marketingMiddleware, uploadSingle, MarketingController.uploadCarouselImage);

/**
 * PATCH /api/v1/marketing/carousel/:id
 * Actualiza una imagen (Solo Marketing/Admin)
 */
router.patch('/carousel/:id', marketingMiddleware, uploadSingle, MarketingController.updateCarouselImage);

/**
 * DELETE /api/v1/marketing/carousel/:id
 * Elimina una imagen (Solo Marketing/Admin)
 */
router.delete('/carousel/:id', marketingMiddleware, MarketingController.deleteCarouselImage);

export default router;
