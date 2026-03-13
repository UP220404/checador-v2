import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import ParticlesBackground from '../components/ParticlesBackground';
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
    // Si ya hay una sesión activa, intentar redirigir automáticamente
    const checkSession = async () => {
      if (auth.currentUser) {
        await handleRedirect(auth.currentUser);
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
          return;
        }

        // Caso 2: Login general - Redirigir según rol
        if (userRole === ROLES.ADMIN_RH || userRole === ROLES.ADMIN_AREA) {
          navigate('/admin/dashboard');
        } else {
          navigate('/empleado/portal');
        }
      } else {
        // Fallback si no hay rol definido
        navigate('/empleado/portal');
      }
    } catch (apiError) {
      console.error('[Login] Error en redirección:', apiError);
      navigate('/empleado/portal');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Guardar información básica
      const token = await result.user.getIdToken();
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('userEmail', result.user.email);

      await handleRedirect(result.user);

    } catch (err) {
      console.error('Error en login:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado');
      } else if (err.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana. Por favor, permítela.');
      } else {
        setError('Error al conectar con Google. Reintenta.');
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
              className="logo-premium"
              initial={{ rotate: -15, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <i className="bi bi-shield-check"></i>
            </motion.div>
            <h2>Bienvenido</h2>
            <p>Inicia sesión para acceder a Cielito Home</p>
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
              <span>{fromQR ? 'Escaneo de QR detectado. Identifícate para registrar tu asistencia.' : 'Usa tu cuenta institucional de Google para ingresar de forma segura.'}</span>
            </div>

            <button
              className="btn-google-premium"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            <div className="authorized-roles">
              <div className="role-badge">
                <i className="bi bi-person-workspace"></i>
                Staff
              </div>
              <div className="role-badge">
                <i className="bi bi-person-gear"></i>
                Admin Area
              </div>
              <div className="role-badge">
                <i className="bi bi-shield-lock"></i>
                Admin RH
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default Login;

