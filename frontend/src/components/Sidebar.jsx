import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Sidebar.css';

const ROLES = {
  EMPLEADO: 'empleado',
  ADMIN_AREA: 'admin_area',
  ADMIN_RH: 'admin_rh'
};

function Sidebar({ isMobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole: authRole, userName: authName, userDepartamento: authDept, loading: authLoading, refreshUser, user: authUser } = useAuth();

  // Cerrar sidebar automáticamente al navegar en móviles
  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al montar el Sidebar, refrescar datos del usuario desde el backend
  // Esto garantiza que el nombre siempre esté actualizado sin necesidad de recargar
  useEffect(() => {
    refreshUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras el contexto carga, usar localStorage como placeholder
  // Una vez que carga, usar siempre el valor del contexto (fuente de verdad)
  const userRole = authRole || sessionStorage.getItem('userRole') || ROLES.EMPLEADO;
  const userDepartamento = authDept || sessionStorage.getItem('userDepartamento') || '';
  const userName = authLoading
    ? (sessionStorage.getItem('userName') || '')
    : (authName || '');

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const notifRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(false); // Nuevo estado para isAdmin

  // Verificar permisos de administrador (Súper Admin o RH)
  useEffect(() => {
    const sessionUserRole = sessionStorage.getItem('userRole');
    const userEmail = auth.currentUser?.email;
    const adminEmails = process.env.VITE_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    
    setIsAdmin(sessionUserRole === ROLES.ADMIN_RH || adminEmails.includes(userEmail));
  }, [auth.currentUser?.email]); // Dependencia para re-evaluar si el usuario de auth cambia

  // Listener en tiempo real — sin polling, cero peticiones al backend
  useEffect(() => {
    if (!authUser?.uid) return;

    setLoadingNotif(true);
    const q = query(
      collection(db, 'notificaciones'),
      where('uid', '==', authUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let notifs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        fechaCreacion: d.data().fechaCreacion?.toDate?.()?.toISOString() ?? d.data().fechaCreacion ?? null
      }));
      // Ordenar y limitar en memoria (evita índices compuestos en Firestore)
      notifs.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
      setNotifications(notifs.slice(0, 8));
      setLoadingNotif(false);
    }, (error) => {
      // Reglas de Firestore pendientes de configurar — silenciar en consola, mostrar vacío
      if (error?.code === 'permission-denied') {
        setNotifications([]);
      }
      setLoadingNotif(false);
    });

    return () => unsubscribe();
  }, [authUser?.uid]);

  useEffect(() => {
    if (!showNotifDropdown) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown]);

  const handleBellClick = () => {
    setShowNotifDropdown(prev => !prev);
  };

  const handleMarkRead = async (e, notifId) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notificaciones', notifId), { leida: true });
      // onSnapshot actualiza el estado automáticamente
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('userDepartamento');
      sessionStorage.removeItem('userEmail');
      sessionStorage.removeItem('userName');
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesion:', error);
    }
  };

  // Configuración visual por tipo de notificación
  const getTipoConfig = (tipo) => {
    const map = {
      evaluacion_contrato_pendiente: { color: '#f59e0b', bg: '#fef3c7', icon: 'bi-clipboard-check' },
      evaluacion_contrato_proxima:   { color: '#f59e0b', bg: '#fef3c7', icon: 'bi-calendar-event' },
      contrato_por_vencer:           { color: '#ef4444', bg: '#fee2e2', icon: 'bi-exclamation-triangle' },
      contrato_extendido:            { color: '#10b981', bg: '#d1fae5', icon: 'bi-arrow-repeat' },
      contrato_indefinido:           { color: '#10b981', bg: '#d1fae5', icon: 'bi-patch-check' },
      contrato_terminado:            { color: '#ef4444', bg: '#fee2e2', icon: 'bi-x-octagon' },
      capacitacion_nueva:            { color: '#0ea5e9', bg: '#e0f2fe', icon: 'bi-book' },
      capacitacion_inscripcion:      { color: '#0ea5e9', bg: '#e0f2fe', icon: 'bi-mortarboard' },
      capacitacion_completada:       { color: '#10b981', bg: '#d1fae5', icon: 'bi-award' },
      capacitacion_reprobada:        { color: '#ef4444', bg: '#fee2e2', icon: 'bi-award' },
      evaluacion_creada:             { color: '#6366f1', bg: '#ede9fe', icon: 'bi-clipboard-data' },
      evaluacion_completada:         { color: '#10b981', bg: '#d1fae5', icon: 'bi-clipboard2-check' },
      usuario_bienvenida:            { color: '#10b981', bg: '#d1fae5', icon: 'bi-person-plus' },
      cambio_rol:                    { color: '#f59e0b', bg: '#fef3c7', icon: 'bi-person-gear' },
      permiso_aprobado:              { color: '#10b981', bg: '#d1fae5', icon: 'bi-check-circle' },
      permiso_rechazado:             { color: '#ef4444', bg: '#fee2e2', icon: 'bi-x-circle' },
      nueva_solicitud_ausencia:      { color: '#f97316', bg: '#fff7ed', icon: 'bi-envelope-paper' },
      solicitud_ausencia_confirmacion: { color: '#0ea5e9', bg: '#e0f2fe', icon: 'bi-send-check' },
      cumpleanos:                    { color: '#ec4899', bg: '#fce7f3', icon: 'bi-gift' },
      recordatorio:                  { color: '#f59e0b', bg: '#fef3c7', icon: 'bi-bell' },
      documento_nuevo:               { color: '#0ea5e9', bg: '#e0f2fe', icon: 'bi-file-earmark-plus' },
      sistema:                       { color: '#6b7280', bg: '#f3f4f6', icon: 'bi-gear' },
    };
    return map[tipo] || { color: '#6b7280', bg: '#f3f4f6', icon: 'bi-bell' };
  };

  // Notificaciones de gestión (como admin, afectan a otros empleados)
  const isGestionType = (tipo) => [
    'contrato_por_vencer', 'evaluacion_contrato_pendiente', 'evaluacion_contrato_proxima',
    'contrato_extendido', 'contrato_indefinido', 'contrato_terminado',
    'nueva_solicitud_ausencia'
  ].includes(tipo);

  // Ruta de navegación por tipo de notificación
  const getNavPath = (tipo) => {
    if (['evaluacion_contrato_pendiente', 'evaluacion_contrato_proxima',
         'contrato_por_vencer', 'contrato_extendido', 'contrato_indefinido', 'contrato_terminado'].includes(tipo))
      return '/admin/evaluaciones-contrato';
    if (tipo?.startsWith('capacitacion_'))
      return '/admin/capacitacion';
    if (['evaluacion_creada', 'evaluacion_completada'].includes(tipo))
      return '/admin/evaluaciones';
    if (['usuario_bienvenida', 'cambio_rol'].includes(tipo))
      return '/admin/usuarios';
    if (['permiso_aprobado', 'permiso_rechazado', 'nueva_solicitud_ausencia'].includes(tipo))
      return '/admin/ausencias';
    return null;
  };

  // Tiempo relativo
  const formatRelTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const diffMs = Date.now() - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHoras = Math.floor(diffMs / 3600000);
      const diffDias = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHoras < 24) return `${diffHoras}h`;
      if (diffDias === 1) return 'Ayer';
      if (diffDias < 7) return `${diffDias}d`;
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const unreadCount = notifications.filter(n => !n.leida).length;

  const menuBase = [
    { path: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/admin/registros', icon: 'bi-table', label: 'Registros' },
    { path: '/admin/ausencias', icon: 'bi-envelope-paper', label: 'Gestion de Ausencias' },
    { path: '/admin/usuarios', icon: 'bi-people', label: 'Empleados' },
    { path: '/admin/evaluaciones', icon: 'bi-clipboard-check', label: 'Evaluaciones' },
    { path: '/admin/evaluaciones-contrato', icon: 'bi-file-earmark-person', label: 'Eval. Contratos' },
    { path: '/admin/capacitacion', icon: 'bi-mortarboard', label: 'Capacitacion' },
  ];

  const menuAdminRH = [
    { path: '/admin/organigrama', icon: 'bi-diagram-3', label: 'Organigrama' },
    { path: '/admin/analisis', icon: 'bi-graph-up-arrow', label: 'Analisis' },
    { path: '/admin/seguridad', icon: 'bi-shield-exclamation', label: 'Seguridad' },
    { path: '/admin/reportes', icon: 'bi-file-earmark-bar-graph', label: 'Reportes' },
    { path: '/admin/documentos', icon: 'bi-folder', label: 'Documentos' },
    { path: '/admin/auditoria', icon: 'bi-journal-text', label: 'Auditoria' },
  ];

  let menuItems = [...menuBase];
  if (userRole === ROLES.ADMIN_RH) {
    menuItems = [...menuItems, ...menuAdminRH];
  }

  const getRoleLabel = () => {
    if (userRole === ROLES.ADMIN_RH) return 'Admin RH';
    if (userRole === ROLES.ADMIN_AREA) return 'Admin Area';
    return 'Empleado';
  };

  return (
    <div className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <div>
            <h5><i className="bi bi-shield-lock-fill"></i> CH Panel Admin</h5>
            <small className="text-light opacity-75">{getRoleLabel()}</small>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Botón de cierre para móviles */}
            <button 
              className="btn-close-sidebar d-md-none"
              onClick={onMobileClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            {/* Campana */}
            <div className="notif-admin-wrapper" ref={notifRef}>
              <button
                className={`notif-admin-bell ${showNotifDropdown ? 'active' : ''} ${unreadCount > 0 ? 'has-pending' : ''}`}
                onClick={handleBellClick}
                title="Notificaciones"
              >
              <i className="bi bi-bell-fill"></i>
              {unreadCount > 0 && (
                <span className="notif-admin-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="notif-admin-dropdown">

                {/* Header */}
                <div className="notif-admin-drop-header">
                  <div className="notif-admin-drop-header-left">
                    <div className="notif-admin-drop-header-icon">
                      <i className="bi bi-bell-fill"></i>
                    </div>
                    <div>
                      <div className="notif-admin-drop-title">Notificaciones</div>
                      <div className="notif-admin-drop-subtitle">
                        {unreadCount > 0
                          ? `${unreadCount} sin leer`
                          : 'Todo al día'}
                      </div>
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <span className="notif-admin-count-badge">{unreadCount}</span>
                  )}
                </div>

                {/* Lista */}
                <div className="notif-admin-list">
                  {loadingNotif ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="notif-admin-skeleton">
                        <div className="skeleton-avatar"></div>
                        <div className="skeleton-lines">
                          <div className="skeleton-line skeleton-line-lg"></div>
                          <div className="skeleton-line skeleton-line-sm"></div>
                        </div>
                      </div>
                    ))
                  ) : notifications.length === 0 ? (
                    <div className="notif-admin-empty">
                      <div className="notif-admin-empty-icon">
                        <i className="bi bi-check-circle-fill"></i>
                      </div>
                      <span>Sin notificaciones</span>
                      <small>No tienes notificaciones nuevas</small>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const cfg = getTipoConfig(notif.tipo);
                      const navPath = getNavPath(notif.tipo);
                      return (
                        <div
                          key={notif.id}
                          className={`notif-admin-item ${!notif.leida ? 'notif-unread' : ''}`}
                          style={{ '--item-accent': cfg.color }}
                        >
                          {/* Icono */}
                          <div
                            className="notif-admin-avatar"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <i className={`bi ${cfg.icon}`}></i>
                          </div>

                          {/* Contenido */}
                          <div className="notif-admin-item-content">
                            <div className="notif-admin-item-top">
                              <span className="notif-admin-nombre">{notif.titulo}</span>
                              {isGestionType(notif.tipo) ? (
                                <span className="notif-admin-cat gestion">Gestión</span>
                              ) : (
                                <span className="notif-admin-cat personal">Personal</span>
                              )}
                            </div>
                            <span className="notif-admin-msg">{notif.mensaje}</span>
                            {navPath && (
                              <button
                                className="notif-admin-nav-btn"
                                onClick={() => {
                                  setShowNotifDropdown(false);
                                  navigate(navPath);
                                }}
                              >
                                <i className="bi bi-arrow-right-circle-fill"></i>
                                Ver sección
                              </button>
                            )}
                          </div>

                          {/* Tiempo + marcar leída */}
                          <div className="notif-admin-item-right">
                            <span className="notif-admin-since">
                              {formatRelTime(notif.fechaCreacion)}
                            </span>
                            {!notif.leida && (
                              <button
                                className="notif-admin-dismiss"
                                onClick={(e) => handleMarkRead(e, notif.id)}
                                title="Marcar como leída"
                              >
                                <i className="bi bi-check2"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div> {/* Cierre de d-flex align-items-center gap-2 */}
      </div>
    </div>

      {userRole === ROLES.ADMIN_AREA && userDepartamento && (
        <div className="department-banner">
          <i className="bi bi-building me-2"></i>
          <span>{userDepartamento}</span>
        </div>
      )}

      {menuItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={location.pathname === item.path ? 'active' : ''}
        >
          <i className={`bi ${item.icon}`}></i>
          {item.label}
        </Link>
      ))}

      {userRole === ROLES.ADMIN_RH && (
        <>
          <Link to="/admin/nomina" className="btn btn-outline-light">
            <i className="bi bi-calculator"></i>
            Sistema de Nomina
          </Link>
          <Link to="/admin/configuracion" className="btn btn-outline-light mt-2">
            <i className="bi bi-gear"></i>
            Configuracion
          </Link>
        </>
      )}

      <div className="sidebar-footer">
        {userName && (
          <small className="text-light opacity-75 d-block mb-2">{userName}</small>
        )}
        
        {/* Switch a Portal Empleado (solo para admins) */}
        {(userRole === ROLES.ADMIN_RH || userRole === ROLES.ADMIN_AREA) && (
          <button 
            className="btn btn-success w-100 mb-2 shadow-sm"
            onClick={() => navigate('/empleado/portal')}
            style={{ 
              background: 'var(--secondary-color)', 
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              padding: '10px'
            }}
          >
            <i className="bi bi-person-badge me-2"></i>
            Mi Portal Personal
          </button>
        )}

        <button id="btn-logout" className="btn btn-outline-light w-100" onClick={handleLogout} style={{ borderRadius: '12px' }}>
          <i className="bi bi-box-arrow-right me-2"></i>
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
