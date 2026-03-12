/**
 * Rutas de Configuracion del Sistema
 */

import express from 'express';
import SettingsController from '../controllers/SettingsController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticacion y permisos de admin
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/v1/settings - Obtener todas las configuraciones
router.get('/', SettingsController.getAllSettings);

// GET /api/v1/settings/:category - Obtener configuracion por categoria
router.get('/:category', SettingsController.getSettings);

// PUT /api/v1/settings/:category - Actualizar configuracion por categoria
router.put('/:category', SettingsController.updateSettings);

// ============================================
// TIPOS DE AUSENCIA
// ============================================

// POST /api/v1/settings/ausencias/tipos - Agregar tipo de ausencia
router.post('/ausencias/tipos', SettingsController.addAbsenceType);

// PUT /api/v1/settings/ausencias/tipos/:typeId - Actualizar tipo de ausencia
router.put('/ausencias/tipos/:typeId', SettingsController.updateAbsenceType);

// DELETE /api/v1/settings/ausencias/tipos/:typeId - Eliminar tipo de ausencia
router.delete('/ausencias/tipos/:typeId', SettingsController.deleteAbsenceType);

// ============================================
// DEPARTAMENTOS
// ============================================

// POST /api/v1/settings/departamentos - Agregar departamento
router.post('/departamentos', SettingsController.addDepartment);

// DELETE /api/v1/settings/departamentos/:nombre - Eliminar departamento
router.delete('/departamentos/:nombre', SettingsController.removeDepartment);

export default router;
