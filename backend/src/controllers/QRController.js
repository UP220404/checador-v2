/**
 * Controlador de QR
 */

import QRService from '../services/QRService.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';

class QRController {
  /**
   * GET /api/v1/qr/current
   * Obtiene el token QR actual
   */
  async getCurrentToken(req, res) {
    try {
      const token = await QRService.getCurrentToken();

      if (!token) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'No hay token QR activo'
        });
      }

      res.json({
        success: true,
        data: token
      });

    } catch (error) {
      console.error('Error obteniendo token actual:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/qr/generate
   * Genera un nuevo token QR (solo admin)
   */
  async generateToken(req, res) {
    try {
      const { modo, duracionMinutos } = req.body;

      const result = await QRService.generateToken(
        modo || 'dinamico',
        duracionMinutos || 5
      );

      res.status(HTTP_STATUS.CREATED).json(result);

    } catch (error) {
      console.error('Error generando token:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/qr/validate
   * Valida un token QR
   */
  async validateToken(req, res) {
    try {
      const { qrCode, token } = req.body;

      if (!qrCode) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      const result = await QRService.validateToken(
        qrCode,
        token,
        req.user.email
      );

      res.json(result);

    } catch (error) {
      console.error('Error validando token:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/qr/stats
   * Obtiene estadísticas de QR (solo admin)
   */
  async getStats(req, res) {
    try {
      const { fecha } = req.query;

      const stats = await QRService.getStats(fecha);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new QRController();
