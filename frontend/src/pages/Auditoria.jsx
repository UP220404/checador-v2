import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';
import '../styles/Auditoria.css';

// Datos de ejemplo
const EJEMPLO_LOGS = [
  {
    id: 'log-1',
    accion: 'crear_usuario',
    entidad: 'usuarios',
    entidadId: 'user123',
    ejecutadoPor: { uid: 'admin1', email: 'admin@ejemplo.com', nombre: 'Admin Principal', role: 'admin_rh' },
    detalles: { empleadoAfectado: 'juan.perez@ejemplo.com', cambios: { nombre: 'Juan Perez', departamento: 'Ventas' } },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    esEjemplo: true
  },
  {
    id: 'log-2',
    accion: 'aprobar_ausencia',
    entidad: 'ausencias',
    entidadId: 'aus456',
    ejecutadoPor: { uid: 'admin1', email: 'admin@ejemplo.com', nombre: 'Admin Principal', role: 'admin_rh' },
    detalles: { empleadoAfectado: 'maria.garcia@ejemplo.com', cambios: { estado: { antes: 'pendiente', despues: 'aprobado' } } },
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    esEjemplo: true
  },
  {
    id: 'log-3',
    accion: 'cambiar_rol',
    entidad: 'usuarios',
    entidadId: 'user789',
    ejecutadoPor: { uid: 'admin1', email: 'admin@ejemplo.com', nombre: 'Admin Principal', role: 'admin_rh' },
    detalles: { empleadoAfectado: 'carlos.ruiz@ejemplo.com', cambios: { role: { antes: 'empleado', despues: 'admin_area' } } },
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    esEjemplo: true
  },
  {
    id: 'log-4',
    accion: 'crear_evaluacion',
    entidad: 'evaluaciones',
    entidadId: 'eval001',
    ejecutadoPor: { uid: 'admin2', email: 'rh@ejemplo.com', nombre: 'Recursos Humanos', role: 'admin_rh' },
    detalles: { empleadoAfectado: 'ana.martinez@ejemplo.com' },
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    esEjemplo: true
  },
  {
    id: 'log-5',
    accion: 'rechazar_ausencia',
    entidad: 'ausencias',
    entidadId: 'aus789',
    ejecutadoPor: { uid: 'admin1', email: 'admin@ejemplo.com', nombre: 'Admin Principal', role: 'admin_rh' },
    detalles: { empleadoAfectado: 'pedro.sanchez@ejemplo.com', motivo: 'Fechas no disponibles' },
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    esEjemplo: true
  },
  {
    id: 'log-6',
    accion: 'calcular_nomina',
    entidad: 'nominas',
    entidadId: 'nom2026-01',
    ejecutadoPor: { uid: 'admin1', email: 'admin@ejemplo.com', nombre: 'Admin Principal', role: 'admin_rh' },
    detalles: { periodo: 'Enero 2026 - Quincena 1', empleados: 25 },
    timestamp: new Date(Date.now() - 345600000).toISOString(),
    esEjemplo: true
  }
];

// Configuración de acciones
const ACCIONES_CONFIG = {
  crear_usuario: { label: 'Usuario Creado', icon: 'bi-person-plus', color: 'success', description: 'Se agregó un nuevo usuario al sistema' },
  eliminar_usuario: { label: 'Usuario Eliminado', icon: 'bi-person-x', color: 'danger', description: 'Se eliminó un usuario del sistema' },
  aprobar_ausencia: { label: 'Ausencia Aprobada', icon: 'bi-check-circle', color: 'success', description: 'Se aprobó una solicitud de ausencia' },
  rechazar_ausencia: { label: 'Ausencia Rechazada', icon: 'bi-x-circle', color: 'danger', description: 'Se rechazó una solicitud de ausencia' },
  cambiar_rol: { label: 'Rol Modificado', icon: 'bi-shield', color: 'warning', description: 'Se cambió el rol de un usuario' },
  crear_evaluacion: { label: 'Evaluación Creada', icon: 'bi-clipboard-plus', color: 'info', description: 'Se creó una nueva evaluación' },
  actualizar_evaluacion: { label: 'Evaluación Actualizada', icon: 'bi-clipboard-check', color: 'primary', description: 'Se actualizó una evaluación' },
  crear_capacitacion: { label: 'Capacitación Creada', icon: 'bi-mortarboard', color: 'info', description: 'Se creó una nueva capacitación' },
  inscribir_empleado: { label: 'Inscripción', icon: 'bi-person-check', color: 'success', description: 'Se inscribió un empleado en capacitación' },
  calcular_nomina: { label: 'Nómina Calculada', icon: 'bi-calculator', color: 'primary', description: 'Se calculó la nómina de un periodo' },
  actualizar_configuracion: { label: 'Config. Actualizada', icon: 'bi-gear', color: 'secondary', description: 'Se modificó la configuración del sistema' }
};

const ENTIDADES_CONFIG = {
  usuarios: { label: 'Usuarios', icon: 'bi-people', color: 'primary' },
  ausencias: { label: 'Ausencias', icon: 'bi-calendar-x', color: 'warning' },
  evaluaciones: { label: 'Evaluaciones', icon: 'bi-clipboard-check', color: 'success' },
  capacitaciones: { label: 'Capacitaciones', icon: 'bi-mortarboard', color: 'info' },
  nominas: { label: 'Nóminas', icon: 'bi-cash-stack', color: 'success' },
  configuracion: { label: 'Configuración', icon: 'bi-gear', color: 'secondary' }
};

function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usandoEjemplos, setUsandoEjemplos] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    accion: '',
    entidad: '',
    fechaInicio: '',
    fechaFin: '',
    limit: 100
  });

  const location = useLocation();

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let logsData = [];
      try {
        const logsRes = await api.getAuditLogs(filtros);
        logsData = logsRes.data.data || [];
        console.log('Logs de auditoria cargados:', logsData.length);
      } catch (err) {
        console.log('No se pudieron cargar logs de auditoria:', err.message);
      }

      // Solo usar ejemplos si realmente no hay datos
      if (logsData.length === 0) {
        logsData = EJEMPLO_LOGS;
        setUsandoEjemplos(true);
      } else {
        setUsandoEjemplos(false);
      }

      // Ordenar por timestamp descendente
      logsData.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return dateB - dateA;
      });

      setLogs(logsData);

      // Calcular stats
      const statsCalc = {
        total: logsData.length,
        porAccion: {},
        porEntidad: {},
        ultimaActividad: logsData[0]?.timestamp
      };

      logsData.forEach(log => {
        statsCalc.porAccion[log.accion] = (statsCalc.porAccion[log.accion] || 0) + 1;
        statsCalc.porEntidad[log.entidad] = (statsCalc.porEntidad[log.entidad] || 0) + 1;
      });

      setStats(statsCalc);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setLogs(EJEMPLO_LOGS);
      setUsandoEjemplos(true);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  // Cargar datos al montar y cuando cambie la ruta
  useEffect(() => {
    loadData();
  }, [location.pathname]);

  // Auto-actualizar cuando la ventana recupera el foco o cambia de visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(false); // Sin loading spinner
      }
    };

    const handleFocus = () => {
      loadData(false); // Sin loading spinner
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  // Generar descripción legible de la acción
  const generarDescripcionAccion = (log) => {
    const ejecutor = log.ejecutadoPor?.nombre || log.ejecutadoPor?.email?.split('@')[0] || 'Sistema';
    const afectado = log.detalles?.empleadoAfectado
      ? (log.detalles.nombreEmpleadoAfectado || log.detalles.empleadoAfectado.split('@')[0])
      : null;

    const acciones = {
      crear_usuario: afectado ? `${ejecutor} creó la cuenta de ${afectado}` : `${ejecutor} creó un nuevo usuario`,
      eliminar_usuario: afectado ? `${ejecutor} eliminó la cuenta de ${afectado}` : `${ejecutor} eliminó un usuario`,
      aprobar_ausencia: afectado ? `${ejecutor} aprobó la ausencia de ${afectado}` : `${ejecutor} aprobó una ausencia`,
      rechazar_ausencia: afectado ? `${ejecutor} rechazó la ausencia de ${afectado}` : `${ejecutor} rechazó una ausencia`,
      cambiar_rol: afectado ? `${ejecutor} cambió el rol de ${afectado}` : `${ejecutor} cambió un rol de usuario`,
      crear_evaluacion: afectado ? `${ejecutor} creó una evaluación para ${afectado}` : `${ejecutor} creó una evaluación`,
      actualizar_evaluacion: afectado ? `${ejecutor} actualizó la evaluación de ${afectado}` : `${ejecutor} actualizó una evaluación`,
      crear_capacitacion: `${ejecutor} creó una nueva capacitación`,
      inscribir_empleado: afectado ? `${ejecutor} inscribió a ${afectado} en una capacitación` : `${ejecutor} inscribió un empleado`,
      calcular_nomina: log.detalles?.periodo ? `${ejecutor} calculó la nómina de ${log.detalles.periodo}` : `${ejecutor} calculó la nómina`,
      actualizar_configuracion: `${ejecutor} actualizó la configuración del sistema`,
      actualizar_usuario: afectado ? `${ejecutor} modificó los datos de ${afectado}` : `${ejecutor} actualizó un usuario`,
      actualizar_progreso: afectado ? `${ejecutor} actualizó el progreso de ${afectado}` : `${ejecutor} actualizó un progreso`
    };

    return acciones[log.accion] || `${ejecutor} realizó: ${log.accion}`;
  };

  // Obtener detalles de cambios legibles
  const getDetallesCambios = (log) => {
    if (!log.detalles?.cambios) return null;

    const cambios = [];
    Object.entries(log.detalles.cambios).forEach(([campo, valor]) => {
      const campoLegible = {
        role: 'Rol',
        estado: 'Estado',
        departamento: 'Departamento',
        puesto: 'Puesto',
        nombre: 'Nombre',
        activo: 'Estado activo',
        tipo: 'Tipo',
        calificacion: 'Calificación',
        progreso: 'Progreso'
      }[campo] || campo;

      if (typeof valor === 'object' && valor.antes !== undefined) {
        cambios.push({
          campo: campoLegible,
          antes: valor.antes,
          despues: valor.despues
        });
      } else {
        cambios.push({
          campo: campoLegible,
          valor: valor
        });
      }
    });
    return cambios;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleCleanup = async () => {
    const result = await Swal.fire({
      title: '¿Limpiar registros?',
      text: '¿Eliminar registros de auditoría mayores a 1 año? Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      await api.cleanupAuditLogs({ daysOld: 365 });
      loadData();
    } catch (err) {
      console.error('Error limpiando registros:', err);
      setError('Error al limpiar registros');
    }
  };

  const getAccionConfig = (accion) => {
    return ACCIONES_CONFIG[accion] || { label: accion, icon: 'bi-activity', color: 'secondary', description: 'Acción del sistema' };
  };

  const getEntidadConfig = (entidad) => {
    return ENTIDADES_CONFIG[entidad] || { label: entidad, icon: 'bi-folder', color: 'secondary' };
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} horas`;
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filtrarLogs = () => {
    return logs.filter(log => {
      if (filtros.accion && log.accion !== filtros.accion) return false;
      if (filtros.entidad && log.entidad !== filtros.entidad) return false;
      return true;
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-muted">Cargando registro de auditoría...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="auditoria-container">
        {/* Header */}
        <div className="page-header mb-4">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h2 className="mb-1">
                <i className="bi bi-journal-text text-info me-2"></i>
                Registro de Auditoría
              </h2>
              <p className="text-muted mb-0">
                Historial de todas las acciones administrativas realizadas en el sistema
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <button className="btn btn-outline-danger" onClick={handleCleanup}>
                <i className="bi bi-trash me-2"></i>Limpiar Antiguos
              </button>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {usandoEjemplos && (
          <div className="alert alert-info alert-dismissible fade show d-flex align-items-center">
            <i className="bi bi-info-circle-fill me-2 fs-5"></i>
            <div>
              <strong>Modo Demo:</strong> Estos son ejemplos para mostrar cómo funciona el registro de auditoría.
              Las acciones reales se registrarán automáticamente.
            </div>
            <button type="button" className="btn-close" onClick={() => setUsandoEjemplos(false)}></button>
          </div>
        )}

        {error && (
          <div className="alert alert-danger alert-dismissible fade show">
            <i className="bi bi-exclamation-circle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-info bg-opacity-10 text-info">
                    <i className="bi bi-journal-text"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.total || 0}</h3>
                    <small className="text-muted">Total Registros</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-success bg-opacity-10 text-success">
                    <i className="bi bi-check-circle"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">
                      {(stats?.porAccion?.aprobar_ausencia || 0) + (stats?.porAccion?.crear_usuario || 0)}
                    </h3>
                    <small className="text-muted">Aprobaciones</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                    <i className="bi bi-shield"></i>
                  </div>
                  <div className="ms-3">
                    <h3 className="mb-0 fw-bold">{stats?.porAccion?.cambiar_rol || 0}</h3>
                    <small className="text-muted">Cambios de Rol</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 stat-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div className="ms-3">
                    <small className="text-muted d-block">Última Actividad</small>
                    <span className="fw-bold small">{formatTimestamp(stats?.ultimaActividad)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen por Entidad */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body py-3">
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <span className="text-muted"><i className="bi bi-pie-chart me-1"></i> Por módulo:</span>
              {Object.entries(stats?.porEntidad || {}).map(([entidad, count]) => {
                const config = getEntidadConfig(entidad);
                return (
                  <span
                    key={entidad}
                    className={`badge bg-${config.color} bg-opacity-10 text-${config.color} border border-${config.color} border-opacity-25 py-2 px-3`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setFiltros({ ...filtros, entidad })}
                  >
                    <i className={`bi ${config.icon} me-1`}></i>
                    {config.label}: <strong>{count}</strong>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <form onSubmit={handleSearch}>
              <div className="row g-3 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small text-muted">Tipo de Acción</label>
                  <select
                    className="form-select"
                    value={filtros.accion}
                    onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
                  >
                    <option value="">Todas las acciones</option>
                    {Object.entries(ACCIONES_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted">Módulo</label>
                  <select
                    className="form-select"
                    value={filtros.entidad}
                    onChange={(e) => setFiltros({ ...filtros, entidad: e.target.value })}
                  >
                    <option value="">Todos los módulos</option>
                    {Object.entries(ENTIDADES_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small text-muted">Desde</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filtros.fechaInicio}
                    onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small text-muted">Hasta</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filtros.fechaFin}
                    onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100">
                    <i className="bi bi-search me-2"></i>Filtrar
                  </button>
                </div>
              </div>
            </form>
            {(filtros.accion || filtros.entidad || filtros.fechaInicio || filtros.fechaFin) && (
              <div className="mt-3 pt-3 border-top">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setFiltros({ accion: '', entidad: '', fechaInicio: '', fechaFin: '', limit: 100 })}
                >
                  <i className="bi bi-x-circle me-1"></i>Limpiar filtros
                </button>
                <span className="ms-3 text-muted small">
                  {filtrarLogs().length} resultados encontrados
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline de Registros */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent">
            <h5 className="mb-0">
              <i className="bi bi-clock-history me-2"></i>
              Historial de Actividad
            </h5>
          </div>
          <div className="card-body p-0">
            {filtrarLogs().length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-journal-x display-1 text-muted opacity-25"></i>
                <p className="text-muted mt-3">No hay registros de auditoría</p>
              </div>
            ) : (
              <div className="audit-timeline">
                {filtrarLogs().map((log, index) => {
                  const accionConfig = getAccionConfig(log.accion);
                  const entidadConfig = getEntidadConfig(log.entidad);

                  return (
                    <div
                      key={log.id}
                      className={`audit-item ${selectedLog?.id === log.id ? 'selected' : ''}`}
                      onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    >
                      <div className="audit-icon-wrapper">
                        <div className={`audit-icon bg-${accionConfig.color}`}>
                          <i className={`bi ${accionConfig.icon}`}></i>
                        </div>
                        {index < filtrarLogs().length - 1 && <div className="audit-line"></div>}
                      </div>

                      <div className="audit-content flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="mb-1">
                              <span className={`badge bg-${accionConfig.color} me-2`}>
                                {accionConfig.label}
                              </span>
                              <span className={`badge bg-${entidadConfig.color} bg-opacity-10 text-${entidadConfig.color}`}>
                                <i className={`bi ${entidadConfig.icon} me-1`}></i>
                                {entidadConfig.label}
                              </span>
                              {log.esEjemplo && <span className="badge bg-light text-muted ms-2">Demo</span>}
                            </h6>
                          </div>
                          <small className="text-muted text-nowrap ms-3">
                            <i className="bi bi-clock me-1"></i>
                            {formatTimestamp(log.timestamp)}
                          </small>
                        </div>

                        {/* Descripción clara y legible */}
                        <div className="audit-description mt-2 p-3 bg-white border rounded shadow-sm">
                          <p className="mb-2 fs-6">
                            <i className={`bi ${accionConfig.icon} text-${accionConfig.color} me-2`}></i>
                            <strong>{generarDescripcionAccion(log)}</strong>
                          </p>

                          {/* Mostrar cambios específicos si existen */}
                          {getDetallesCambios(log) && getDetallesCambios(log).length > 0 && (
                            <div className="cambios-inline mt-2">
                              {getDetallesCambios(log).map((cambio, idx) => (
                                <span key={idx} className="badge bg-light text-dark me-2 mb-1 p-2">
                                  <strong>{cambio.campo}:</strong>{' '}
                                  {cambio.antes !== undefined ? (
                                    <>
                                      <span className="text-danger text-decoration-line-through">{String(cambio.antes)}</span>
                                      {' → '}
                                      <span className="text-success fw-bold">{String(cambio.despues)}</span>
                                    </>
                                  ) : (
                                    <span>{String(cambio.valor)}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Motivo si existe */}
                          {log.detalles?.motivo && (
                            <div className="mt-2 text-muted small">
                              <i className="bi bi-chat-quote me-1"></i>
                              Motivo: "{log.detalles.motivo}"
                            </div>
                          )}
                        </div>

                        {/* Detalles expandibles */}
                        {selectedLog?.id === log.id && log.detalles && (
                          <div className="audit-details mt-3 p-3 bg-light rounded border">
                            <h6 className="small text-muted mb-3">
                              <i className="bi bi-info-circle me-1"></i>
                              Información técnica completa
                            </h6>

                            <div className="row g-3">
                              <div className="col-md-6">
                                <div className="bg-white p-2 rounded">
                                  <small className="text-muted d-block">Ejecutado por:</small>
                                  <span className="fw-medium">{log.ejecutadoPor?.nombre || 'Sistema'}</span>
                                  {log.ejecutadoPor?.email && (
                                    <small className="text-muted d-block">{log.ejecutadoPor.email}</small>
                                  )}
                                </div>
                              </div>

                              {log.detalles.empleadoAfectado && (
                                <div className="col-md-6">
                                  <div className="bg-white p-2 rounded">
                                    <small className="text-muted d-block">Usuario afectado:</small>
                                    <span className="fw-medium">
                                      {log.detalles.nombreEmpleadoAfectado || log.detalles.empleadoAfectado}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {log.detalles.periodo && (
                                <div className="col-md-6">
                                  <div className="bg-white p-2 rounded">
                                    <small className="text-muted d-block">Periodo:</small>
                                    <span className="fw-medium">{log.detalles.periodo}</span>
                                  </div>
                                </div>
                              )}

                              <div className="col-md-6">
                                <div className="bg-white p-2 rounded">
                                  <small className="text-muted d-block">ID del registro:</small>
                                  <code className="small">{log.entidadId || log.id}</code>
                                </div>
                              </div>
                            </div>

                            {log.detalles.cambios && Object.keys(log.detalles.cambios).length > 0 && (
                              <div className="mt-3">
                                <small className="text-muted d-block mb-2">Todos los cambios:</small>
                                <div className="bg-white p-2 rounded border">
                                  {Object.entries(log.detalles.cambios).map(([campo, valor]) => (
                                    <div key={campo} className="small py-1 border-bottom">
                                      <strong className="text-primary">{campo}:</strong>{' '}
                                      {typeof valor === 'object' && valor.antes !== undefined ? (
                                        <>
                                          <span className="text-danger">{String(valor.antes)}</span>
                                          <i className="bi bi-arrow-right mx-2 text-muted"></i>
                                          <span className="text-success fw-bold">{String(valor.despues)}</span>
                                        </>
                                      ) : (
                                        <span>{JSON.stringify(valor)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="audit-arrow">
                        <i className={`bi ${selectedLog?.id === log.id ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body">
            <h6 className="text-muted mb-3">
              <i className="bi bi-info-circle me-2"></i>¿Qué es el Registro de Auditoría?
            </h6>
            <p className="small text-muted mb-3">
              Este módulo registra automáticamente todas las acciones administrativas importantes realizadas en el sistema.
              Permite hacer seguimiento de quién hizo qué y cuándo, lo cual es esencial para:
            </p>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <i className="bi bi-shield-check text-success me-2 mt-1"></i>
                  <div>
                    <strong className="small">Seguridad</strong>
                    <p className="small text-muted mb-0">Detectar accesos no autorizados</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <i className="bi bi-clipboard-check text-primary me-2 mt-1"></i>
                  <div>
                    <strong className="small">Cumplimiento</strong>
                    <p className="small text-muted mb-0">Mantener registros para auditorías</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <i className="bi bi-arrow-counterclockwise text-warning me-2 mt-1"></i>
                  <div>
                    <strong className="small">Trazabilidad</strong>
                    <p className="small text-muted mb-0">Revertir cambios si es necesario</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Auditoria;
