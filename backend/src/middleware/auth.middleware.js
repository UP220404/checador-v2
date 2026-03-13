import { getAuth } from '../config/firebase.js';
import { ERROR_MESSAGES, HTTP_STATUS, ROLES } from '../config/constants.js';

/**
 * Middleware para verificar token de Firebase Authentication
 */
export async function authMiddleware(req, res, next) {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.AUTH.NO_TOKEN
      });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.AUTH.NO_TOKEN
      });
    }

    // Verificar token con Firebase Admin
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Agregar información del usuario al request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
      emailVerified: decodedToken.email_verified
    };

    next();

  } catch (error) {
    console.error('Error verificando token:', error);

    // Manejar errores específicos de Firebase
    if (error.code === 'auth/id-token-expired') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.AUTH.EXPIRED_TOKEN
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.AUTH.INVALID_TOKEN
      });
    }

    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.AUTH.INVALID_TOKEN
    });
  }
}

/**
 * Middleware para verificar si el usuario es administrador
 * Unifica ADMIN_EMAILS (.env) con el rol ADMIN_RH (Firestore)
 */
export async function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.AUTH.NOT_AUTHORIZED
    });
  }

  // Robustez: Si por alguna razón el rol no se ha cargado todavía, lo cargamos aquí
  if (!req.user.role) {
    try {
      const { getUserRoleData } = await import('./role.middleware.js');
      const roleData = await getUserRoleData(req.user.email);
      if (roleData) {
        req.user.role = roleData.role;
        req.user.departamento = roleData.departamento;
      }
    } catch (error) {
      console.error('[adminMiddleware] Error cargando rol de respaldo:', error);
    }
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  
  // Es Admin si está en el .env O si ya tiene el rol admin_rh cargado
  const isSuperAdmin = adminEmails.includes(req.user.email);
  const isRHAdmin = req.user.role === ROLES.ADMIN_RH;

  if (!isSuperAdmin && !isRHAdmin) {
    console.warn(`[adminMiddleware] Acceso denegado para: ${req.user.email} con rol: ${req.user.role}`);
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: ERROR_MESSAGES.AUTH.NOT_ADMIN
    });
  }

  req.user.isAdmin = true;
  next();
}

export default {
  authMiddleware,
  adminMiddleware
};
