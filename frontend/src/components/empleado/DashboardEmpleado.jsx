import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import SaldoVacaciones from './SaldoVacaciones';

function DashboardEmpleado({ userData, attendanceSummary, saldoVacaciones, unreadCount, onNavigateTab }) {
  const [todayRecord, setTodayRecord] = useState(null);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const [proximasFechas, setProximasFechas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Evitar cargas duplicadas
  const dataLoaded = useRef(false);

  useEffect(() => {
    if (userData && !dataLoaded.current) {
      cargarDatosDashboard();
    }
  }, [userData]);

  const cargarDatosDashboard = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      dataLoaded.current = true;

      // Cargar datos en secuencia para reducir presion sobre Firebase
      // Primero: registro de hoy (lo mas importante)
      try {
        const todayResponse = await api.getTodayRecord(userData.uid);
        if (todayResponse.data.success) {
          setTodayRecord(todayResponse.data.data);
        }
      } catch (e) {
        console.log('No se pudo cargar registro de hoy');
      }

      // Segundo: solicitudes pendientes
      try {
        const solicitudesResponse = await api.getMyAbsenceRequests({ estado: 'pendiente' });
        if (solicitudesResponse.data.success) {
          const pendientes = solicitudesResponse.data.data.filter(s => s.estado === 'pendiente');
          setSolicitudesPendientes(pendientes.length);
        }
      } catch (e) {
        console.log('No se pudo cargar solicitudes');
      }

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos dias';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [mes, dia] = dateStr.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dia} ${meses[parseInt(mes) - 1]}`;
  };

  // Mientras carga, mostrar el contenido parcial
  return (
    <div className="dashboard-empleado">
      {/* Registro de hoy e Información de Bienvenida Integrada */}
      <div className="today-status-card premium-integrated">
        <div className="status-header-main">
          <div className="welcome-section-integrated">
            <h3>{getGreeting()}, {userData?.nombre?.split(' ')[0] || 'Usuario'}</h3>
            <p className="welcome-sub-integrated">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="header-actions-group">
            {todayRecord?.retardo && <span className="badge-retardo-fix-unique">RETARDO</span>}
            <button className="btn-mini-action" onClick={() => window.location.href = '/'}>
              <i className="bi bi-qr-code-scan me-1"></i> Ir al Checador
            </button>
          </div>
        </div>
        
        <div className="status-main">
          <div className="status-item">
            <span className="status-label">Entrada</span>
            <div className="status-value-group">
              <span className={`status-value ${todayRecord?.entrada ? 'recorded' : 'pending'}`}>
                {loading ? '...' : (todayRecord?.entrada || '--:--')}
              </span>
            </div>
          </div>
          
          <div className="status-divider"></div>
          
          <div className="status-item">
            <span className="status-label">Salida</span>
            <span className={`status-value ${todayRecord?.salida ? 'recorded' : 'pending'}`}>
              {loading ? '...' : (todayRecord?.salida || '--:--')}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de widgets */}
      <div className="dashboard-widgets">
        {/* Resumen de horas */}
        <div className="widget-card">
          <div className="widget-header">
            <i className="bi bi-clock text-primary"></i>
            <h6>Horas Trabajadas</h6>
          </div>
          <div className="widget-body">
            <div className="hours-summary">
              <div className="hours-item">
                <span className="hours-value">{attendanceSummary?.semana?.horasTrabajadas || 0}</span>
                <span className="hours-label">Esta semana</span>
              </div>
              <div className="hours-item">
                <span className="hours-value">{attendanceSummary?.mes?.horasTrabajadas || 0}</span>
                <span className="hours-label">Este mes</span>
              </div>
            </div>
            <div className="widget-stats">
              <span><i className="bi bi-calendar3 me-1"></i>{attendanceSummary?.mes?.diasTrabajados || 0} dias</span>
              {(attendanceSummary?.mes?.retardos || 0) > 0 && (
                <span className="text-warning"><i className="bi bi-exclamation-triangle me-1"></i>{attendanceSummary.mes.retardos} retardos</span>
              )}
            </div>
          </div>
          <button className="widget-link" onClick={() => onNavigateTab('historial')}>
            Ver historial <i className="bi bi-arrow-right"></i>
          </button>
        </div>

        {/* Saldo de vacaciones */}
        <div className="widget-card">
          <div className="widget-header">
            <i className="bi bi-calendar-heart text-success"></i>
            <h6>Vacaciones</h6>
          </div>
          <div className="widget-body">
            <SaldoVacaciones saldo={saldoVacaciones} compact={true} />
          </div>
          <button className="widget-link" onClick={() => onNavigateTab('solicitudes')}>
            Solicitar vacaciones <i className="bi bi-arrow-right"></i>
          </button>
        </div>

        {/* Notificaciones */}
        <div className="widget-card">
          <div className="widget-header">
            <i className="bi bi-bell text-info"></i>
            <h6>Notificaciones</h6>
          </div>
          <div className="widget-body widget-center">
            {unreadCount > 0 ? (
              <>
                <span className="notification-count">{unreadCount}</span>
                <span className="notification-text">sin leer</span>
              </>
            ) : (
              <span className="text-muted">Sin notificaciones nuevas</span>
            )}
          </div>
          <button className="widget-link" onClick={() => onNavigateTab('notificaciones')}>
            Ver todas <i className="bi bi-arrow-right"></i>
          </button>
        </div>

        {/* Solicitudes pendientes */}
        <div className="widget-card">
          <div className="widget-header">
            <i className="bi bi-envelope-paper text-warning"></i>
            <h6>Solicitudes</h6>
          </div>
          <div className="widget-body widget-center">
            {loading ? (
              <span className="text-muted">Cargando...</span>
            ) : solicitudesPendientes > 0 ? (
              <>
                <span className="pending-count">{solicitudesPendientes}</span>
                <span className="pending-text">pendientes</span>
              </>
            ) : (
              <span className="text-muted">Sin solicitudes pendientes</span>
            )}
          </div>
          <button className="widget-link" onClick={() => onNavigateTab('solicitudes')}>
            Ver solicitudes <i className="bi bi-arrow-right"></i>
          </button>
        </div>
      </div>

      {/* Accesos rapidos */}
      <div className="quick-actions">
        <h5>Accesos rapidos</h5>
        <div className="actions-grid">
          <button className="action-btn" onClick={() => window.location.href = '/'}>
            <i className="bi bi-qr-code-scan"></i>
            <span>Registrar Asistencia</span>
          </button>
          <button className="action-btn" onClick={() => onNavigateTab('solicitudes')}>
            <i className="bi bi-plus-circle"></i>
            <span>Nueva Solicitud</span>
          </button>
          <button className="action-btn" onClick={() => onNavigateTab('documentos')}>
            <i className="bi bi-file-earmark-text"></i>
            <span>Mis Documentos</span>
          </button>
          <button className="action-btn" onClick={() => onNavigateTab('perfil')}>
            <i className="bi bi-person-gear"></i>
            <span>Editar Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardEmpleado;
