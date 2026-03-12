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

      // Tercero: fechas importantes (opcional)
      try {
        const fechasResponse = await api.getFechasImportantes(userData.uid);
        if (fechasResponse.data.success) {
          const fechas = fechasResponse.data.data || [];
          const proximas = calcularProximasFechas(fechas);
          setProximasFechas(proximas);
        }
      } catch (e) {
        console.log('No se pudo cargar fechas importantes');
      }

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const calcularProximasFechas = (fechas) => {
    if (!fechas || !Array.isArray(fechas)) return [];

    const hoy = new Date();

    return fechas
      .filter(fecha => fecha && fecha.fecha)
      .map(fecha => {
        const [mes, dia] = fecha.fecha.split('-');
        let diasRestantes;

        // Calcular dias restantes considerando vuelta de anio
        const fechaObj = new Date(hoy.getFullYear(), parseInt(mes) - 1, parseInt(dia));
        if (fechaObj < hoy) {
          fechaObj.setFullYear(hoy.getFullYear() + 1);
        }
        diasRestantes = Math.ceil((fechaObj - hoy) / (1000 * 60 * 60 * 24));

        return { ...fecha, diasRestantes };
      })
      .filter(f => f.diasRestantes <= 30 && f.diasRestantes >= 0)
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 3);
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
      {/* Bienvenida - siempre visible */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h3>{getGreeting()}, {userData?.nombre?.split(' ')[0] || 'Usuario'}</h3>
          <p className="text-muted">
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Registro de hoy */}
      <div className="today-status-card">
        <h5><i className="bi bi-calendar-check me-2"></i>Estado de hoy</h5>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Entrada</span>
            <span className={`status-value ${todayRecord?.entrada ? 'recorded' : 'pending'}`}>
              {loading ? '...' : (todayRecord?.entrada || '--:--')}
            </span>
            {todayRecord?.retardo && <span className="badge bg-warning">Retardo</span>}
          </div>
          <div className="status-item">
            <span className="status-label">Salida</span>
            <span className={`status-value ${todayRecord?.salida ? 'recorded' : 'pending'}`}>
              {loading ? '...' : (todayRecord?.salida || '--:--')}
            </span>
          </div>
        </div>
        <button className="btn-quick-action" onClick={() => window.location.href = '/'}>
          <i className="bi bi-qr-code-scan me-2"></i>
          Ir al Checador
        </button>
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

      {/* Proximas fechas importantes */}
      {proximasFechas.length > 0 && (
        <div className="upcoming-dates-card">
          <h5><i className="bi bi-calendar-event me-2"></i>Proximas fechas importantes</h5>
          <div className="dates-list">
            {proximasFechas.map((fecha, index) => (
              <div key={index} className="date-item">
                <div className="date-icon">
                  <i className={`bi ${fecha.tipo === 'cumpleanos' ? 'bi-gift' : fecha.tipo === 'aniversario' ? 'bi-award' : 'bi-star'}`}></i>
                </div>
                <div className="date-info">
                  <span className="date-desc">{fecha.descripcion || fecha.tipo}</span>
                  <span className="date-value">{formatDate(fecha.fecha)}</span>
                </div>
                <div className="date-countdown">
                  {fecha.diasRestantes === 0 ? (
                    <span className="badge bg-success">Hoy</span>
                  ) : fecha.diasRestantes === 1 ? (
                    <span className="badge bg-warning">Manana</span>
                  ) : (
                    <span className="text-muted">{fecha.diasRestantes} dias</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
