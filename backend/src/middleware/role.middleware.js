/**
 * Middleware de Roles — RBAC completo
 *
 * Jerarquía de roles:
 *   super_admin  → Acceso total, sin restricciones
 *   director     → Acceso total excepto Config / Auditoría técnica
 *   admin_rh     → Usuarios, Registros, Ausencias, Reportes, Vac., Docs, Eval. Contratos
 *   admin_area   → Como RH pero filtrado a su departamento + Evaluaciones desempeño
 *   sistemas     → Solo QR / Agenda
 *   marketing    → Solo módulo de Marketing (por rol O por departamento)
 *   empleado     → Solo portal del empleado
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, HTTP_STATUS, ERROR_MESSAGES, ROLES } from '../config/constants.js';

// ────────────────────────────────────────────────────────────────
// Jerarquía: quién incluye a quién (arriba → abajo)
// ────────────────────────────────────────────────────────────────
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 5,
  [ROLES.DIRECTOR]:    4,
  [ROLES.ADMIN_RH]:    3,
  [ROLES.ADMIN_AREA]:  2,
  [ROLES.EMPLEADO]:    1,
};

function hasRole(userRole, ...allowedRoles) {
  return allowedRoles.includes(userRole);
}

function isSuperOrDirector(role) {
  return hasRole(role, ROLES.SUPER_ADMIN, ROLES.DIRECTOR);
}

// ────────────────────────────────────────────────────────────────
//  Obtener datos de rol desde Firestore (o .env para super_admin)
// ────────────────────────────────────────────────────────────────
export async function getUserRoleData(email) {
  try {
    const userEmail = email?.toLowerCase() || '';
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isSuperAdmin = adminEmails.includes(userEmail);

    const db = getFirestore();
    const usersRef = db.collection(COLLECTIONS.USUARIOS);

    // Buscar primero por campo 'email' (usuarios nuevos), luego por 'correo' (legacy)
    let snapshot = await usersRef.where('email', '==', userEmail).limit(1).get();
    if (snapshot.empty) {
      snapshot = await usersRef.where('correo', '==', userEmail).limit(1).get();
    }

    if (snapshot.empty) {
      if (isSuperAdmin) {
        return {
          uid: 'super-admin',
          role: ROLES.SUPER_ADMIN,
          departamento: null, // super_admin tiene visibilidad global, no está limitado a Dirección
          nombre: 'Super Administrador'
        };
      }
      return null;
    }

    const userData = snapshot.docs[0].data();
    const dbRole = userData.role || ROLES.EMPLEADO;

    // Si está en .env, siempre es SUPER_ADMIN independientemente del rol en BD
    const role = isSuperAdmin ? ROLES.SUPER_ADMIN : dbRole;

    return {
      uid: snapshot.docs[0].id,
      role,
      departamento: isSuperAdmin ? null : (userData.departamento || null),
      nombre: userData.nombre
    };
  } catch (error) {
    console.error('Error obteniendo datos de rol:', error);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
//  Middleware base: verifica que el rol esté en la lista permitida
//  También acepta verificación por departamento
// ────────────────────────────────────────────────────────────────
export function roleMiddleware(allowedRoles, allowedDepts = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.AUTH.NOT_AUTHORIZED
        });
      }

      const roleData = await getUserRoleData(req.user.email);
      if (!roleData) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Usuario no encontrado en el sistema'
        });
      }

      req.user.role        = roleData.role;
      req.user.departamento = roleData.departamento;
      req.user.roleData    = roleData;

      const hasAllowedRole = allowedRoles.some(role => 
        role?.toLowerCase() === roleData.role?.toLowerCase()
      );
      const hasAllowedDept = allowedDepts.length > 0 && allowedDepts.some(dept =>
        dept?.toLowerCase() === roleData.departamento?.toLowerCase()
      );

      if (!hasAllowedRole && !hasAllowedDept) {
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

// ────────────────────────────────────────────────────────────────
//  Middleware adjuntar datos de rol (sin bloquear)
// ────────────────────────────────────────────────────────────────
export async function attachRoleData(req, res, next) {
  try {
    if (!req.user) return next();

    const roleData = await getUserRoleData(req.user.email);
    if (roleData) {
      req.user.role        = roleData.role;
      req.user.departamento = roleData.departamento;
      req.user.roleData    = roleData;
    } else {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
      if (adminEmails.includes(req.user.email)) {
        req.user.role        = ROLES.SUPER_ADMIN;
        req.user.departamento = 'Direccion';
      } else {
        req.user.role        = ROLES.EMPLEADO;
        req.user.departamento = null;
      }
    }
    next();
  } catch (error) {
    console.error('Error en attachRoleData:', error);
    next();
  }
}

// ────────────────────────────────────────────────────────────────
//  MIDDLEWARES ESPECÍFICOS POR NIVEL DE ACCESO
// ────────────────────────────────────────────────────────────────

/** Solo Super Admin */
export const superAdminMiddleware = roleMiddleware([ROLES.SUPER_ADMIN]);

/** Super Admin + Director */
export const directorOrAboveMiddleware = roleMiddleware([
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR
]);

/** Super Admin + Director + RH → gestión de personal en toda la empresa */
export const rhOrAboveMiddleware = roleMiddleware([
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN_RH
]);

/** Super Admin + Director + RH + Jefe de Área → cualquier admin de área */
export const adminAreaOrRHMiddleware = roleMiddleware([
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN_RH,
  ROLES.ADMIN_AREA
]);

/** Solo roles que pueden ser administradores del panel (no empleado, no sistemas, no marketing puro) */
export const adminPanelMiddleware = roleMiddleware([
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN_RH,
  ROLES.ADMIN_AREA
]);



/** Marketing: por rol ADMIN_RH/SUPER/DIRECTOR, o por departamento Marketing */
export async function marketingMiddleware(req, res, next) {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.AUTH.NOT_AUTHORIZED
      });
    }

    const roleData = await getUserRoleData(req.user.email);
    if (!roleData) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    req.user.role        = roleData.role;
    req.user.departamento = roleData.departamento;

    const hasAccess =
      isSuperOrDirector(roleData.role)          ||
      roleData.departamento === 'Marketing';

    if (!hasAccess) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'No tienes permisos de Marketing para acceder a este recurso'
      });
    }

    next();
  } catch (error) {
    console.error('Error en marketingMiddleware:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
    });
  }
}

// ────────────────────────────────────────────────────────────────
//  Legacy: compatibilidad con código que aún usa adminRHMiddleware
// ────────────────────────────────────────────────────────────────
export const adminRHMiddleware    = rhOrAboveMiddleware;
export const adminMiddleware      = adminAreaOrRHMiddleware;

// ────────────────────────────────────────────────────────────────
//  Utilidades de verificación
// ────────────────────────────────────────────────────────────────
export function canAccessDepartment(userRole, userDepartamento, targetDepartamento) {
  if (isSuperOrDirector(userRole) || userRole === ROLES.ADMIN_RH) return true;
  if (userRole === ROLES.ADMIN_AREA) return userDepartamento === targetDepartamento;
  return false;
}

export function filterByDepartment(users, userRole, userDepartamento) {
  if (isSuperOrDirector(userRole) || userRole === ROLES.ADMIN_RH) return users;
  if (userRole === ROLES.ADMIN_AREA) return users.filter(u => u.departamento === userDepartamento);
  return [];
}

export default {
  roleMiddleware,
  attachRoleData,
  superAdminMiddleware,
  directorOrAboveMiddleware,
  rhOrAboveMiddleware,
  adminAreaOrRHMiddleware,
  adminPanelMiddleware,
  marketingMiddleware,
  adminRHMiddleware,
  adminMiddleware,
  canAccessDepartment,
  filterByDepartment
};
