import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    // Reloj
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-MX', { hour12: false }));
      setDate(now.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));
    }, 1000);

    // Validar QR
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
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const validarQR = () => {
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    const tokenParam = params.get('token');

    if (qrParam === 'OFICINA2025' && tokenParam) {
      setQrValido(true);
      mostrarStatus('success', '✅ QR válido. Puedes registrar tu asistencia.');
    } else if (!qrParam && !tokenParam) {
      setQrValido(false);
      mostrarStatus('warning', '⚠️ Debes escanear el código QR de la oficina para registrar asistencia.');
    } else {
      setQrValido(false);
      mostrarStatus('error', '❌ QR inválido. Escanea el código correcto.');
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
        mostrarStatus('error', 'Usuario no encontrado en el sistema');
        await handleLogout();
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      mostrarStatus('error', 'Error al cargar datos del usuario');
    }
  };

  const cargarHistorial = async (uid) => {
    try {
      const hoy = new Date();
      const hace7Dias = new Date(hoy);
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const response = await api.getAttendanceRecords({
        userId: uid,
        limit: 50,
        startDate: hace7Dias.toISOString().split('T')[0],
        endDate: hoy.toISOString().split('T')[0]
      });

      if (response.data.success) {
        const registros = response.data.data || [];
        setHistorial(registros.slice(0, 10));
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('authToken');
      mostrarStatus('primary', 'Sesión cerrada correctamente');
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
      mostrarStatus('error', '❌ Debes iniciar sesión primero');
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      const response = await api.registerAttendance({
        userId: user.uid,
        qrToken: token,
        type: 'auto'
      });

      if (response.data.success) {
        const registro = response.data.data;
        setRegistroInfo({
          nombre: userData.name,
          email: userData.email,
          tipo: userData.role,
          fecha: new Date().toLocaleDateString('es-MX'),
          hora: new Date().toLocaleTimeString('es-MX'),
          evento: registro.type === 'entry' ? 'Entrada' : 'Salida'
        });
        mostrarStatus('success', `✅ ${registro.type === 'entry' ? 'Entrada' : 'Salida'} registrada correctamente`);
        await cargarHistorial(user.uid);
      } else {
        mostrarStatus('error', `❌ ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error registrando asistencia:', error);
      mostrarStatus('error', '❌ Error al registrar asistencia');
    }
  };

  const mostrarStatus = (type, message) => {
    setStatus({ show: true, type, message });
    setTimeout(() => {
      setStatus({ show: false, type: '', message: '' });
    }, 5000);
  };

  return (
    <div className="login-container"> {/* Reutilizamos el container premium */}
      <motion.div 
        className="container py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div 
          className="login-card mx-auto" 
          style={{ maxWidth: '500px' }}
          initial={{ y: 20 }}
          animate={{ y: 0 }}
        >
          <div className="text-center mb-4">
            <div className="logo-premium mb-3">
              <i className="bi bi-person-badge-fill"></i>
            </div>
            <h2 className="mb-1">Control de Asistencia</h2>
            <p className="text-muted small">Cielito Home</p>
          </div>

          <div className="user-info-banner mb-4 text-center">
            <p className="mb-0 fw-bold">
              {user ? `Bienvenido, ${userData?.name || user.displayName || user.email}` : 'Iniciando sesión...'}
            </p>
          </div>

          <div className="time-display-premium mb-4 text-center">
            <div className="display-4 fw-bold">{time}</div>
            <div className="text-muted">{date}</div>
          </div>

          <div className="d-grid gap-2 mb-4">
            <button
              onClick={registrarAsistencia}
              disabled={!qrValido}
              className="btn btn-success btn-lg rounded-pill"
            >
              <i className="bi bi-check-circle-fill me-2"></i>
              Registrar Asistencia
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-outline-danger border-0"
            >
              <i className="bi bi-box-arrow-right me-2"></i>
              Cerrar Sesión
            </button>
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
              className="mt-4 p-3 bg-white rounded shadow-sm text-start"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <h6 className="border-bottom pb-2 mb-3">Último Registro</h6>
              <div className="small">
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Evento:</span>
                  <span className="fw-bold text-success">{registroInfo.evento}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Hora:</span>
                  <span>{registroInfo.hora}</span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="text-center mt-4">
            <a href="/empleado/portal" className="btn btn-link link-success text-decoration-none">
              <i className="bi bi-person-circle me-1"></i>
              Mi Portal de Empleado
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Checador;
