/**
 * Controlador de Ausencias
 */

import AbsenceService from '../services/AbsenceService.js';
import UserService from '../services/UserService.js';
import AuditService from '../services/AuditService.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

class AbsenceController {
  // ============================================
  // MÉTODOS PARA EMPLEADOS (Portal del Empleado)
  // ============================================

  /**
   * POST /api/v1/absences/request
   * Empleado crea su propia solicitud de ausencia
   */
  async createEmployeeRequest(req, res) {
    try {
      const userEmail = req.user.email;
      const userName = req.user.name;

      // Validar que solo cree solicitud para sí mismo
      const { tipo, fechaInicio, fechaFin, motivo, esEmergencia, motivoEmergencia } = req.body;

      if (!tipo || !fechaInicio || !motivo) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Campos obligatorios: tipo, fechaInicio, motivo'
        });
      }

      // Tipos permitidos para empleados (no retardo_justificado ni falta_justificada)
      const tiposPermitidos = [
        'permiso_con_goce',
        'permiso_sin_goce',
        'vacaciones',
        'incapacidad'
      ];

      if (!tiposPermitidos.includes(tipo)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Tipo de ausencia no permitido para empleados'
        });
      }

      // Obtener nombre y departamento del usuario desde Firestore (fuente de verdad)
      // req.user.name viene del token de Firebase y puede ser el email o un alias
      let departamentoUsuario = '';
      let nombreUsuario = userName; // fallback al nombre del token
      try {
        const user = await UserService.getUserByEmail(userEmail);
        if (user) {
          departamentoUsuario = user.departamento || '';
          if (user.nombre) nombreUsuario = user.nombre; // usar nombre real de la BD
        }
      } catch (err) {
        console.log('No se pudo obtener datos del usuario:', err.message);
      }

      const ausenciaData = {
        uid: req.user.uid,
        emailUsuario: userEmail,
        nombreUsuario,
        departamentoUsuario,
        tipo,
        fechaInicio,
        fechaFin: fechaFin || fechaInicio,
        motivo,
        estado: 'pendiente', // Siempre inicia pendiente
        // Nuevos campos para regla de 15 días
        esEmergencia: esEmergencia || false,
        motivoEmergencia: motivoEmergencia || ''
      };

      const ausencia = await AbsenceService.createAbsence(ausenciaData);

      // Mensaje personalizado según el tipo de solicitud
      let mensaje = 'Solicitud creada correctamente. Será revisada por RH.';
      if (ausencia.requiereRevisionUrgente) {
        mensaje = 'Solicitud de EMERGENCIA creada. Será revisada con prioridad por RH.';
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: mensaje,
        data: ausencia
      });
    } catch (error) {
      console.error('Error en createEmployeeRequest:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences/urgent
   * Obtener solicitudes urgentes (emergencias o con poca anticipación)
   */
  async getUrgentRequests(req, res) {
    try {
      // Determinar filtro de departamento para admin_area
      let departmentFilter = null;
      if (req.user.role === ROLES.ADMIN_AREA && req.user.departamento) {
        departmentFilter = req.user.departamento;
      }

      const urgentes = await AbsenceService.getUrgentRequests(departmentFilter);

      res.json({
        success: true,
        count: urgentes.length,
        data: urgentes
      });
    } catch (error) {
      console.error('Error en getUrgentRequests:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences/my-requests
   * Empleado ve sus propias solicitudes
   */
  async getMyRequests(req, res) {
    try {
      const userEmail = req.user.email;

      const filters = {
        emailUsuario: userEmail,
        estado: req.query.estado,
        tipo: req.query.tipo,
        mes: req.query.mes,
        anio: req.query.anio
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const ausencias = await AbsenceService.getAbsences(filters);

      res.json({
        success: true,
        count: ausencias.length,
        data: ausencias
      });
    } catch (error) {
      console.error('Error en getMyRequests:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/absences/my-requests/:id
   * Empleado cancela su propia solicitud (solo si está pendiente)
   */
  async cancelMyRequest(req, res) {
    try {
      const { id } = req.params;
      const userEmail = req.user.email;

      // Obtener la ausencia
      const ausencia = await AbsenceService.getAbsenceById(id);

      if (!ausencia) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Solicitud no encontrada'
        });
      }

      // Verificar que sea del usuario
      if (ausencia.emailUsuario !== userEmail) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No puedes cancelar solicitudes de otros usuarios'
        });
      }

      // Solo se pueden cancelar solicitudes pendientes
      if (ausencia.estado !== 'pendiente') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Solo puedes cancelar solicitudes pendientes'
        });
      }

      await AbsenceService.deleteAbsence(id);

      res.json({
        success: true,
        message: 'Solicitud cancelada correctamente'
      });
    } catch (error) {
      console.error('Error en cancelMyRequest:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  // ============================================
  // METODOS PARA ADMINISTRADORES
  // ============================================
  /**
   * POST /api/v1/absences
   * Crear una nueva ausencia (admin)
   */
  async createAbsence(req, res) {
    try {
      // Si se proporciona userId, obtener el departamento del usuario
      let absenceData = { ...req.body };

      if (req.body.userId || req.body.emailUsuario) {
        try {
          const user = req.body.userId
            ? await UserService.getUserByUid(req.body.userId)
            : await UserService.getUserByEmail(req.body.emailUsuario);

          if (user) {
            absenceData.departamentoUsuario = user.departamento || '';
          }
        } catch (err) {
          console.log('No se pudo obtener departamento del usuario:', err.message);
        }
      }

      const ausencia = await AbsenceService.createAbsence(absenceData);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Ausencia creada correctamente',
        data: ausencia
      });
    } catch (error) {
      console.error('Error en createAbsence:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences
   * Obtener ausencias con filtros opcionales
   * Query params: emailUsuario, estado, tipo, mes, anio, periodo
   * admin_area solo ve ausencias de su departamento
   */
  async getAbsences(req, res) {
    try {
      const filters = {
        emailUsuario: req.query.emailUsuario,
        estado: req.query.estado,
        tipo: req.query.tipo,
        mes: req.query.mes,
        anio: req.query.anio,
        periodo: req.query.periodo
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      // Determinar filtro de departamento para admin_area
      let departmentFilter = null;
      if (req.user.role === ROLES.ADMIN_AREA && req.user.departamento) {
        departmentFilter = req.user.departamento;
      }

      const ausencias = await AbsenceService.getAbsences(filters, departmentFilter);

      res.json({
        success: true,
        count: ausencias.length,
        data: ausencias
      });
    } catch (error) {
      console.error('Error en getAbsences:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences/:id
   * Obtener una ausencia específica
   */
  async getAbsenceById(req, res) {
    try {
      const { id } = req.params;
      const ausencia = await AbsenceService.getAbsenceById(id);

      if (!ausencia) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Ausencia no encontrada'
        });
      }

      res.json({
        success: true,
        data: ausencia
      });
    } catch (error) {
      console.error('Error en getAbsenceById:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/absences/:id
   * Actualizar una ausencia
   */
  async updateAbsence(req, res) {
    try {
      const { id } = req.params;
      const ausencia = await AbsenceService.updateAbsence(id, req.body);

      res.json({
        success: true,
        message: 'Ausencia actualizada correctamente',
        data: ausencia
      });
    } catch (error) {
      console.error('Error en updateAbsence:', error);

      if (error.message === 'Ausencia no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * DELETE /api/v1/absences/:id
   * Eliminar una ausencia
   */
  async deleteAbsence(req, res) {
    try {
      const { id } = req.params;
      const result = await AbsenceService.deleteAbsence(id);

      res.json({
        success: true,
        message: result.mensaje
      });
    } catch (error) {
      console.error('Error en deleteAbsence:', error);

      if (error.message === 'Ausencia no encontrada') {
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
   * PUT /api/v1/absences/:id/approve
   * Aprobar una ausencia
   */
  async approveAbsence(req, res) {
    try {
      const { id } = req.params;
      const adminEmail = req.user.email; // Del middleware de autenticación

      const ausencia = await AbsenceService.approveAbsence(id, adminEmail);

      // Registrar en auditoría
      await AuditService.logAbsenceAction('aprobar_ausencia', id, ausencia, {
        uid: req.user.uid,
        email: req.user.email,
        nombre: req.user.name || req.user.email,
        role: req.user.role
      }, {
        cambios: { estado: { antes: 'pendiente', despues: 'aprobada' } }
      });

      res.json({
        success: true,
        message: 'Ausencia aprobada correctamente',
        data: ausencia
      });
    } catch (error) {
      console.error('Error en approveAbsence:', error);

      if (error.message === 'Ausencia no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/absences/:id/reject
   * Rechazar una ausencia
   */
  async rejectAbsence(req, res) {
    try {
      const { id } = req.params;
      const adminEmail = req.user.email;
      const { comentarios } = req.body;

      const ausencia = await AbsenceService.rejectAbsence(id, adminEmail, comentarios);

      // Registrar en auditoría
      await AuditService.logAbsenceAction('rechazar_ausencia', id, ausencia, {
        uid: req.user.uid,
        email: req.user.email,
        nombre: req.user.name || req.user.email,
        role: req.user.role
      }, {
        motivo: comentarios || 'Sin comentarios',
        cambios: { estado: { antes: 'pendiente', despues: 'rechazada' } }
      });

      res.json({
        success: true,
        message: 'Ausencia rechazada',
        data: ausencia
      });
    } catch (error) {
      console.error('Error en rejectAbsence:', error);

      if (error.message === 'Ausencia no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences/stats
   * Obtener estadísticas de ausencias
   */
  async getAbsenceStats(req, res) {
    try {
      const filters = {
        emailUsuario: req.query.emailUsuario,
        mes: req.query.mes,
        anio: req.query.anio
      };

      // Remover filtros undefined
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const stats = await AbsenceService.getAbsenceStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getAbsenceStats:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/absences/retardos/:emailUsuario
   * Obtener retardos de un usuario para justificación
   */
  async getRetardosByUser(req, res) {
    try {
      const { emailUsuario } = req.params;
      const { fechaInicio, fechaFin } = req.query;

      const retardos = await AbsenceService.getRetardosByUser(
        emailUsuario,
        fechaInicio,
        fechaFin
      );

      res.json({
        success: true,
        count: retardos.length,
        data: retardos
      });
    } catch (error) {
      console.error('Error en getRetardosByUser:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/absences/:id/revert-correction
   * Revertir corrección de hora (para retardos justificados)
   */
  async revertCorrection(req, res) {
    try {
      const { id } = req.params;
      const ausencia = await AbsenceService.getAbsenceById(id);

      if (!ausencia) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Ausencia no encontrada'
        });
      }

      if (ausencia.tipo !== 'retardo_justificado') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Solo se pueden revertir correcciones de retardos justificados'
        });
      }

      const result = await AbsenceService.revertirCorreccionHora(ausencia);

      res.json({
        success: true,
        message: result.mensaje
      });
    } catch (error) {
      console.error('Error en revertCorrection:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }
}

export default new AbsenceController();
