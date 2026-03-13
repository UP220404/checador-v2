import { useState, useEffect, useRef } from 'react';
import { auth } from '../config/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import ParticlesBackground from '../components/ParticlesBackground';
import logoCielito from '../assets/logo-cielito.png';
import '../styles/Checador.css';

function Checador() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [time, setTime] = useState('--:--:--');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState({ show: false, type: '', message: '' });
  const [registroInfo, setRegistroInfo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [qrValido, setQrValido] = useState(false);

  const [autoRegistrando, setAutoRegistrando] = useState(false);
  const registradoRef = useRef(false);

  useEffect(() => {
    // Reloj
    const timerTick = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-MX', { hour12: false }));
      setDate(now.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));
    }, 1000);

    // Validar QR inicial
    validarQR();

    // Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await cargarDatosUsuario(firebaseUser.uid);
        await cargarHistorial(firebaseUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setRegistroInfo(null);
        setHistorial([]);
        registradoRef.current = false;
      }
    });

    return () => {
      clearInterval(timerTick);
      unsubscribe();
    };
  }, []);

  // Lógica de registro automático
  useEffect(() => {
    if (qrValido && user && userData && !registradoRef.current && !registroInfo) {
      // Candado definitivo para evitar bucles
      registradoRef.current = true;
      setAutoRegistrando(true);
      
      console.log('🚀 Disparando marcaje automático robusto...');
      
      // Pausa breve para que el usuario capte el contexto
      const autoTimer = setTimeout(() => {
        registrarAsistencia();
      }, 1000);
      
      return () => clearTimeout(autoTimer);
    }
  }, [qrValido, user, userData, registroInfo]);

  const validarQR = () => {
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    const tokenParam = params.get('token');

    if (qrParam === 'OFICINA2025' && tokenParam) {
      setQrValido(true);
      mostrarStatus('success', '✅ QR Detectado. Registrando entrada/salida automáticamente...');
      
      // Limpieza retrasada: No borramos hasta que el registro automático haya tenido 
      // tiempo suficiente de leer el token de la URL.
      setTimeout(() => {
        if (window.location.search.includes('token=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 5000);

    } else if (!qrParam && !tokenParam) {
      setQrValido(false);
      // No mostrar warning si no hay params (entrada normal al sitio)
    } else {
      setQrValido(false);
      mostrarStatus('error', '❌ Código QR inválido o expirado.');
    }
  };

  const cargarDatosUsuario = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken();
      sessionStorage.setItem('authToken', token);

      try {
        const roleResponse = await api.getCurrentUserRole();
        if (roleResponse.data.success) {
          const roleData = roleResponse.data.data;
          sessionStorage.setItem('userRole', roleData.role || 'empleado');
          sessionStorage.setItem('userDepartamento', roleData.departamento || '');
          sessionStorage.setItem('userName', roleData.nombre || '');
        }
      } catch (roleError) {
        console.error('Error obteniendo rol:', roleError);
      }

      const response = await api.getUserById(uid);
      if (response.data.success) {
        setUserData(response.data.data);
      } else {
        mostrarStatus('error', 'Usuario no registrado en el sistema.');
        setTimeout(() => handleLogout(), 3000);
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      mostrarStatus('error', 'Error de conexión con el servidor.');
    }
  };

  const cargarHistorial = async (uid) => {
    try {
      const hoy = new Date();
      const hace7Dias = new Date(hoy);
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const response = await api.getAttendanceRecords({
        userId: uid,
        limit: 10,
        startDate: hace7Dias.toISOString().split('T')[0],
        endDate: hoy.toISOString().split('T')[0]
      });

      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const registrarAsistencia = async () => {
    if (!qrValido) {
      mostrarStatus('error', '❌ Debes escanear el código QR de la oficina');
      return;
    }

    if (!user || !userData) {
      mostrarStatus('error', '❌ Sesión no válida');
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      // Obtener ubicación si es posible
      let location = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      } catch (e) {
        console.warn('No se pudo obtener ubicación');
      }

      const response = await api.registerAttendance({
        qrCode: 'OFICINA2025',
        token: token,
        location: location
      });

      if (response.data.success) {
        const registro = response.data.data;
        setRegistroInfo({
          nombre: userData.nombre,
          tipo: userData.role,
          fecha: registro.fecha,
          hora: registro.hora,
          evento: registro.tipoEvento === 'entrada' ? 'ENTRADA' : 'SALIDA',
          estado: registro.estado
        });
        mostrarStatus('success', registro.tipoEvento === 'entrada' ? '✅ ¡Entrada Registrada!' : '📤 ¡Salida Registrada!');
        await cargarHistorial(user.uid);
      } else {
        mostrarStatus('error', `❌ ${response.data.message}`);
        setAutoRegistrando(false); // Permitir reintento manual si falló por horario/CORS/etc
      }
    } catch (error) {
      console.error('Error registrando asistencia:', error);
      const msg = error.response?.data?.message || 'Error al conectar con el servidor';
      mostrarStatus('error', `❌ ${msg}`);
      setAutoRegistrando(false);
    }
  };

  const mostrarStatus = (type, message) => {
    setStatus({ show: true, type, message });
    setTimeout(() => {
      setStatus({ show: false, type: '', message: '' });
    }, 6000);
  };

  // Determinar si es administrador para mostrar botón de RH
  const isAdmin = userData?.role === 'admin_rh' || sessionStorage.getItem('userRole') === 'admin_rh';

  return (
    <div className="login-container" style={{ position: 'relative' }}>
      <ParticlesBackground />
      
      <motion.div 
        className="container py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ position: 'relative', zIndex: 10 }}
      >
        <motion.div 
          className="login-card mx-auto" 
          style={{ maxWidth: '440px' }}
          initial={{ y: 20 }}
          animate={{ y: 0 }}
        >
          <div className="text-center mb-4">
            <div className="logo-container-premium mb-2" style={{ transform: 'scale(0.8)', marginBottom: '-10px' }}>
              <img src={logoCielito} alt="Cielito Home" className="login-logo-img" style={{ width: '100px' }} />
            </div>
            <h2 className="welcome-text fs-3 mb-1">Control de Asistencia</h2>
            <div className="brand-divider mx-auto mt-2" style={{ width: '60px' }}></div>
          </div>

          <div className="mb-4 text-center">
            <p className="mb-0 fw-medium text-white-50" style={{ fontSize: '1.1rem' }}>
              {user ? (
                <span>
                  Bienvenido, <span className="text-white fw-bold">{userData?.name || user.displayName || user.email}</span>
                </span>
              ) : 'Identificación requerida'}
            </p>
          </div>

          <div className="time-display-premium mb-4 text-center">
            <div className="display-4 fw-bold" style={{ color: '#ffffff', letterSpacing: '2px', textShadow: '0 0 20px rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              {time}
            </div>
            <div className="text-white-50 small text-uppercase" style={{ letterSpacing: '1px' }}>{date}</div>
          </div>

          <div className="d-grid gap-3 mb-4">
            <button
              onClick={registrarAsistencia}
              disabled={autoRegistrando && !registroInfo}
              className={`btn btn-lg rounded-pill ${qrValido ? 'btn-success text-white fw-bold shadow-sm' : 'btn-outline-secondary text-white-50'}`}
              style={qrValido ? { background: 'linear-gradient(135deg, #198754 0%, #157347 100%)', border: 'none' } : {}}
            >
              <i className={`bi ${autoRegistrando && !registroInfo ? 'bi-hourglass-split' : 'bi-fingerprint'} me-2 fs-5`}></i>
              {autoRegistrando && !registroInfo ? 'Procesando...' : 'Registrar Asistencia'}
            </button>
            
            <div className="d-flex justify-content-between align-items-center mt-2 px-2">
              <a href="/empleado/portal" className="text-white-50 text-decoration-none small hover-white transition-all">
                <i className="bi bi-person-workspace me-1"></i>
                Ir a mi Portal
              </a>

              <button
                onClick={handleLogout}
                className="btn btn-link text-danger text-decoration-none small p-0 m-0 opacity-75 hover-opacity-100"
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                Cerrar Sesión
              </button>
            </div>
          </div>

          <AnimatePresence>
            {status.show && (
              <motion.div 
                className={`alert alert-${status.type} text-center`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>

          {registroInfo && (
            <motion.div 
              className="mt-4 p-4 rounded-4 text-start border border-success border-opacity-25"
              style={{ background: 'rgba(25, 135, 84, 0.1)', backdropFilter: 'blur(10px)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="d-flex align-items-center mb-3">
                <div className="bg-success text-white p-2 rounded-circle me-3 shadow-sm d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                  <i className="bi bi-calendar-check fs-5"></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-white">Registro Exitoso</h6>
                  <p className="text-white-50 small mb-0">{registroInfo.fecha}</p>
                </div>
              </div>

              <div className="attendance-details-grid small mb-4">
                <div className="d-flex justify-content-between p-2 rounded-3 mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-white-50">Colaborador:</span>
                  <span className="fw-bold text-white">{registroInfo.nombre}</span>
                </div>
                <div className="d-flex justify-content-between p-2 rounded-3 mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-white-50">Movimiento:</span>
                  <span className={`fw-bold ${registroInfo.evento === 'ENTRADA' ? 'text-info' : 'text-warning'}`}>
                    {registroInfo.evento}
                  </span>
                </div>
                <div className="d-flex justify-content-between p-2 rounded-3 mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-white-50">Hora:</span>
                  <span className="fw-bold text-white">{registroInfo.hora}</span>
                </div>
                <div className="d-flex justify-content-between p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-white-50">Estado:</span>
                  <span className={`badge rounded-pill ${
                    registroInfo.estado === 'puntual' ? 'bg-success text-white' : 
                    registroInfo.estado === 'retardo' ? 'bg-warning text-dark' : 'bg-info text-dark'
                  }`}>
                    {registroInfo.estado.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="d-grid gap-2">
                <a href="/empleado/portal" className="btn btn-outline-light rounded-pill py-2">
                  <i className="bi bi-person-workspace me-2"></i>
                  Ver Resumen Semanal
                </a>
              </div>
            </motion.div>
          )}

        </motion.div>
      </motion.div>
    </div>
  );
}

export default Checador;
