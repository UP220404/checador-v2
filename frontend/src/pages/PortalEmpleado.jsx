import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

// Componentes del Portal Empleado
import DashboardEmpleado from '../components/empleado/DashboardEmpleado';
import PerfilCompleto from '../components/empleado/PerfilCompleto';
import HistorialMejorado from '../components/empleado/HistorialMejorado';
import SolicitudesTab from '../components/empleado/SolicitudesTab';
import DocumentosTab from '../components/empleado/DocumentosTab';
import NotificacionesTab from '../components/empleado/NotificacionesTab';
import ConfiguracionTab from '../components/empleado/ConfiguracionTab';
import CapacitacionesTab from '../components/empleado/CapacitacionesTab';
import OrganigramaTab from '../components/empleado/OrganigramaTab';
import NominaEmpleadoTab from '../components/empleado/NominaEmpleadoTab';

import { useAuth } from '../contexts/AuthContext';
import '../styles/PortalEmpleado.css';

function PortalEmpleado() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ show: false, type: '', text: '' });

  // Datos compartidos - se cargan bajo demanda
  const [unreadCount, setUnreadCount] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [saldoVacaciones, setSaldoVacaciones] = useState(null);

  // Dropdown de notificaciones en navbar
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifPreview, setNotifPreview] = useState([]);
  const notifDropdownRef = useRef(null);

  // Control de datos ya cargados para evitar llamadas duplicadas
  const loadedData = useRef({
    dashboard: false,
    notifications: false,
    summary: false,
    vacaciones: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const token = await firebaseUser.getIdToken();
        sessionStorage.setItem('authToken', token);
        await cargarDatosUsuario(firebaseUser.uid);
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Cargar datos cuando cambia la pestaña activa
  useEffect(() => {
    if (userData) {
      cargarDatosParaPestana(activeTab);
    }
  }, [activeTab, userData]);

  const mostrarMensaje = useCallback((type, text) => {
    setMensaje({ show: true, type, text });
    setTimeout(() => setMensaje({ show: false, type: '', text: '' }), 5000);
  }, []);

  const cargarDatosUsuario = async (uid) => {
    try {
      setLoading(true);
      const response = await api.getUserById(uid);
      if (response.data.success) {
        setUserData(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      // No mostrar error si es quota exceeded - el usuario verá datos vacios
      if (!error.message?.includes('Quota') && !error.response?.data?.message?.includes('Quota')) {
        mostrarMensaje('error', 'Error al cargar datos del usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  // Carga datos solo para la pestaña actual
  const cargarDatosParaPestana = async (tab) => {
    if (!userData?.uid) return;

    try {
      switch (tab) {
        case 'dashboard':
          // Dashboard necesita: resumen asistencia, saldo vacaciones, notificaciones no leidas
          if (!loadedData.current.dashboard) {
            await cargarDatosDashboard();
            loadedData.current.dashboard = true;
          }
          break;

        case 'historial':
          // Historial necesita: resumen de asistencia
          if (!loadedData.current.summary) {
            await cargarResumenAsistencia();
          }
          break;

        case 'solicitudes':
          // Solicitudes necesita: saldo vacaciones
          if (!loadedData.current.vacaciones) {
            await cargarSaldoVacaciones();
          }
          break;

        case 'notificaciones':
          // Se carga dentro del componente
          break;

        // perfil, documentos, configuracion - se cargan dentro de sus componentes
        default:
          break;
      }
    } catch (error) {
      console.error('Error cargando datos para pestana:', error);
    }
  };

  const cargarDatosDashboard = async () => {
    try {
      // Solo cargar lo que no se ha cargado aun
      const promises = [];

      if (!loadedData.current.notifications) {
        promises.push(
          api.getUnreadNotificationCount()
            .then(res => {
              if (res.data.success) {
                setUnreadCount(res.data.data.count || 0);
                loadedData.current.notifications = true;
              }
            })
            .catch(() => setUnreadCount(0))
        );
      }

      if (!loadedData.current.summary) {
        promises.push(
          api.getAttendanceSummary(userData.uid)
            .then(res => {
              if (res.data.success) {
                setAttendanceSummary(res.data.data);
                loadedData.current.summary = true;
              }
            })
            .catch(() => setAttendanceSummary(null))
        );
      }

      if (!loadedData.current.vacaciones) {
        promises.push(
          api.getSaldoVacaciones(userData.uid)
            .then(res => {
              if (res.data.success) {
                setSaldoVacaciones(res.data.data);
                loadedData.current.vacaciones = true;
              }
            })
            .catch(() => setSaldoVacaciones(null))
        );
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    }
  };

  const cargarResumenAsistencia = async () => {
    try {
      const res = await api.getAttendanceSummary(userData.uid);
      if (res.data.success) {
        setAttendanceSummary(res.data.data);
        loadedData.current.summary = true;
      }
    } catch (error) {
      console.error('Error cargando resumen:', error);
    }
  };

  const cargarSaldoVacaciones = async () => {
    try {
      const res = await api.getSaldoVacaciones(userData.uid);
      if (res.data.success) {
        setSaldoVacaciones(res.data.data);
        loadedData.current.vacaciones = true;
      }
    } catch (error) {
      console.error('Error cargando saldo vacaciones:', error);
    }
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!showNotifDropdown) return;
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown]);

  const cargarNotifPreview = async () => {
    try {
      const response = await api.getMyNotifications({ limit: 5 });
      if (response.data.success) {
        setNotifPreview(response.data.data || []);
        const noLeidas = (response.data.data || []).filter(n => !n.leida).length;
        setUnreadCount(noLeidas);
      }
    } catch (error) {
      console.error('Error cargando preview notificaciones:', error);
    }
  };

  const formatFechaPreview = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const diffMs = Date.now() - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHoras = Math.floor(diffMs / 3600000);
      const diffDias = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins}m`;
      if (diffHoras < 24) return `Hace ${diffHoras}h`;
      if (diffDias < 7) return `Hace ${diffDias}d`;
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const getTabForNotif = (tipo) => {
    if (['permiso_aprobado', 'permiso_rechazado', 'retardo_justificado', 'solicitud_ausencia_confirmacion'].includes(tipo)) return 'solicitudes';
    if (tipo?.startsWith('capacitacion_')) return 'capacitaciones';
    if (tipo === 'documento_nuevo') return 'documentos';
    return null; // no hay tab específico
  };

  const handleBellClick = () => {
    if (!showNotifDropdown) {
      cargarNotifPreview();
    }
    setShowNotifDropdown(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('authToken');
      navigate('/');
    } catch (error) {
      console.error('Error cerrando sesion:', error);
    }
  };

  const actualizarUnreadCount = useCallback((count) => {
    setUnreadCount(count);
    loadedData.current.notifications = true;
  }, []);

  const actualizarUserData = useCallback((data) => {
    setUserData(prevData => ({ ...prevData, ...data }));
  }, []);

  // Forzar recarga de datos (usado despues de crear solicitudes, etc.)
  const recargarDatos = useCallback((tipo) => {
    if (tipo === 'vacaciones') {
      loadedData.current.vacaciones = false;
      cargarSaldoVacaciones();
    } else if (tipo === 'summary') {
      loadedData.current.summary = false;
      cargarResumenAsistencia();
    }
  }, [userData]);

  if (loading) {
    return (
      <div className="portal-container">
        <div className="loading-spinner">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay userData despues de cargar, mostrar mensaje amigable
  if (!userData) {
    return (
      <div className="portal-container">
        <div className="portal-card portal-card-v2">
          <div className="portal-content p-4 text-center">
            <i className="bi bi-exclamation-circle text-warning" style={{ fontSize: '3rem' }}></i>
            <h4 className="mt-3">No se pudieron cargar tus datos</h4>
            <p className="text-muted">
              Esto puede deberse a una sobrecarga temporal del servidor.
              <br />Por favor, espera unos segundos e intenta de nuevo.
            </p>
            <button className="btn btn-success mt-3" onClick={() => window.location.reload()}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Reintentar
            </button>
            <button className="btn btn-outline-secondary mt-3 ms-2" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2"></i>
              Cerrar Sesion
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { id: 'historial', label: 'Historial', icon: 'bi-clock-history' },
    { id: 'nomina', label: 'Mi Nomina', icon: 'bi-wallet2' },
    { id: 'solicitudes', label: 'Solicitudes', icon: 'bi-envelope-paper' },
    { id: 'capacitaciones', label: 'Capacitaciones', icon: 'bi-mortarboard' },
    { id: 'organigrama', label: 'Organigrama', icon: 'bi-diagram-3' },
    { id: 'documentos', label: 'Documentos', icon: 'bi-folder2-open' }
  ];

  const renderTabContent = () => {
    const commonProps = {
      userData,
      user,
      mostrarMensaje
    };

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardEmpleado
            {...commonProps}
            attendanceSummary={attendanceSummary}
            saldoVacaciones={saldoVacaciones}
            unreadCount={unreadCount}
            onNavigateTab={setActiveTab}
          />
        );
      case 'perfil':
        return (
          <PerfilCompleto
            {...commonProps}
            onUpdateUserData={actualizarUserData}
          />
        );
      case 'historial':
        return (
          <HistorialMejorado
            {...commonProps}
            attendanceSummary={attendanceSummary}
          />
        );
      case 'nomina':
        return (
          <NominaEmpleadoTab
            {...commonProps}
          />
        );
      case 'solicitudes':
        return (
          <SolicitudesTab
            {...commonProps}
            saldoVacaciones={saldoVacaciones}
            onRecargarVacaciones={() => recargarDatos('vacaciones')}
          />
        );
      case 'documentos':
        return (
          <DocumentosTab
            {...commonProps}
          />
        );
      case 'capacitaciones':
        return (
          <CapacitacionesTab
            {...commonProps}
          />
        );
      case 'organigrama':
        return (
          <OrganigramaTab
            {...commonProps}
          />
        );
      case 'notificaciones':
        return (
          <NotificacionesTab
            {...commonProps}
            onUpdateUnreadCount={actualizarUnreadCount}
            onNavigateTab={setActiveTab}
          />
        );
      case 'configuracion':
        return (
          <ConfiguracionTab
            {...commonProps}
            onUpdateUserData={actualizarUserData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="portal-container">
      <div className="portal-card portal-card-v2">
        {/* Header */}
        <div className="portal-header portal-header-v2">
          <div className="header-content">
            <div className="user-info">
              <div className="user-avatar-v2" onClick={() => document.getElementById('foto-upload-input').click()} title="Cambiar foto de perfil" style={{ cursor: 'pointer' }}>
                {userData?.fotoUrl ? (
                  <img src={userData.fotoUrl} alt={userData.nombre} />
                ) : (
                  <i className="bi bi-person-fill"></i>
                )}
                <div className="avatar-upload-overlay">
                  <i className="bi bi-camera-fill"></i>
                </div>
                <input
                  id="foto-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setMensaje({ show: true, type: 'danger', text: 'La imagen no puede superar 5MB' });
                      return;
                    }
                    try {
                      setMensaje({ show: true, type: 'info', text: 'Subiendo foto...' });
                      const response = await api.updateProfilePhoto(user.uid, file);
                      if (response.data.success) {
                        setUserData(prev => ({ ...prev, fotoUrl: response.data.data.fotoUrl }));
                        setMensaje({ show: true, type: 'success', text: '¡Foto actualizada!' });
                      }
                    } catch (error) {
                      console.error('Error subiendo foto:', error);
                      setMensaje({ show: true, type: 'danger', text: 'Error al subir la foto' });
                    }
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="user-details">
                <h2>{userData?.nombre || user?.displayName || 'Empleado'}</h2>
                <p className="user-meta">
                  <span>{userData?.puesto || userData?.tipo || 'Empleado'}</span>
                  {userData?.departamento && (
                    <>
                      <span className="separator">|</span>
                      <span>{userData.departamento}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="header-actions">
              {/* Botón de volver a Administración (Solo para Admins) */}
              {(userRole === 'admin_rh' || userRole === 'admin_area') && (
                <button 
                  className="btn-icon admin-shortcut"
                  onClick={() => navigate('/admin/dashboard')}
                  title="Panel de Administración"
                >
                  <i className="bi bi-speedometer2"></i>
                </button>
              )}

              {/* Campana con dropdown */}
              <div className="notif-dropdown-wrapper" ref={notifDropdownRef}>
                <button className={`btn-icon ${showNotifDropdown ? 'active' : ''}`} onClick={handleBellClick} title="Notificaciones">
                  <i className="bi bi-bell"></i>
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                </button>

                {showNotifDropdown && (
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-header">
                      <span>Notificaciones</span>
                      {unreadCount > 0 && <span className="badge bg-danger">{unreadCount} sin leer</span>}
                    </div>
                    <div className="notif-dropdown-list">
                      {notifPreview.length === 0 ? (
                        <div className="notif-dropdown-empty">
                          <i className="bi bi-bell-slash"></i>
                          <span>Sin notificaciones</span>
                        </div>
                      ) : (
                        notifPreview.map(n => {
                          const tabDestino = getTabForNotif(n.tipo);
                          return (
                            <div key={n.id} className={`notif-dropdown-item ${!n.leida ? 'no-leida' : ''}`}>
                              <div className="notif-drop-content">
                                <div className="notif-drop-top">
                                  <span className="notif-drop-titulo">{n.titulo}</span>
                                  <span className="notif-drop-fecha">{formatFechaPreview(n.fechaCreacion)}</span>
                                </div>
                                <span className="notif-drop-msg">{n.mensaje}</span>
                                {tabDestino && (
                                  <button
                                    className="notif-drop-nav-btn"
                                    onClick={() => { setActiveTab(tabDestino); setShowNotifDropdown(false); }}
                                  >
                                    Ver <i className="bi bi-arrow-right"></i>
                                  </button>
                                )}
                              </div>
                              {!n.leida && <span className="notif-drop-dot"></span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="notif-dropdown-footer">
                      <button
                        className="notif-dropdown-ver-btn"
                        onClick={() => { setActiveTab('notificaciones'); setShowNotifDropdown(false); }}
                      >
                        <i className="bi bi-arrow-right-circle me-2"></i>
                        Ver todas las notificaciones
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button className={`btn-icon ${activeTab === 'perfil' ? 'active' : ''}`} onClick={() => setActiveTab('perfil')} title="Mi Perfil">
                <i className="bi bi-person-circle"></i>
              </button>
              <button className={`btn-icon ${activeTab === 'configuracion' ? 'active' : ''}`} onClick={() => setActiveTab('configuracion')} title="Configuracion">
                <i className="bi bi-gear"></i>
              </button>
              <button className="btn-icon" onClick={handleLogout} title="Cerrar Sesion">
                <i className="bi bi-box-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Mensaje de estado */}
        {mensaje.show && (
          <div className={`alert alert-${mensaje.type === 'error' ? 'danger' : mensaje.type} m-3`} role="alert">
            {mensaje.text}
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="portal-tabs portal-tabs-v2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`portal-tab-v2 ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`bi ${tab.icon}`}></i>
              <span className="tab-label">{tab.label}</span>
              {tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="portal-content portal-content-v2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', height: '100%' }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="portal-footer portal-footer-v2">
          <a href="/" className="footer-link">
            <i className="bi bi-qr-code me-2"></i>
            Ir al Checador
          </a>
          <span className="footer-version">Portal Empleado v2.0</span>
        </div>
      </div>
    </div>
  );
}

export default PortalEmpleado;
