/**
 * Middleware de Roles
 * Gestiona permisos basados en roles: empleado, admin_area, admin_rh
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

/**
 * Obtiene el rol y departamento del usuario desde Firestore
 */
async function getUserRoleData(email) {
  try {
    const db = getFirestore();
    const usersRef = db.collection(COLLECTIONS.USUARIOS);
    const snapshot = await usersRef.where('correo', '==', email).limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const userData = snapshot.docs[0].data();
    return {
      uid: snapshot.docs[0].id,
      role: userData.role || ROLES.EMPLEADO,
      departamento: userData.departamento || null,
      nombre: userData.nombre
    };
  } catch (error) {
    console.error('Error obteniendo datos de rol:', error);
    return null;
  }
}

/**
 * Middleware generico para verificar roles
 * @param {string[]} allowedRoles - Roles permitidos
 * @param {Object} options - Opciones adicionales
 */
export function roleMiddleware(allowedRoles, options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.AUTH.NOT_AUTHORIZED
        });
      }

      // Obtener datos de rol del usuario
      const roleData = await getUserRoleData(req.user.email);

      if (!roleData) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Usuario no encontrado en el sistema'
        });
      }

      // Agregar datos de rol al request
      req.user.role = roleData.role;
      req.user.departamento = roleData.departamento;
      req.user.roleData = roleData;

      // Verificar si el rol está permitido
      if (!allowedRoles.includes(roleData.role)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'No tienes permisos para acceder a este recurso'
        });
      }

      next();
    } catch (error) {
      console.error('Error en roleMiddleware:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
      });
    }
  };
}

/**
 * Middleware para solo admin_rh (acceso total)
 */
export function adminRHMiddleware(req, res, next) {
  return roleMiddleware([ROLES.ADMIN_RH])(req, res, next);
}

/**
 * Middleware para admin_area o admin_rh
 * admin_area solo puede ver/gestionar su departamento
 */
export function adminAreaOrRHMiddleware(req, res, next) {
  return roleMiddleware([ROLES.ADMIN_AREA, ROLES.ADMIN_RH])(req, res, next);
}

/**
 * Middleware para cualquier usuario autenticado
 * Agrega datos de rol al request
 */
export async function attachRoleData(req, res, next) {
  try {
    if (!req.user) {
      return next();
    }

    const roleData = await getUserRoleData(req.user.email);
    if (roleData) {
      req.user.role = roleData.role;
      req.user.departamento = roleData.departamento;
      req.user.roleData = roleData;
    } else {
      req.user.role = ROLES.EMPLEADO;
      req.user.departamento = null;
    }

    next();
  } catch (error) {
    console.error('Error en attachRoleData:', error);
    next();
  }
}

/**
 * Verifica si el usuario puede acceder a datos de un departamento especifico
 */
export function canAccessDepartment(userRole, userDepartamento, targetDepartamento) {
  // admin_rh puede acceder a todo
  if (userRole === ROLES.ADMIN_RH) {
    return true;
  }

  // admin_area solo puede acceder a su departamento
  if (userRole === ROLES.ADMIN_AREA) {
    return userDepartamento === targetDepartamento;
  }

  // empleado no tiene acceso a datos de otros
  return false;
}

/**
 * Filtra una lista de usuarios por departamento segun el rol
 */
export function filterByDepartment(users, userRole, userDepartamento) {
  // admin_rh ve todos
  if (userRole === ROLES.ADMIN_RH) {
    return users;
  }

  // admin_area solo ve su departamento
  if (userRole === ROLES.ADMIN_AREA) {
    return users.filter(u => u.departamento === userDepartamento);
  }

  // empleado no ve lista de usuarios
  return [];
}

export default {
  roleMiddleware,
  adminRHMiddleware,
  adminAreaOrRHMiddleware,
  attachRoleData,
  canAccessDepartment,
  filterByDepartment
};
