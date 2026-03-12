/**
 * Rutas de Usuarios
 */

import express from 'express';
import UserController from '../controllers/UserController.js';
import ContractEvaluationController from '../controllers/ContractEvaluationController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';
import { attachRoleData, adminAreaOrRHMiddleware, adminRHMiddleware } from '../middleware/role.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticacion
router.use(authMiddleware);

// Adjuntar datos de rol a todas las rutas
router.use(attachRoleData);

// ============================================
// RUTAS PARA EMPLEADOS (Portal del Empleado)
// ============================================

// GET /api/v1/users/me/role - Obtener rol del usuario actual
router.get('/me/role', UserController.getCurrentUserRole);

// PUT /api/v1/users/:uid/profile - Empleado actualiza su propio perfil
router.put('/:uid/profile', UserController.updateOwnProfile);

// ============================================
// RUTAS PORTAL EMPLEADO V2
// ============================================

// PUT /api/v1/users/:uid/profile-extended - Actualizar perfil extendido
router.put('/:uid/profile-extended', UserController.updateProfileExtended);

// PUT /api/v1/users/:uid/foto - Actualizar foto de perfil
router.put('/:uid/foto', UserController.updateProfilePhoto);

// GET /api/v1/users/:uid/fechas-importantes - Obtener fechas importantes
router.get('/:uid/fechas-importantes', UserController.getFechasImportantes);

// POST /api/v1/users/:uid/fechas-importantes - Agregar fecha importante
router.post('/:uid/fechas-importantes', UserController.addFechaImportante);

// DELETE /api/v1/users/:uid/fechas-importantes/:fechaId - Eliminar fecha importante
router.delete('/:uid/fechas-importantes/:fechaId', UserController.deleteFechaImportante);

// PUT /api/v1/users/:uid/preferencias - Actualizar preferencias de notificaciones
router.put('/:uid/preferencias', UserController.updatePreferenciasNotificaciones);

// GET /api/v1/users/:uid/vacaciones-saldo - Obtener saldo de vacaciones
router.get('/:uid/vacaciones-saldo', UserController.getSaldoVacaciones);

// PUT /api/v1/users/:uid/vacaciones-saldo - Actualizar saldo de vacaciones (admin)
router.put('/:uid/vacaciones-saldo', adminMiddleware, UserController.updateSaldoVacaciones);

// POST /api/v1/users/:uid/vacaciones-recalcular - Recalcular saldo de vacaciones
router.post('/:uid/vacaciones-recalcular', adminMiddleware, UserController.recalcularSaldoVacaciones);

// PUT /api/v1/users/:uid/admin-profile - Admin actualiza perfil de usuario
router.put('/:uid/admin-profile', adminMiddleware, UserController.updateProfileByAdmin);

// ============================================
// RUTAS PARA ADMINISTRADORES
// ============================================

// GET /api/v1/users - Listar usuarios (admin_rh ve todos, admin_area ve su departamento)
router.get('/', adminAreaOrRHMiddleware, UserController.getAllUsers);

// GET /api/v1/users/:uid - Obtener usuario específico
router.get('/:uid', UserController.getUser);

// POST /api/v1/users - Crear nuevo usuario (solo admin)
router.post('/', adminMiddleware, UserController.createUser);

// PUT /api/v1/users/:uid - Actualizar usuario (solo admin)
router.put('/:uid', adminMiddleware, UserController.updateUser);

// DELETE /api/v1/users/:uid - Eliminar usuario (solo admin)
router.delete('/:uid', adminMiddleware, UserController.deleteUser);

// GET /api/v1/users/:uid/payroll-config - Obtener configuración de nómina (solo admin_rh)
router.get('/:uid/payroll-config', adminRHMiddleware, UserController.getPayrollConfig);

// PUT /api/v1/users/:uid/payroll-config - Actualizar configuración de nómina (solo admin)
router.put('/:uid/payroll-config', adminMiddleware, UserController.updatePayrollConfig);

// PUT /api/v1/users/:uid/role - Cambiar rol de usuario (solo admin_rh)
router.put('/:uid/role', adminRHMiddleware, UserController.updateUserRole);

// POST /api/v1/users/:uid/initialize-contract - Inicializar contrato (solo admin_rh)
router.post('/:uid/initialize-contract', adminRHMiddleware, ContractEvaluationController.initializeContract);

export default router;
