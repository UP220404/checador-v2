import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

function NotificacionesTab({ userData, mostrarMensaje, onUpdateUnreadCount, onNavigateTab }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [allNotificaciones, setAllNotificaciones] = useState([]); // Cache
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas'); // todas, no_leidas

  // Evitar cargas duplicadas
  const dataLoaded = useRef(false);

  useEffect(() => {
    if (userData && !dataLoaded.current) {
      cargarNotificaciones();
    }
  }, [userData]);

  // Filtrar notificaciones en memoria cuando cambia el filtro
  useEffect(() => {
    if (allNotificaciones.length > 0 || dataLoaded.current) {
      if (filtro === 'no_leidas') {
        setNotificaciones(allNotificaciones.filter(n => !n.leida));
      } else {
        setNotificaciones(allNotificaciones);
      }
    }
  }, [filtro, allNotificaciones]);

  const cargarNotificaciones = async () => {
    try {
      setLoading(true);
      dataLoaded.current = true;

      const response = await api.getMyNotifications({ limit: 50 });

      if (response.data.success) {
        const notifs = response.data.data || [];
        setAllNotificaciones(notifs);
        setNotificaciones(notifs);

        // Actualizar contador de no leidas
        const noLeidas = notifs.filter(n => !n.leida).length;
        onUpdateUnreadCount(noLeidas);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarLeida = async (notifId) => {
    try {
      await api.markNotificationAsRead(notifId);

      // Actualizar cache y estado
      const updateNotif = n => n.id === notifId ? { ...n, leida: true } : n;
      setAllNotificaciones(prev => prev.map(updateNotif));
      setNotificaciones(prev => prev.map(updateNotif));

      // Actualizar contador
      const noLeidas = allNotificaciones.filter(n => !n.leida && n.id !== notifId).length;
      onUpdateUnreadCount(noLeidas);
    } catch (error) {
      console.error('Error marcando como leida:', error);
    }
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await api.markAllNotificationsAsRead();

      // Actualizar cache y estado
      const markAllRead = prev => prev.map(n => ({ ...n, leida: true }));
      setAllNotificaciones(markAllRead);
      setNotificaciones(markAllRead);

      onUpdateUnreadCount(0);
      mostrarMensaje('success', 'Todas las notificaciones marcadas como leidas');
    } catch (error) {
      console.error('Error marcando todas como leidas:', error);
      mostrarMensaje('error', 'Error al marcar notificaciones');
    }
  };

  const handleEliminar = async (notifId) => {
    try {
      await api.deleteNotification(notifId);

      const notifEliminada = allNotificaciones.find(n => n.id === notifId);

      // Actualizar cache y estado
      const removeNotif = prev => prev.filter(n => n.id !== notifId);
      setAllNotificaciones(removeNotif);
      setNotificaciones(removeNotif);

      // Actualizar contador si no estaba leida
      if (!notifEliminada?.leida) {
        const noLeidas = allNotificaciones.filter(n => !n.leida && n.id !== notifId).length;
        onUpdateUnreadCount(noLeidas);
      }
    } catch (error) {
      console.error('Error eliminando notificacion:', error);
    }
  };

  const getTabDestino = (tipo) => {
    if (['permiso_aprobado', 'permiso_rechazado', 'retardo_justificado', 'solicitud_ausencia_confirmacion'].includes(tipo)) return { tab: 'solicitudes', label: 'Ver Solicitudes' };
    if (tipo?.startsWith('capacitacion_')) return { tab: 'capacitaciones', label: 'Ver Capacitaciones' };
    if (tipo === 'documento_nuevo') return { tab: 'documentos', label: 'Ver Documentos' };
    return null;
  };

  const getTipoIcon = (tipo) => {
    const iconos = {
      // Ausencias
      permiso_aprobado: 'bi-check-circle text-success',
      permiso_rechazado: 'bi-x-circle text-danger',
      // Personal
      cumpleanos: 'bi-gift text-primary',
      recordatorio: 'bi-bell text-warning',
      // Documentos
      documento_nuevo: 'bi-file-earmark-plus text-info',
      // Sistema
      sistema: 'bi-gear text-secondary',
      // Contratos
      evaluacion_contrato_pendiente: 'bi-clipboard-check text-warning',
      evaluacion_contrato_proxima: 'bi-calendar-event text-warning',
      contrato_extendido: 'bi-arrow-repeat text-success',
      contrato_indefinido: 'bi-patch-check text-success',
      contrato_terminado: 'bi-x-octagon text-danger',
      contrato_por_vencer: 'bi-exclamation-triangle text-warning',
      // Capacitaciones
      capacitacion_inscripcion: 'bi-mortarboard text-primary',
      capacitacion_desinscripcion: 'bi-mortarboard text-secondary',
      capacitacion_completada: 'bi-award text-success',
      capacitacion_reprobada: 'bi-award text-danger',
      capacitacion_nueva: 'bi-book text-info',
      // Evaluaciones de desempeño
      evaluacion_creada: 'bi-clipboard-data text-primary',
      evaluacion_completada: 'bi-clipboard2-check text-success',
      // Usuarios
      usuario_bienvenida: 'bi-house-heart text-success',
      cambio_rol: 'bi-person-gear text-warning',
      // Confirmación de solicitud
      solicitud_ausencia_confirmacion: 'bi-send-check text-info'
    };
    return iconos[tipo] || 'bi-bell text-primary';
  };

  const getTipoBgClass = (tipo) => {
    const clases = {
      permiso_aprobado: 'bg-success-soft',
      permiso_rechazado: 'bg-danger-soft',
      cumpleanos: 'bg-primary-soft',
      recordatorio: 'bg-warning-soft',
      documento_nuevo: 'bg-info-soft',
      sistema: 'bg-secondary-soft',
      evaluacion_contrato_pendiente: 'bg-warning-soft',
      evaluacion_contrato_proxima: 'bg-warning-soft',
      contrato_extendido: 'bg-success-soft',
      contrato_indefinido: 'bg-success-soft',
      contrato_terminado: 'bg-danger-soft',
      contrato_por_vencer: 'bg-warning-soft',
      capacitacion_inscripcion: 'bg-primary-soft',
      capacitacion_desinscripcion: 'bg-secondary-soft',
      capacitacion_completada: 'bg-success-soft',
      capacitacion_reprobada: 'bg-danger-soft',
      capacitacion_nueva: 'bg-info-soft',
      evaluacion_creada: 'bg-primary-soft',
      evaluacion_completada: 'bg-success-soft',
      usuario_bienvenida: 'bg-success-soft',
      cambio_rol: 'bg-warning-soft',
      solicitud_ausencia_confirmacion: 'bg-info-soft'
    };
    return clases[tipo] || 'bg-primary-soft';
  };

  const formatFecha = (dateStr) => {
    if (!dateStr) return '';

    try {
      const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);

      // new Date() no lanza error con formatos inválidos — validar explícitamente
      if (isNaN(date.getTime())) return '';

      const ahora = new Date();
      const diffMs = ahora - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHoras < 24) return `Hace ${diffHoras}h`;
      if (diffDias < 7) return `Hace ${diffDias} días`;

      return date.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return '';
    }
  };

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="notificaciones-tab">
      <div className="notificaciones-header">
        <h4 className="section-title">
          <i className="bi bi-bell me-2 text-success"></i>
          Notificaciones
          {noLeidas > 0 && (
            <span className="badge bg-danger ms-2">{noLeidas}</span>
          )}
        </h4>

        <div className="header-actions">
          {noLeidas > 0 && (
            <button
              className="btn-portal btn-portal-secondary"
              onClick={handleMarcarTodasLeidas}
            >
              <i className="bi bi-check-all me-2"></i>
              Marcar todas como leidas
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="notificaciones-filtros">
        <button
          className={`filtro-btn ${filtro === 'todas' ? 'active' : ''}`}
          onClick={() => setFiltro('todas')}
        >
          Todas
        </button>
        <button
          className={`filtro-btn ${filtro === 'no_leidas' ? 'active' : ''}`}
          onClick={() => setFiltro('no_leidas')}
        >
          No leidas ({noLeidas})
        </button>
      </div>

      {/* Lista de notificaciones */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : notificaciones.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-bell-slash"></i>
          <h5>Sin notificaciones</h5>
          <p>
            {filtro === 'no_leidas'
              ? 'No tienes notificaciones sin leer'
              : 'No tienes notificaciones'
            }
          </p>
          {filtro === 'no_leidas' && (
            <button
              className="btn-portal btn-portal-secondary"
              onClick={() => setFiltro('todas')}
            >
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <div className="notificaciones-lista">
          {notificaciones.map((notif) => {
            const destino = getTabDestino(notif.tipo);
            return (
              <div
                key={notif.id}
                className={`notificacion-item ${!notif.leida ? 'no-leida' : ''} ${getTipoBgClass(notif.tipo)}`}
                onClick={() => !notif.leida && handleMarcarLeida(notif.id)}
              >
                <div className="notif-icon">
                  <i className={`bi ${getTipoIcon(notif.tipo)}`}></i>
                </div>

                <div className="notif-content">
                  <div className="notif-header">
                    <span className="notif-titulo">{notif.titulo}</span>
                    <span className="notif-fecha">{formatFecha(notif.fechaCreacion)}</span>
                  </div>
                  <p className="notif-mensaje">{notif.mensaje}</p>
                  {destino && onNavigateTab && (
                    <button
                      className="notif-nav-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateTab(destino.tab);
                      }}
                    >
                      {destino.label} <i className="bi bi-arrow-right"></i>
                    </button>
                  )}
                </div>

                <div className="notif-actions">
                  {!notif.leida && (
                    <span className="unread-indicator" title="No leida"></span>
                  )}
                  <button
                    className="btn-notif-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEliminar(notif.id);
                    }}
                    title="Eliminar"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificacionesTab;
