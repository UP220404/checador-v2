/**
 * Controlador de Configuracion del Sistema
 */

import SettingsService from '../services/SettingsService.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';

class SettingsController {
  /**
   * GET /api/v1/settings
   * Obtener todas las configuraciones
   */
  async getAllSettings(req, res) {
    try {
      const settings = await SettingsService.getAllSettings();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error en getAllSettings:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/settings/:category
   * Obtener configuracion por categoria
   */
  async getSettings(req, res) {
    try {
      const { category } = req.params;

      const validCategories = ['ausencias', 'nomina', 'horarios', 'departamentos', 'empresa', 'seguridad', 'notificaciones'];
      if (!validCategories.includes(category)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Categoria de configuracion invalida'
        });
      }

      const settings = await SettingsService.getSettings(category);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error en getSettings:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/settings/:category
   * Actualizar configuracion por categoria
   */
  async updateSettings(req, res) {
    try {
      const { category } = req.params;

      const validCategories = ['ausencias', 'nomina', 'horarios', 'departamentos', 'empresa', 'seguridad', 'notificaciones'];
      if (!validCategories.includes(category)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Categoria de configuracion invalida'
        });
      }

      const settings = await SettingsService.updateSettings(category, req.body);

      res.json({
        success: true,
        message: 'Configuracion actualizada correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en updateSettings:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  // ============================================
  // TIPOS DE AUSENCIA
  // ============================================

  /**
   * POST /api/v1/settings/ausencias/tipos
   * Agregar nuevo tipo de ausencia
   */
  async addAbsenceType(req, res) {
    try {
      const { id, nombre, requiereAprobacion } = req.body;

      if (!id || !nombre) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID y nombre son requeridos'
        });
      }

      const settings = await SettingsService.addAbsenceType({
        id,
        nombre,
        requiereAprobacion
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Tipo de ausencia agregado correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en addAbsenceType:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/settings/ausencias/tipos/:typeId
   * Actualizar tipo de ausencia
   */
  async updateAbsenceType(req, res) {
    try {
      const { typeId } = req.params;
      const updates = req.body;

      const settings = await SettingsService.updateAbsenceType(typeId, updates);

      res.json({
        success: true,
        message: 'Tipo de ausencia actualizado correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en updateAbsenceType:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/settings/ausencias/tipos/:typeId
   * Eliminar tipo de ausencia (soft delete)
   */
  async deleteAbsenceType(req, res) {
    try {
      const { typeId } = req.params;

      const settings = await SettingsService.deleteAbsenceType(typeId);

      res.json({
        success: true,
        message: 'Tipo de ausencia desactivado correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en deleteAbsenceType:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  // ============================================
  // DEPARTAMENTOS
  // ============================================

  /**
   * POST /api/v1/settings/departamentos
   * Agregar nuevo departamento
   */
  async addDepartment(req, res) {
    try {
      const { nombre } = req.body;

      if (!nombre) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Nombre del departamento es requerido'
        });
      }

      const settings = await SettingsService.addDepartment(nombre);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Departamento agregado correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en addDepartment:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/settings/departamentos/:nombre
   * Eliminar departamento
   */
  async removeDepartment(req, res) {
    try {
      const { nombre } = req.params;

      const settings = await SettingsService.removeDepartment(decodeURIComponent(nombre));

      res.json({
        success: true,
        message: 'Departamento eliminado correctamente',
        data: settings
      });
    } catch (error) {
      console.error('Error en removeDepartment:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new SettingsController();
