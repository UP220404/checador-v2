/**
 * Rutas de Documentos de Empleados
 */

import express from 'express';
import DocumentController from '../controllers/DocumentController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware } from '../middleware/role.middleware.js';
import { uploadDocument } from '../middleware/upload.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS
// ============================================

// GET /api/v1/documents/my - Mis documentos
router.get('/my', DocumentController.getMyDocuments);

// GET /api/v1/documents/my/payroll - Mis recibos de nómina
router.get('/my/payroll', DocumentController.getMyPayrollReceipts);

// GET /api/v1/documents/my/count - Conteo de mis documentos
router.get('/my/count', DocumentController.getMyDocumentCount);

// GET /api/v1/documents/:id - Obtener documento específico
router.get('/:id', DocumentController.getDocument);

// ============================================
// RUTAS PARA ADMINISTRADORES
// ============================================

// GET /api/v1/documents/user/:uid - Documentos de un usuario específico
router.get('/user/:uid', adminAreaOrRHMiddleware, DocumentController.getUserDocuments);

// GET /api/v1/documents/admin/counts - Conteos globales (admin)
router.get('/admin/counts', adminMiddleware, DocumentController.getGlobalCounts);

// POST /api/v1/documents/upload - Subir documento (con archivo)
router.post('/upload', adminMiddleware, uploadDocument, DocumentController.uploadDocument);

// PUT /api/v1/documents/:id - Actualizar documento
router.put('/:id', adminMiddleware, DocumentController.updateDocument);

// DELETE /api/v1/documents/:id - Eliminar documento
router.delete('/:id', adminMiddleware, DocumentController.deleteDocument);

export default router;
