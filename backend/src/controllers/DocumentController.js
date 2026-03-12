/**
 * Controlador de Documentos de Empleados
 */

import DocumentService from '../services/DocumentService.js';
import UserService from '../services/UserService.js';
import NotificationService from '../services/NotificationService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES, TIPOS_NOTIFICACION } from '../config/constants.js';

class DocumentController {
  /**
   * GET /api/v1/documents/my
   * Obtiene los documentos del usuario actual
   */
  async getMyDocuments(req, res) {
    try {
      const uid = req.user.uid;
      const { tipo } = req.query;

      let documents;
      if (tipo) {
        documents = await DocumentService.getDocumentsByType(uid, tipo);
      } else {
        documents = await DocumentService.getDocumentsByUser(uid);
      }

      res.json({
        success: true,
        count: documents.length,
        data: documents
      });
    } catch (error) {
      console.error('Error en getMyDocuments:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/documents/user/:uid
   * Obtiene documentos de un usuario específico (admin)
   */
  async getUserDocuments(req, res) {
    try {
      const { uid } = req.params;
      const { includeHidden } = req.query;

      let documents;
      if (includeHidden === 'true') {
        documents = await DocumentService.getAllDocumentsByUser(uid);
      } else {
        documents = await DocumentService.getDocumentsByUser(uid);
      }

      res.json({
        success: true,
        count: documents.length,
        data: documents
      });
    } catch (error) {
      console.error('Error en getUserDocuments:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/documents/:id
   * Obtiene un documento específico
   */
  async getDocument(req, res) {
    try {
      const { id } = req.params;
      const userUid = req.user.uid;
      const isAdmin = req.user.role === ROLES.ADMIN_RH || req.user.role === ROLES.ADMIN_AREA;

      const document = await DocumentService.getDocumentById(id);

      if (!document) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      // Verificar acceso: solo el dueño o admin
      if (document.uid !== userUid && !isAdmin) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado para ver este documento'
        });
      }

      // Si no es admin y el documento no es visible, denegar
      if (!isAdmin && !document.visible) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      console.error('Error en getDocument:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/documents/upload
   * Sube un nuevo documento (admin)
   */
  async uploadDocument(req, res) {
    try {
      const {
        uid,
        tipo,
        nombre,
        descripcion,
        url,
        tamano,
        mimeType,
        visible,
        periodoNomina
      } = req.body;

      // Validar campos requeridos
      if (!uid || !tipo || !nombre || !url) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan campos requeridos: uid, tipo, nombre, url'
        });
      }

      // Obtener datos del usuario
      const user = await UserService.getUserByUid(uid);
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const document = await DocumentService.createDocument({
        uid,
        emailUsuario: user.correo,
        nombreUsuario: user.nombre,
        tipo,
        nombre,
        descripcion,
        url,
        tamano,
        mimeType,
        subidoPor: req.user.email,
        visible,
        periodoNomina
      });

      // Crear notificación para el empleado
      try {
        await NotificationService.createNotification({
          uid,
          emailUsuario: user.correo,
          tipo: TIPOS_NOTIFICACION.DOCUMENTO_NUEVO,
          titulo: 'Nuevo documento disponible',
          mensaje: `Se ha subido un nuevo documento: ${nombre}`,
          referencia: {
            tipo: 'documento',
            id: document.id
          }
        });
      } catch (notifError) {
        console.error('Error creando notificación de documento:', notifError);
        // No fallar si la notificación no se crea
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Documento subido exitosamente',
        data: document
      });
    } catch (error) {
      console.error('Error en uploadDocument:', error);

      if (error.message.includes('Tipo de documento inválido')) {
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
   * PUT /api/v1/documents/:id
   * Actualiza un documento (admin)
   */
  async updateDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await DocumentService.updateDocument(id, req.body);

      res.json({
        success: true,
        message: 'Documento actualizado',
        data: document
      });
    } catch (error) {
      console.error('Error en updateDocument:', error);

      if (error.message === 'Documento no encontrado') {
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
   * DELETE /api/v1/documents/:id
   * Elimina un documento (admin)
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      const result = await DocumentService.deleteDocument(id);

      res.json({
        success: true,
        message: result.message,
        data: { storageUrl: result.url }
      });
    } catch (error) {
      console.error('Error en deleteDocument:', error);

      if (error.message === 'Documento no encontrado') {
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
   * GET /api/v1/documents/my/payroll
   * Obtiene los recibos de nómina del usuario actual
   */
  async getMyPayrollReceipts(req, res) {
    try {
      const uid = req.user.uid;
      const { anio, mes } = req.query;

      if (!anio) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere el parámetro anio'
        });
      }

      const receipts = await DocumentService.getPayrollReceipts(
        uid,
        parseInt(anio),
        mes ? parseInt(mes) : null
      );

      res.json({
        success: true,
        count: receipts.length,
        data: receipts
      });
    } catch (error) {
      console.error('Error en getMyPayrollReceipts:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/documents/my/count
   * Obtiene el conteo de documentos del usuario actual
   */
  async getMyDocumentCount(req, res) {
    try {
      const uid = req.user.uid;

      const count = await DocumentService.countDocumentsByUser(uid);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error en getMyDocumentCount:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new DocumentController();
