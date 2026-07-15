import { getAuth, getFirestore } from '../config/firebase.js';
import { COLLECTIONS, ERROR_MESSAGES, HTTP_STATUS, ROLES } from '../config/constants.js';

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

    // Verificar token con Firebase Admin (forzamos checkRevoked para expulsar instantáneamente)
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token, true);

    // Aplicar el proveedor configurado tambien a llamadas directas a la API,
    // no solo durante la redireccion posterior al login.
    const userEmail = decodedToken.email?.trim().toLowerCase();
    const usersRef = getFirestore().collection(COLLECTIONS.USUARIOS);
    let userDoc = null;

    if (userEmail) {
      let snapshot = await usersRef
        .where('email', '==', userEmail)
        .limit(1)
        .get();
      if (snapshot.empty) {
        snapshot = await usersRef.where('correo', '==', userEmail).limit(1).get();
      }

      if (!snapshot.empty) {
        userDoc = snapshot.docs[0];
      }
    }

    // Al migrar el email, la cuenta anterior de Google conserva temporalmente
    // el UID que identifica el documento. Resolver tambien por UID evita que el
    // email viejo se salte la restriccion de proveedor.
    if (!userDoc && decodedToken.uid) {
      const snapshotByUid = await usersRef.doc(decodedToken.uid).get();
      if (snapshotByUid.exists) {
        userDoc = snapshotByUid;
      }
    }

    if (userDoc) {
      const userData = userDoc.data();
      const allowedProvider = userData.authProvider || 'microsoft.com';
      const loginProvider = decodedToken.firebase?.sign_in_provider || '';
      if (loginProvider !== allowedProvider) {
        const providerName = allowedProvider === 'google.com' ? 'Google' : 'Microsoft';
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: `Esta cuenta debe iniciar sesion con ${providerName}.`
        });
      }
    }

    // Agregar información del usuario al request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
      emailVerified: decodedToken.email_verified,
      authProvider: decodedToken.firebase?.sign_in_provider || ''
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

    if (error.code === 'auth/id-token-revoked') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Tu sesión ha sido revocada (cambio de correo o seguridad). Por favor inicia sesión nuevamente.'
      });
    }

    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.AUTH.INVALID_TOKEN
    });
  }
}

/**
 * Middleware para verificar si el usuario puede acceder al panel de administrador.
 * Acepta: super_admin, director, admin_rh, admin_area
 */
export async function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.AUTH.NOT_AUTHORIZED
    });
  }

  // Cargar rol si no está cargado aún
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

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const userEmail = req.user.email?.toLowerCase() || '';
  const isSuperAdmin = adminEmails.includes(userEmail);
  const adminRoles = [
    ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.ADMIN_RH, ROLES.ADMIN_AREA
  ];
  const hasAdminRole = adminRoles.includes(req.user.role);

  if (!isSuperAdmin && !hasAdminRole) {
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
