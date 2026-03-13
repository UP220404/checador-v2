/**
 * Controlador de Usuarios
 */

import UserService from '../services/UserService.js';
import AuditService from '../services/AuditService.js';
import ContractEvaluationService from '../services/ContractEvaluationService.js';
import NotificationService from '../services/NotificationService.js';
import getCloudinary from '../config/Cloudinary.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';
import { isAdmin } from '../config/firebase.js';

class UserController {
  // ============================================
  // MÉTODOS PARA EMPLEADOS (Portal del Empleado)
  // ============================================

  /**
   * GET /api/v1/users/me/role
   * Obtiene rol y datos del usuario actual (usado después de Firebase auth)
   */
  async getCurrentUserRole(req, res) {
    try {
      const userEmail = req.user.email;
      const userUid = req.user.uid;

      if (process.env.NODE_ENV === 'development') {
        console.log('[getCurrentUserRole] Email:', userEmail);
        console.log('[getCurrentUserRole] UID:', userUid);
        console.log('[getCurrentUserRole] req.user.role (from middleware):', req.user.role);
      }

      // Si el middleware ya adjuntó el rol, usarlo directamente
      if (req.user.role && req.user.role !== ROLES.EMPLEADO) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[getCurrentUserRole] Usando rol del middleware:', req.user.role);
        }
        return res.json({
          success: true,
          data: {
            role: req.user.role,
            departamento: req.user.departamento || '',
            nombre: req.user.roleData?.nombre || '',
            email: userEmail,
            uid: userUid
          }
        });
      }

      // Buscar usuario por email o uid
      let user = await UserService.getUserByEmail(userEmail);
      if (process.env.NODE_ENV === 'development') {
        console.log('[getCurrentUserRole] Usuario por email:', user ? 'encontrado' : 'no encontrado');
      }

      if (!user) {
        user = await UserService.getUserByUid(userUid);
        if (process.env.NODE_ENV === 'development') {
          console.log('[getCurrentUserRole] Usuario por UID:', user ? 'encontrado' : 'no encontrado');
        }
      }

      // Si no existe, devolver rol por defecto
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[getCurrentUserRole] Usuario no encontrado, devolviendo rol por defecto');
        }
        return res.json({
          success: true,
          data: {
            role: ROLES.EMPLEADO,
            departamento: '',
            nombre: req.user.name || '',
            email: userEmail
          }
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[getCurrentUserRole] Rol encontrado:', user.role);
      }
      res.json({
        success: true,
        data: {
          role: user.role || ROLES.EMPLEADO,
          departamento: user.departamento || '',
          nombre: user.nombre || '',
          email: user.correo || userEmail,
          uid: user.uid || userUid
        }
      });
    } catch (error) {
      console.error('Error en getCurrentUserRole:', error);
      // En caso de error, devolver rol por defecto para no bloquear el login
      res.json({
        success: true,
        data: {
          role: ROLES.EMPLEADO,
          departamento: '',
          nombre: '',
          email: req.user.email
        }
      });
    }
  }

  /**
   * PUT /api/v1/users/:uid/profile
   * Empleado actualiza su propio perfil (campos limitados)
   */
  async updateOwnProfile(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede actualizar su propio perfil
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes actualizar tu propio perfil'
        });
      }

      // Campos permitidos para empleados
      const camposPermitidos = ['telefono', 'direccion', 'contactoEmergencia', 'contactoEmergenciaTelefono'];
      const updateData = {};

      camposPermitidos.forEach(campo => {
        if (req.body[campo] !== undefined) {
          updateData[campo] = req.body[campo];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No se proporcionaron campos válidos para actualizar'
        });
      }

      const user = await UserService.updateUser(uid, updateData);

      res.json({
        success: true,
        message: 'Perfil actualizado correctamente',
        data: user
      });
    } catch (error) {
      console.error('Error en updateOwnProfile:', error);

      if (error.message === 'Usuario no encontrado') {
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

  // ============================================
  // MÉTODOS PARA ADMINISTRADORES
  // ============================================

  /**
   * GET /api/v1/users/:uid
   * Obtiene un usuario específico
   */
  async getUser(req, res) {
    try {
      const { uid } = req.params;

      // Solo admins pueden ver otros usuarios, usuarios normales solo su propio perfil
      if (!isAdmin(req.user.email) && req.user.uid !== uid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado para ver este usuario'
        });
      }

      const user = await UserService.getUserByUid(uid);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error en getUser:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * GET /api/v1/users
   * Lista todos los usuarios (admin)
   * admin_area solo ve usuarios de su departamento
   */
  async getAllUsers(req, res) {
    try {
      let users;

      // Si es admin_area, filtrar por departamento
      if (req.user.role === ROLES.ADMIN_AREA && req.user.departamento) {
        users = await UserService.getUsersByDepartment(req.user.departamento);
      } else {
        users = await UserService.getAllUsers();
      }

      res.json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (error) {
      console.error('Error en getAllUsers:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * POST /api/v1/users
   * Crea un nuevo usuario (solo admin)
   */
  async createUser(req, res) {
    try {
      const {
        uid,
        nombre,
        correo,
        email,  // Alias del frontend
        tipo,
        role,   // Alias del frontend
        ...rest
      } = req.body;

      // Aceptar tanto 'correo' como 'email' - verificar que no sea vacío
      const userEmail = (correo && correo.trim()) || (email && email.trim());
      // El tipo de contrato - por defecto 'tiempo_completo'
      const userTipo = tipo || 'tiempo_completo';
      // El rol de acceso - por defecto 'empleado'
      const userRole = role || 'empleado';
      // Generar uid si no se proporciona (basado en email)
      const userId = uid || `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (!nombre || !nombre.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El nombre es requerido'
        });
      }

      if (!userEmail) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El email es requerido'
        });
      }

      const user = await UserService.createUser(userId, {
        nombre: nombre.trim(),
        correo: userEmail,
        tipo: userTipo,
        role: userRole,
        ...rest
      });

      // Notificar bienvenida al nuevo empleado
      NotificationService.notifyBienvenida(userId, userEmail, nombre.trim())
        .catch(e => console.error('Error notificando bienvenida:', e));

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: user
      });
    } catch (error) {
      console.error('Error en createUser:', error);

      if (error.message.includes('ya está registrado') || error.message.includes('ya esta registrado')) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('Email inválido') || error.message.includes('invalido')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El formato del email no es válido'
        });
      }

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/users/:uid
   * Actualiza un usuario (solo admin)
   */
  async updateUser(req, res) {
    try {
      const { uid } = req.params;
      const updateData = req.body;

      const user = await UserService.updateUser(uid, updateData);

      // Sincronizar evaluaciones pendientes con datos actualizados
      ContractEvaluationService.syncEvaluationsForUser(uid).catch(err =>
        console.error('Error sincronizando evaluaciones:', err)
      );

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: user
      });
    } catch (error) {
      console.error('Error en updateUser:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * DELETE /api/v1/users/:uid
   * Elimina un usuario (solo admin)
   */
  async deleteUser(req, res) {
    try {
      const { uid } = req.params;

      const result = await UserService.deleteUser(uid);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error en deleteUser:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * GET /api/v1/users/:uid/payroll-config
   * Obtiene configuración de nómina del usuario
   */
  async getPayrollConfig(req, res) {
    try {
      const { uid } = req.params;

      const config = await UserService.getUserPayrollConfig(uid);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error en getPayrollConfig:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  /**
   * PUT /api/v1/users/:uid/payroll-config
   * Actualiza configuración de nómina (solo admin)
   */
  async updatePayrollConfig(req, res) {
    try {
      const { uid } = req.params;
      const config = req.body;

      const result = await UserService.updateUserPayrollConfig(uid, config);

      res.json({
        success: true,
        message: 'Configuración de nómina actualizada',
        data: result.config
      });
    } catch (error) {
      console.error('Error en updatePayrollConfig:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  }

  // ============================================
  // MÉTODOS PORTAL EMPLEADO V2
  // ============================================

  /**
   * PUT /api/v1/users/:uid/profile-extended
   * Actualiza perfil extendido del empleado
   */
  async updateProfileExtended(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede actualizar su propio perfil
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes actualizar tu propio perfil'
        });
      }

      const result = await UserService.updateProfileExtended(uid, req.body);

      res.json({
        success: true,
        message: 'Perfil actualizado correctamente',
        data: result
      });
    } catch (error) {
      console.error('Error en updateProfileExtended:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * PUT /api/v1/users/:uid/foto
   * Sube foto de perfil a Cloudinary y guarda URL en Firestore
   */
  async updateProfilePhoto(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede actualizar su propia foto
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes actualizar tu propia foto'
        });
      }

      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere un archivo de imagen'
        });
      }
      console.log('📸 Upload foto - archivo recibido:', req.file.originalname, req.file.size, 'bytes');
      console.log('📸 Cloudinary config:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING');

      // Subir a Cloudinary usando stream
      const cld = getCloudinary();
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cld.uploader.upload_stream(
          {
            folder: 'checador-v2/perfiles',
            public_id: `profile_${uid}`,
            overwrite: true
          },
          (error, result) => {
            if (error) {
              console.error('📸 Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('📸 Cloudinary upload OK:', result.secure_url);
              resolve(result);
            }
          }
        );
        stream.end(req.file.buffer);
      });

      const fotoUrl = uploadResult.secure_url;

      const result = await UserService.updateProfilePhoto(uid, fotoUrl);

      res.json({
        success: true,
        message: 'Foto de perfil actualizada',
        data: { fotoUrl }
      });
    } catch (error) {
      console.error('Error en updateProfilePhoto:', error);

      if (error.message === 'Usuario no encontrado') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al subir la foto de perfil'
      });
    }
  }

  /**
   * DELETE /api/v1/users/:uid/foto
   * Elimina la foto de perfil de Cloudinary y Firestore
   */
  async deleteProfilePhoto(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes eliminar tu propia foto'
        });
      }

      // Eliminar de Cloudinary
      try {
        const cld = getCloudinary();
        await cld.uploader.destroy(`checador-v2/perfiles/profile_${uid}`, { resource_type: 'image' });
        console.log('📸 Foto eliminada de Cloudinary');
      } catch (cloudErr) {
        console.error('📸 Error eliminando de Cloudinary (no crítico):', cloudErr);
      }

      // Limpiar URL en Firestore
      await UserService.updateProfilePhoto(uid, '');

      res.json({
        success: true,
        message: 'Foto de perfil eliminada',
        data: { fotoUrl: '' }
      });
    } catch (error) {
      console.error('Error en deleteProfilePhoto:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al eliminar la foto de perfil'
      });
    }
  }

  /**
   * GET /api/v1/users/:uid/fechas-importantes
   * Obtiene las fechas importantes del usuario
   */
  async getFechasImportantes(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede ver sus propias fechas (o admin)
      const isAdmin = req.user.role === ROLES.ADMIN_RH || req.user.role === ROLES.ADMIN_AREA;
      if (uid !== userUid && !isAdmin) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const fechas = await UserService.getFechasImportantes(uid);

      res.json({
        success: true,
        data: fechas
      });
    } catch (error) {
      console.error('Error en getFechasImportantes:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * POST /api/v1/users/:uid/fechas-importantes
   * Agrega una fecha importante
   */
  async addFechaImportante(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede agregar a sus propias fechas
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes agregar fechas a tu propio perfil'
        });
      }

      const { tipo, fecha, descripcion, notificar } = req.body;

      if (!tipo || !fecha) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere tipo y fecha'
        });
      }

      const nuevaFecha = await UserService.addFechaImportante(uid, {
        tipo,
        fecha,
        descripcion,
        notificar
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Fecha agregada correctamente',
        data: nuevaFecha
      });
    } catch (error) {
      console.error('Error en addFechaImportante:', error);

      if (error.message.includes('Tipo de fecha inválido')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'Usuario no encontrado') {
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
   * DELETE /api/v1/users/:uid/fechas-importantes/:fechaId
   * Elimina una fecha importante
   */
  async deleteFechaImportante(req, res) {
    try {
      const { uid, fechaId } = req.params;
      const userUid = req.user.uid;

      // Solo puede eliminar sus propias fechas
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes eliminar fechas de tu propio perfil'
        });
      }

      const result = await UserService.deleteFechaImportante(uid, fechaId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error en deleteFechaImportante:', error);

      if (error.message === 'Fecha importante no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'Usuario no encontrado') {
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
   * PUT /api/v1/users/:uid/preferencias
   * Actualiza preferencias de notificaciones
   */
  async updatePreferenciasNotificaciones(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede actualizar sus propias preferencias
      if (uid !== userUid) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Solo puedes actualizar tus propias preferencias'
        });
      }

      const result = await UserService.updatePreferenciasNotificaciones(uid, req.body);

      res.json({
        success: true,
        message: 'Preferencias actualizadas',
        data: result
      });
    } catch (error) {
      console.error('Error en updatePreferenciasNotificaciones:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * GET /api/v1/users/:uid/vacaciones-saldo
   * Obtiene el saldo de vacaciones del usuario
   */
  async getSaldoVacaciones(req, res) {
    try {
      const { uid } = req.params;
      const userUid = req.user.uid;

      // Solo puede ver su propio saldo (o admin)
      const isAdmin = req.user.role === ROLES.ADMIN_RH || req.user.role === ROLES.ADMIN_AREA;
      if (uid !== userUid && !isAdmin) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const saldo = await UserService.getSaldoVacaciones(uid);

      res.json({
        success: true,
        data: saldo
      });
    } catch (error) {
      console.error('Error en getSaldoVacaciones:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * PUT /api/v1/users/:uid/vacaciones-saldo
   * Actualiza el saldo de vacaciones (admin)
   */
  async updateSaldoVacaciones(req, res) {
    try {
      const { uid } = req.params;

      const result = await UserService.updateSaldoVacaciones(uid, req.body);

      res.json({
        success: true,
        message: 'Saldo de vacaciones actualizado',
        data: result
      });
    } catch (error) {
      console.error('Error en updateSaldoVacaciones:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * POST /api/v1/users/:uid/vacaciones-recalcular
   * Recalcula el saldo de vacaciones basado en ausencias
   */
  async recalcularSaldoVacaciones(req, res) {
    try {
      const { uid } = req.params;

      const saldo = await UserService.recalcularSaldoVacaciones(uid);

      res.json({
        success: true,
        message: 'Saldo de vacaciones recalculado',
        data: saldo
      });
    } catch (error) {
      console.error('Error en recalcularSaldoVacaciones:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * PUT /api/v1/users/:uid/admin-profile
   * Admin actualiza perfil de usuario (puesto, fechaIngreso, etc)
   */
  async updateProfileByAdmin(req, res) {
    try {
      const { uid } = req.params;

      const result = await UserService.updateProfileByAdmin(uid, req.body);

      // Sincronizar evaluaciones pendientes con datos actualizados
      ContractEvaluationService.syncEvaluationsForUser(uid).catch(err =>
        console.error('Error sincronizando evaluaciones:', err)
      );

      res.json({
        success: true,
        message: 'Perfil actualizado por administrador',
        data: result
      });
    } catch (error) {
      console.error('Error en updateProfileByAdmin:', error);

      if (error.message === 'Usuario no encontrado') {
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
   * PUT /api/v1/users/:uid/role
   * Actualiza el rol de un usuario (solo admin_rh)
   */
  async updateUserRole(req, res) {
    try {
      const { uid } = req.params;
      const { role, departamento } = req.body;

      if (!role) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere el campo role'
        });
      }

      // Obtener rol anterior para auditoría
      const userAntes = await UserService.getUserByUid(uid);
      const rolAnterior = userAntes?.role || ROLES.EMPLEADO;

      const result = await UserService.updateUserRole(uid, { role, departamento });

      // Sincronizar evaluaciones pendientes con datos actualizados
      ContractEvaluationService.syncEvaluationsForUser(uid).catch(err =>
        console.error('Error sincronizando evaluaciones:', err)
      );

      // Notificar cambio de rol si realmente cambió
      if (rolAnterior !== role) {
        const emailUsuario = userAntes?.correo || userAntes?.email;
        if (emailUsuario) {
          NotificationService.notifyCambioRol(uid, emailUsuario, role)
            .catch(e => console.error('Error notificando cambio de rol:', e));
        }
      }

      // Registrar en auditoría
      await AuditService.logRoleChange(uid, userAntes, rolAnterior, role, {
        uid: req.user.uid,
        email: req.user.email,
        nombre: req.user.name || req.user.email,
        role: req.user.role
      });

      res.json({
        success: true,
        message: `Rol actualizado a ${role}`,
        data: result
      });
    } catch (error) {
      console.error('Error en updateUserRole:', error);

      if (error.message === 'Usuario no encontrado') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('Rol inválido') || error.message.includes('requiere')) {
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
}

export default new UserController();
