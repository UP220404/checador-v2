import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup, OAuthProvider, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import ParticlesBackground from '../components/ParticlesBackground';
import logoCielito from '../assets/logo-cielito.png';
import '../styles/Login.css';

const ROLES = {
  EMPLEADO: 'empleado',
  ADMIN_AREA: 'admin_area',
  ADMIN_RH: 'admin_rh'
};

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const containerRef = useRef(null);

  // Parámetros de URL para redirección inteligente (ej. QR)
  const queryParams = new URLSearchParams(location.search);
  const fromQR = queryParams.get('qr');
  const qrToken = queryParams.get('token');

  useEffect(() => {
    // Cargar error persistente si existe (ej. denegado por AuthContext)
    const savedError = sessionStorage.getItem('authError');
    if (savedError) {
      setError(savedError);
    }

    // Si ya hay una sesión activa, intentar redirigir automáticamente
    const checkSession = async () => {
      if (auth.currentUser) {
        // Si hay error en sesión, no intentar redirección automática
        if (!savedError) {
          await handleRedirect(auth.currentUser);
        }
      }
      setCheckingAuth(false);
    };
    checkSession();
  }, []);

  const handleContainerClick = (e) => {
    // Solo si se hace clic directamente en el contenedor (fondo), no en la tarjeta
    if (e.target === containerRef.current) {
      // El componente ParticlesBackground ya escucha touchstart/click de forma global o vía eventos
      // Pero para asegurar que sea "vistozo", delegamos la interacción al sensor del canvas.
    }
  };

  const handleRedirect = async (user) => {
    try {
      const response = await api.getCurrentUserRole();
      
      if (response.data.success) {
        const roleData = response.data.data;
        const userRole = roleData.role || ROLES.EMPLEADO;

        // Caso 1: Viene de un escaneo de QR (Redirigir a Checador con los params)
        if (fromQR && qrToken) {
          navigate(`/?qr=${fromQR}&token=${qrToken}`);
          return true;
        }

        // Caso 2: Login general - Redirigir según rol
        const adminRoles = ['super_admin', 'director', ROLES.ADMIN_RH, ROLES.ADMIN_AREA, 'sistemas'];
        if (adminRoles.includes(userRole)) {
          navigate('/admin/dashboard');
        } else {
          navigate('/empleado/portal');
        }
        return true;
      } else {
        // Acceso denegado por el backend
        setError(response.data?.message || 'No autorizado');
        return false;
      }
    } catch (apiError) {
      console.error('[Login] Error en redirección:', apiError);
      const errorMsg = apiError.response?.data?.message || 'Error al conectar con el servidor';
      setError(errorMsg);
      return false;
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true);
      setError('');
      sessionStorage.removeItem('authError'); // Limpiar errores previos

      const microsoftTenant = import.meta.env.VITE_MICROSOFT_TENANT_ID?.trim();
      if (!microsoftTenant) {
        setError('Falta VITE_MICROSOFT_TENANT_ID. Agrega el Directory (tenant) ID de Microsoft Entra en el archivo .env del frontend para usar el endpoint correcto.');
        return;
      }

      const provider = new OAuthProvider('microsoft.com');
      provider.addScope('User.Read');
      provider.setCustomParameters({
        prompt: 'select_account',
        tenant: microsoftTenant
      });

      const result = await signInWithPopup(auth, provider);

      // Guardar información básica
      const token = await result.user.getIdToken();
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('userEmail', result.user.email);

      const authorized = await handleRedirect(result.user);
      if (!authorized) {
        await signOut(auth);
        sessionStorage.removeItem('authToken');
      }

    } catch (err) {
      console.error('Error en login:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado');
      } else if (err.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana. Por favor, permítela.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Microsoft Sign-In no está habilitado en Firebase Authentication. Activa el proveedor en la consola de Firebase y agrega los redirect URIs en Microsoft Entra.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('La configuración de Microsoft no es válida. Revisa el tenant, el client ID y los redirect URIs en Firebase y Microsoft Entra.');
      } else {
        setError('Error al conectar con Microsoft. Reintenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      sessionStorage.removeItem('authError');

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('userEmail', result.user.email);
      const authorized = await handleRedirect(result.user);
      if (!authorized) {
        await signOut(auth);
        sessionStorage.removeItem('authToken');
      }
    } catch (err) {
      console.error('Error en login con Google:', err);
      if (auth.currentUser) await signOut(auth);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesiÃ³n cancelado');
      } else if (err.code === 'auth/popup-blocked') {
        setError('El navegador bloqueÃ³ la ventana. Por favor, permÃ­tela.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In no estÃ¡ habilitado en Firebase Authentication.');
      } else {
        setError(err.response?.data?.message || 'Error al conectar con Google. Reintenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="login-container">
        <ParticlesBackground />
        <div className="spinner-border text-success" role="status" style={{ zIndex: 10 }}>
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="login-container" 
      ref={containerRef}
      onMouseDown={handleContainerClick}
    >
      <ParticlesBackground />
      
      <AnimatePresence>
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login-header">
            <motion.div 
              className="logo-container-premium"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
            >
              <img src={logoCielito} alt="Cielito Home Logo" className="login-logo-img" />
              <div className="brand-divider"></div>
              <motion.h1 
                className="brand-name-cursive"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                Cielito Home
              </motion.h1>
            </motion.div>
            <h2 className="welcome-text">Bienvenido</h2>
            <p>Inicia sesión para acceder al sistema</p>
          </div>

          <div className="login-body">
            {error && (
              <motion.div 
                className="error-message"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <i className="bi bi-exclamation-circle"></i>
                {error}
              </motion.div>
            )}

            <div className="info-banner">
              <i className="bi bi-info-circle-fill"></i>
              <span>{fromQR ? 'Escaneo de QR detectado. Identifícate para registrar tu asistencia.' : 'Usa tu cuenta institucional de Microsoft para ingresar de forma segura.'}</span>
            </div>

            <button
              className="btn-google-premium"
              onClick={handleMicrosoftLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="3" y="3" width="8" height="8" rx="1" fill="#f25022"/>
                    <rect x="13" y="3" width="8" height="8" rx="1" fill="#00a4ef"/>
                    <rect x="3" y="13" width="8" height="8" rx="1" fill="#7fba00"/>
                    <rect x="13" y="13" width="8" height="8" rx="1" fill="#ffb900"/>
                  </svg>
                  Continuar con Microsoft
                </>
              )}
            </button>

            <div className="text-center text-muted my-3 small">Acceso para cuentas autorizadas</div>

            <button
              className="btn btn-outline-secondary w-100"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <i className="bi bi-google me-2"></i>
              Continuar con Google
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default Login;

