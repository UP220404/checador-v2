/**
 * Controlador de Notificaciones
 */

import NotificationService from '../services/NotificationService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class NotificationController {
  /**
   * GET /api/v1/notifications/my
   * Obtiene las notificaciones del usuario actual
   */
  async getMyNotifications(req, res) {
    try {
      const uid = req.user.uid;
      const { limit, unread } = req.query;

      const options = {
        limit: limit ? parseInt(limit) : 50,
        onlyUnread: unread === 'true'
      };

      const notifications = await NotificationService.getNotificationsByUser(uid, options);

      res.json({
        success: true,
        count: notifications.length,
        data: notifications
      });
    } catch (error) {
      console.error('Error en getMyNotifications:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Obtiene el conteo de notificaciones no leídas
   */
  async getUnreadCount(req, res) {
    try {
      const uid = req.user.uid;

      const count = await NotificationService.getUnreadCount(uid);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error en getUnreadCount:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/notifications/:id/read
   * Marca una notificación como leída
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userUid = req.user.uid;

      // Verificar que la notificación pertenece al usuario
      const notification = await NotificationService.getNotificationById(id);

      if (!notification) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      if (notification.uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const result = await NotificationService.markAsRead(id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error en markAsRead:', error);

      if (error.message === 'Notificación no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/notifications/read-all
   * Marca todas las notificaciones como leídas
   */
  async markAllAsRead(req, res) {
    try {
      const uid = req.user.uid;

      const result = await NotificationService.markAllAsRead(uid);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error en markAllAsRead:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   * Elimina una notificación
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userUid = req.user.uid;

      // Verificar que la notificación pertenece al usuario
      const notification = await NotificationService.getNotificationById(id);

      if (!notification) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      if (notification.uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const result = await NotificationService.deleteNotification(id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error en deleteNotification:', error);

      if (error.message === 'Notificación no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/notifications/send
   * Envía una notificación a un usuario (admin)
   */
  async sendNotification(req, res) {
    try {
      const { uid, emailUsuario, tipo, titulo, mensaje, referencia } = req.body;

      if (!uid || !tipo || !titulo || !mensaje) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan campos requeridos: uid, tipo, titulo, mensaje'
        });
      }

      const notification = await NotificationService.createNotification({
        uid,
        emailUsuario,
        tipo,
        titulo,
        mensaje,
        referencia
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Notificación enviada',
        data: notification
      });
    } catch (error) {
      console.error('Error en sendNotification:', error);

      if (error.message.includes('Tipo de notificación inválido')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/notifications/cleanup
   * Limpia notificaciones antiguas (admin)
   */
  async cleanupOldNotifications(req, res) {
    try {
      const { daysOld } = req.query;

      const result = await NotificationService.cleanupOldNotifications(
        daysOld ? parseInt(daysOld) : 30
      );

      res.json({
        success: true,
        message: `${result.deleted} notificaciones eliminadas`
      });
    } catch (error) {
      console.error('Error en cleanupOldNotifications:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/notifications/send-department
   * Envía notificación a todos los usuarios de un departamento (admin)
   */
  async sendNotificationToDepartment(req, res) {
    try {
      const { departamento, tipo, titulo, mensaje, referencia } = req.body;

      if (!departamento || !titulo || !mensaje) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan campos requeridos: departamento, titulo, mensaje'
        });
      }

      const result = await NotificationService.sendNotificationToDepartment(departamento, {
        tipo: tipo || 'sistema',
        titulo,
        mensaje,
        referencia
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: `Notificaciones enviadas al departamento ${departamento}`,
        data: {
          totalEnviadas: result.totalEnviadas,
          totalFallidas: result.totalFallidas
        }
      });
    } catch (error) {
      console.error('Error en sendNotificationToDepartment:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/notifications/send-all
   * Envía notificación a todos los usuarios del sistema (admin_rh)
   */
  async sendNotificationToAll(req, res) {
    try {
      const { tipo, titulo, mensaje, referencia } = req.body;

      if (!titulo || !mensaje) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan campos requeridos: titulo, mensaje'
        });
      }

      const result = await NotificationService.sendNotificationToAll({
        tipo: tipo || 'sistema',
        titulo,
        mensaje,
        referencia
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Notificaciones enviadas a todos los usuarios',
        data: {
          totalEnviadas: result.totalEnviadas,
          totalFallidas: result.totalFallidas
        }
      });
    } catch (error) {
      console.error('Error en sendNotificationToAll:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/notifications/check-birthdays
   * Verifica cumpleaños del día y envía notificaciones (admin_rh)
   */
  async checkBirthdays(req, res) {
    try {
      const result = await NotificationService.checkAndNotifyBirthdays();

      res.json({
        success: true,
        message: `${result.cumpleaneros} cumpleaños encontrados. ${result.notificacionesEnviadas} notificaciones enviadas.`,
        data: result
      });
    } catch (error) {
      console.error('Error en checkBirthdays:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/notifications/admin/pending
   * Obtiene las solicitudes pendientes (ausencias, etc.) para el admin
   */
  async getAdminPendingItems(req, res) {
    try {
      // Si es admin_area, filtrar por departamento
      const departmentFilter = req.user.role === ROLES.ADMIN_AREA ? req.user.departamento : null;

      const result = await NotificationService.getAdminPendingItems(departmentFilter);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error en getAdminPendingItems:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new NotificationController();
