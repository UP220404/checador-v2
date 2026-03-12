/**
 * Rutas de Notificaciones
 */

import express from 'express';
import NotificationController from '../controllers/NotificationController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware, adminRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS
// ============================================

// GET /api/v1/notifications/my - Mis notificaciones
router.get('/my', NotificationController.getMyNotifications);

// GET /api/v1/notifications/unread-count - Conteo de no leídas
router.get('/unread-count', NotificationController.getUnreadCount);

// PUT /api/v1/notifications/:id/read - Marcar como leída
router.put('/:id/read', NotificationController.markAsRead);

// PUT /api/v1/notifications/read-all - Marcar todas como leídas
router.put('/read-all', NotificationController.markAllAsRead);

// DELETE /api/v1/notifications/:id - Eliminar notificación
router.delete('/:id', NotificationController.deleteNotification);

// ============================================
// RUTAS PARA ADMINISTRADORES
// ============================================

// POST /api/v1/notifications/send - Enviar notificación a un usuario
router.post('/send', adminAreaOrRHMiddleware, NotificationController.sendNotification);

// POST /api/v1/notifications/send-department - Enviar notificación a departamento
router.post('/send-department', adminAreaOrRHMiddleware, NotificationController.sendNotificationToDepartment);

// POST /api/v1/notifications/send-all - Enviar notificación a todos (solo admin_rh)
router.post('/send-all', adminRHMiddleware, NotificationController.sendNotificationToAll);

// GET /api/v1/notifications/admin/pending - Obtener items pendientes para admin
router.get('/admin/pending', adminAreaOrRHMiddleware, NotificationController.getAdminPendingItems);

// POST /api/v1/notifications/cleanup - Limpiar notificaciones antiguas
router.post('/cleanup', adminRHMiddleware, NotificationController.cleanupOldNotifications);

// POST /api/v1/notifications/check-birthdays - Verificar y notificar cumpleaños del día
router.post('/check-birthdays', adminRHMiddleware, NotificationController.checkBirthdays);

export default router;
