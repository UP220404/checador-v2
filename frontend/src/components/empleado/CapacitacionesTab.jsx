import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function CapacitacionesTab({ userData, mostrarMensaje }) {
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCap, setSelectedCap] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    cargarCapacitaciones();
  }, []);

  const cargarCapacitaciones = async () => {
    try {
      setLoading(true);
      const response = await api.getMyTrainings();
      if (response.data.success) {
        setCapacitaciones(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando capacitaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoConfig = (tipo) => {
    const config = {
      curso: { badge: 'badge-tipo-curso', icon: 'bi-book', label: 'Curso', color: '#4361ee' },
      certificacion: { badge: 'badge-tipo-cert', icon: 'bi-award', label: 'Certificacion', color: '#7209b7' },
      taller: { badge: 'badge-tipo-taller', icon: 'bi-tools', label: 'Taller', color: '#f77f00' }
    };
    return config[tipo] || config.curso;
  };

  const getEstadoConfig = (estado) => {
    const config = {
      inscrito: { badge: 'badge-estado-inscrito', icon: 'bi-person-plus', label: 'Inscrito', color: '#6c757d', bg: '#f8f9fa' },
      en_progreso: { badge: 'badge-estado-progreso', icon: 'bi-play-circle', label: 'En Progreso', color: '#0077b6', bg: '#e8f4fd' },
      completada: { badge: 'badge-estado-completada', icon: 'bi-check-circle-fill', label: 'Completada', color: '#198754', bg: '#e8f5e9' },
      reprobada: { badge: 'badge-estado-reprobada', icon: 'bi-x-circle-fill', label: 'Reprobada', color: '#dc3545', bg: '#fde8e8' }
    };
    return config[estado] || config.inscrito;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    try {
      let date;

      // Firestore Timestamp con método .toDate()
      if (dateStr?.toDate) {
        date = dateStr.toDate();
      }
      // Firestore Timestamp serializado como { _seconds, _nanoseconds } o { seconds, nanoseconds }
      else if (typeof dateStr === 'object' && (dateStr._seconds !== undefined || dateStr.seconds !== undefined)) {
        date = new Date((dateStr._seconds ?? dateStr.seconds) * 1000);
      }
      // String tipo "YYYY-MM-DD"
      else if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
      // ISO string u otro formato
      else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) return 'Sin fecha';
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'Sin fecha';
    }
  };

  const getDiasRestantes = (fechaFin) => {
    if (!fechaFin) return null;
    try {
      const parts = fechaFin.split('-');
      const fin = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
      return diff;
    } catch {
      return null;
    }
  };

  const getProgresoTemporal = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return 0;
    try {
      const pInicio = fechaInicio.split('-');
      const pFin = fechaFin.split('-');
      const inicio = new Date(parseInt(pInicio[0]), parseInt(pInicio[1]) - 1, parseInt(pInicio[2]));
      const fin = new Date(parseInt(pFin[0]), parseInt(pFin[1]) - 1, parseInt(pFin[2]));
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (hoy <= inicio) return 0;
      if (hoy >= fin) return 100;
      const total = fin - inicio;
      const transcurrido = hoy - inicio;
      return Math.round((transcurrido / total) * 100);
    } catch {
      return 0;
    }
  };

  // Calcular estadisticas
  const stats = {
    total: capacitaciones.length,
    completadas: capacitaciones.filter(c => c.miParticipacion?.estado === 'completada').length,
    enProgreso: capacitaciones.filter(c => c.miParticipacion?.estado === 'en_progreso').length,
    pendientes: capacitaciones.filter(c => c.miParticipacion?.estado === 'inscrito').length
  };

  // Filtrar capacitaciones
  const capacitacionesFiltradas = filtro === 'todos'
    ? capacitaciones
    : capacitaciones.filter(c => {
        if (filtro === 'en_progreso') return c.miParticipacion?.estado === 'en_progreso';
        if (filtro === 'completada') return c.miParticipacion?.estado === 'completada';
        if (filtro === 'inscrito') return c.miParticipacion?.estado === 'inscrito';
        return true;
      });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-3 text-muted">Cargando capacitaciones...</p>
      </div>
    );
  }

  return (
    <div className="capacitaciones-empleado-v2">
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {[
          { key: 'total', label: 'Total', value: stats.total, icon: 'bi-mortarboard-fill', gradient: 'stat-total' },
          { key: 'en_progreso', label: 'En Progreso', value: stats.enProgreso, icon: 'bi-play-circle-fill', gradient: 'stat-progreso' },
          { key: 'inscrito', label: 'Pendientes', value: stats.pendientes, icon: 'bi-clock-fill', gradient: 'stat-pendiente' },
          { key: 'completada', label: 'Completadas', value: stats.completadas, icon: 'bi-check-circle-fill', gradient: 'stat-completada' }
        ].map((stat) => (
          <div key={stat.key} className="col-6 col-md-3">
            <div
              className={`stat-card-cap ${stat.gradient} ${filtro === stat.key ? 'active' : ''}`}
              onClick={() => setFiltro(filtro === stat.key ? 'todos' : stat.key)}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon-cap">
                <i className={`bi ${stat.icon}`}></i>
              </div>
              <div className="stat-value-cap">{stat.value}</div>
              <div className="stat-label-cap">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro activo indicator */}
      {filtro !== 'todos' && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <small className="text-muted">
            Filtrando por: <strong>{filtro === 'en_progreso' ? 'En Progreso' : filtro === 'completada' ? 'Completadas' : 'Pendientes'}</strong>
          </small>
          <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => setFiltro('todos')}>
            <i className="bi bi-x"></i> Quitar filtro
          </button>
        </div>
      )}

      {/* Lista de Capacitaciones */}
      {capacitaciones.length === 0 ? (
        <div className="empty-state-cap">
          <div className="empty-icon-cap">
            <i className="bi bi-mortarboard"></i>
          </div>
          <h5>No tienes capacitaciones asignadas</h5>
          <p className="text-muted mb-0">
            Cuando te inscriban a un curso, taller o certificacion, aparecera aqui.
          </p>
        </div>
      ) : capacitacionesFiltradas.length === 0 ? (
        <div className="text-center py-4">
          <i className="bi bi-funnel display-4 text-muted mb-3 d-block"></i>
          <p className="text-muted">No hay capacitaciones con este filtro</p>
        </div>
      ) : (
        <div className="row g-3">
          {capacitacionesFiltradas.map((cap) => {
            const tipoConfig = getTipoConfig(cap.tipo);
            const estadoConfig = getEstadoConfig(cap.miParticipacion?.estado);
            const calificacion = cap.miParticipacion?.calificacion;
            const diasRestantes = getDiasRestantes(cap.fechaFin);
            const progreso = getProgresoTemporal(cap.fechaInicio, cap.fechaFin);

            return (
              <div key={cap.id} className="col-md-6 col-lg-6">
                <div
                  className="cap-card-v2"
                  onClick={() => setSelectedCap(cap)}
                >
                  {/* Color accent bar */}
                  <div className="cap-accent-bar" style={{ background: `linear-gradient(135deg, ${tipoConfig.color}, ${estadoConfig.color})` }}></div>

                  <div className="cap-card-body">
                    {/* Top row: badges */}
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex gap-2 flex-wrap">
                        <span className={`cap-badge ${getTipoConfig(cap.tipo).badge}`}>
                          <i className={`bi ${tipoConfig.icon} me-1`}></i>
                          {tipoConfig.label}
                        </span>
                        {cap.obligatoria && (
                          <span className="cap-badge badge-obligatoria">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            Obligatoria
                          </span>
                        )}
                      </div>
                      <span className={`cap-badge ${estadoConfig.badge}`}>
                        <i className={`bi ${estadoConfig.icon} me-1`}></i>
                        {estadoConfig.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h6 className="cap-title">{cap.titulo}</h6>

                    {/* Description */}
                    {cap.descripcion && (
                      <p className="cap-description">{cap.descripcion}</p>
                    )}

                    {/* Info row */}
                    <div className="cap-info-row">
                      <div className="cap-info-item">
                        <i className="bi bi-calendar3"></i>
                        <span>{formatDate(cap.fechaInicio)}</span>
                      </div>
                      <div className="cap-info-item">
                        <i className="bi bi-clock"></i>
                        <span>{cap.duracionHoras || 0}h</span>
                      </div>
                      {cap.proveedor && (
                        <div className="cap-info-item">
                          <i className="bi bi-building"></i>
                          <span>{cap.proveedor}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar for en_progreso */}
                    {cap.miParticipacion?.estado === 'en_progreso' && (
                      <div className="cap-progress-section">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <small className="text-muted fw-medium">Progreso temporal</small>
                          <small className="fw-bold" style={{ color: '#0077b6' }}>{progreso}%</small>
                        </div>
                        <div className="cap-progress-bar">
                          <div className="cap-progress-fill" style={{ width: `${progreso}%` }}></div>
                        </div>
                        {diasRestantes !== null && diasRestantes > 0 && (
                          <small className="text-muted mt-1 d-block">
                            <i className="bi bi-hourglass-split me-1"></i>
                            {diasRestantes} dias restantes
                          </small>
                        )}
                      </div>
                    )}

                    {/* Calificacion for completada/reprobada */}
                    {calificacion !== null && calificacion !== undefined && (
                      <div className="cap-calificacion-mini">
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted fw-medium">Calificacion</small>
                          <div className={`cap-score-badge ${calificacion >= 70 ? 'score-pass' : 'score-fail'}`}>
                            {calificacion}%
                          </div>
                        </div>
                        <div className="cap-progress-bar mt-1">
                          <div
                            className={`cap-progress-fill ${calificacion >= 70 ? 'fill-success' : 'fill-danger'}`}
                            style={{ width: `${calificacion}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hover arrow */}
                  <div className="cap-card-arrow">
                    <i className="bi bi-chevron-right"></i>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalles - Mejorado */}
      {selectedCap && (() => {
        const tipoConfig = getTipoConfig(selectedCap.tipo);
        const estadoConfig = getEstadoConfig(selectedCap.miParticipacion?.estado);
        const calificacion = selectedCap.miParticipacion?.calificacion;
        const progreso = getProgresoTemporal(selectedCap.fechaInicio, selectedCap.fechaFin);
        const diasRestantes = getDiasRestantes(selectedCap.fechaFin);

        return (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedCap(null)}>
            <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow-lg cap-modal-v2" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                {/* Header con gradiente */}
                <div className="cap-modal-header" style={{
                  background: `linear-gradient(135deg, ${tipoConfig.color} 0%, ${tipoConfig.color}dd 100%)`,
                  padding: '24px 28px',
                  color: 'white',
                  position: 'relative'
                }}>
                  <div className="cap-modal-header-pattern"></div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="d-flex gap-2 flex-wrap mb-2">
                        <span className="badge bg-white bg-opacity-25 text-white">
                          <i className={`bi ${tipoConfig.icon} me-1`}></i>
                          {tipoConfig.label}
                        </span>
                        <span className="badge bg-white bg-opacity-25 text-white">
                          <i className={`bi ${estadoConfig.icon} me-1`}></i>
                          {estadoConfig.label}
                        </span>
                        {selectedCap.obligatoria && (
                          <span className="badge bg-danger">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            Obligatoria
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-light bg-white bg-opacity-25 border-0 text-white"
                        onClick={() => setSelectedCap(null)}
                        style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                    <h4 className="fw-bold mb-1 mt-1">{selectedCap.titulo}</h4>
                    {selectedCap.proveedor && (
                      <small className="opacity-75">
                        <i className="bi bi-building me-1"></i>
                        {selectedCap.proveedor}
                      </small>
                    )}
                  </div>
                </div>

                <div className="modal-body p-4">
                  {/* Descripcion */}
                  {selectedCap.descripcion && (
                    <div className="mb-4">
                      <p className="text-muted mb-0" style={{ lineHeight: '1.6' }}>{selectedCap.descripcion}</p>
                    </div>
                  )}

                  {/* Info Cards en row */}
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                      <div className="cap-detail-box">
                        <div className="cap-detail-icon" style={{ color: '#4361ee' }}>
                          <i className="bi bi-calendar3"></i>
                        </div>
                        <div className="cap-detail-label">Inicio</div>
                        <div className="cap-detail-value">{formatDate(selectedCap.fechaInicio)}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="cap-detail-box">
                        <div className="cap-detail-icon" style={{ color: '#e63946' }}>
                          <i className="bi bi-calendar-check"></i>
                        </div>
                        <div className="cap-detail-label">Fin</div>
                        <div className="cap-detail-value">{formatDate(selectedCap.fechaFin)}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="cap-detail-box">
                        <div className="cap-detail-icon" style={{ color: '#f77f00' }}>
                          <i className="bi bi-clock-history"></i>
                        </div>
                        <div className="cap-detail-label">Duracion</div>
                        <div className="cap-detail-value">{selectedCap.duracionHoras || 0} hrs</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="cap-detail-box">
                        <div className="cap-detail-icon" style={{ color: '#7209b7' }}>
                          <i className="bi bi-building"></i>
                        </div>
                        <div className="cap-detail-label">Proveedor</div>
                        <div className="cap-detail-value">{selectedCap.proveedor || 'Interno'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline de Progreso (para en_progreso) */}
                  {selectedCap.miParticipacion?.estado === 'en_progreso' && (
                    <div className="cap-progress-card mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0 fw-bold">
                          <i className="bi bi-graph-up me-2" style={{ color: '#0077b6' }}></i>
                          Progreso de la Capacitacion
                        </h6>
                        <span className="badge rounded-pill" style={{ background: '#0077b6', fontSize: '0.85rem' }}>
                          {progreso}%
                        </span>
                      </div>
                      <div className="cap-progress-bar-lg">
                        <div className="cap-progress-fill-lg" style={{ width: `${progreso}%` }}></div>
                      </div>
                      <div className="d-flex justify-content-between mt-2">
                        <small className="text-muted">
                          <i className="bi bi-calendar3 me-1"></i>
                          {formatDate(selectedCap.fechaInicio)}
                        </small>
                        {diasRestantes !== null && diasRestantes > 0 && (
                          <small className="fw-medium" style={{ color: '#0077b6' }}>
                            <i className="bi bi-hourglass-split me-1"></i>
                            {diasRestantes} dias restantes
                          </small>
                        )}
                        <small className="text-muted">
                          <i className="bi bi-calendar-check me-1"></i>
                          {formatDate(selectedCap.fechaFin)}
                        </small>
                      </div>
                    </div>
                  )}

                  {/* Calificacion grande */}
                  {calificacion !== null && calificacion !== undefined && (
                    <div className="cap-calificacion-card">
                      <div className="row align-items-center">
                        <div className="col-auto">
                          <div className={`cap-score-circle ${calificacion >= 70 ? 'score-circle-pass' : 'score-circle-fail'}`}>
                            <span className="cap-score-number">{calificacion}</span>
                            <span className="cap-score-percent">%</span>
                          </div>
                        </div>
                        <div className="col">
                          <h6 className="fw-bold mb-1">Tu Calificacion</h6>
                          <div className={`cap-result-badge ${calificacion >= 70 ? 'result-pass' : 'result-fail'}`}>
                            <i className={`bi ${calificacion >= 70 ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                            {calificacion >= 70 ? 'Aprobado' : 'Reprobado'}
                          </div>
                          <div className="cap-progress-bar mt-2" style={{ height: '8px' }}>
                            <div
                              className={`cap-progress-fill ${calificacion >= 70 ? 'fill-success' : 'fill-danger'}`}
                              style={{ width: `${calificacion}%` }}
                            ></div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <small className="text-muted">0%</small>
                            <small className="text-muted" style={{ position: 'relative', left: '-10%' }}>
                              <span style={{ borderLeft: '1px dashed #dee2e6', paddingLeft: '4px' }}>70% min</span>
                            </small>
                            <small className="text-muted">100%</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fecha de inscripcion */}
                  {selectedCap.miParticipacion?.fechaInscripcion && (
                    <div className="text-center mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
                      <small className="text-muted">
                        <i className="bi bi-calendar-plus me-1"></i>
                        Inscrito el {formatDate(selectedCap.miParticipacion.fechaInscripcion)}
                      </small>
                    </div>
                  )}
                </div>

                <div className="modal-footer border-0 px-4 pb-4 pt-0">
                  <button
                    type="button"
                    className="btn btn-secondary px-4"
                    style={{ borderRadius: '10px' }}
                    onClick={() => setSelectedCap(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        /* ============ STAT CARDS ============ */
        .stat-card-cap {
          border-radius: 14px;
          padding: 18px 14px;
          text-align: center;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
          border: 2px solid transparent;
        }
        .stat-card-cap:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .stat-card-cap.active {
          border-color: currentColor;
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }
        .stat-total {
          background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
          color: #4361ee;
        }
        .stat-total.active { border-color: #4361ee; }
        .stat-progreso {
          background: linear-gradient(135deg, #e8f4fd 0%, #d6ecfa 100%);
          color: #0077b6;
        }
        .stat-progreso.active { border-color: #0077b6; }
        .stat-pendiente {
          background: linear-gradient(135deg, #fff8e8 0%, #ffefcf 100%);
          color: #e8850c;
        }
        .stat-pendiente.active { border-color: #e8850c; }
        .stat-completada {
          background: linear-gradient(135deg, #e8f5e9 0%, #d4edda 100%);
          color: #198754;
        }
        .stat-completada.active { border-color: #198754; }
        .stat-icon-cap {
          font-size: 1.5rem;
          margin-bottom: 4px;
          opacity: 0.85;
        }
        .stat-value-cap {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .stat-label-cap {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.7;
        }

        /* ============ TRAINING CARDS ============ */
        .cap-card-v2 {
          background: white;
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .cap-card-v2:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        }
        .cap-card-v2:hover .cap-card-arrow {
          opacity: 1;
          right: 12px;
        }
        .cap-accent-bar {
          height: 4px;
          width: 100%;
        }
        .cap-card-body {
          padding: 18px 20px 16px;
          flex: 1;
        }
        .cap-card-arrow {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          transition: all 0.3s ease;
          color: #adb5bd;
          font-size: 1.2rem;
        }

        /* ============ BADGES ============ */
        .cap-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .badge-tipo-curso { background: #eef1ff; color: #4361ee; }
        .badge-tipo-cert { background: #f3e8ff; color: #7209b7; }
        .badge-tipo-taller { background: #fff4e5; color: #f77f00; }
        .badge-estado-inscrito { background: #f0f0f0; color: #6c757d; }
        .badge-estado-progreso { background: #e0f2fe; color: #0077b6; }
        .badge-estado-completada { background: #dcfce7; color: #16a34a; }
        .badge-estado-reprobada { background: #fee2e2; color: #dc2626; }
        .badge-obligatoria { background: #fee2e2; color: #dc2626; }

        /* ============ CARD CONTENT ============ */
        .cap-title {
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: 6px;
          color: #1a1a2e;
          line-height: 1.3;
        }
        .cap-description {
          color: #6c757d;
          font-size: 0.85rem;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .cap-info-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .cap-info-item {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #8b95a5;
          font-size: 0.8rem;
        }
        .cap-info-item i {
          font-size: 0.85rem;
        }

        /* ============ PROGRESS BARS ============ */
        .cap-progress-section {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #f5f5f5;
        }
        .cap-progress-bar {
          height: 6px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
        }
        .cap-progress-fill {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(90deg, #0077b6, #00b4d8);
          transition: width 0.8s ease;
        }
        .cap-progress-fill.fill-success {
          background: linear-gradient(90deg, #198754, #20c997);
        }
        .cap-progress-fill.fill-danger {
          background: linear-gradient(90deg, #dc3545, #e76f51);
        }
        .cap-progress-bar-lg {
          height: 10px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
        }
        .cap-progress-fill-lg {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(90deg, #0077b6, #00b4d8);
          transition: width 0.8s ease;
        }

        /* ============ CALIFICACION MINI (card) ============ */
        .cap-calificacion-mini {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #f5f5f5;
        }
        .cap-score-badge {
          font-size: 0.8rem;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 12px;
        }
        .cap-score-badge.score-pass { background: #dcfce7; color: #16a34a; }
        .cap-score-badge.score-fail { background: #fee2e2; color: #dc2626; }

        /* ============ MODAL ============ */
        .cap-modal-header-pattern {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%);
          pointer-events: none;
        }

        /* ============ DETAIL BOXES ============ */
        .cap-detail-box {
          background: #fafbfc;
          border-radius: 12px;
          padding: 16px 12px;
          text-align: center;
          border: 1px solid #f0f0f0;
          height: 100%;
          transition: all 0.2s ease;
        }
        .cap-detail-box:hover {
          background: #f5f6f8;
          border-color: #e0e0e0;
        }
        .cap-detail-icon {
          font-size: 1.3rem;
          margin-bottom: 6px;
        }
        .cap-detail-label {
          font-size: 0.7rem;
          color: #8b95a5;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .cap-detail-value {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1a1a2e;
        }

        /* ============ PROGRESS CARD (modal) ============ */
        .cap-progress-card {
          background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #d6ecfa;
        }

        /* ============ CALIFICACION CARD (modal) ============ */
        .cap-calificacion-card {
          background: #fafbfc;
          border-radius: 14px;
          padding: 20px 24px;
          border: 1px solid #f0f0f0;
        }
        .cap-score-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: row;
          gap: 1px;
        }
        .score-circle-pass {
          background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          border: 3px solid #86efac;
        }
        .score-circle-fail {
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          border: 3px solid #fca5a5;
        }
        .cap-score-number {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1;
        }
        .score-circle-pass .cap-score-number { color: #16a34a; }
        .score-circle-fail .cap-score-number { color: #dc2626; }
        .cap-score-percent {
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 2px;
        }
        .score-circle-pass .cap-score-percent { color: #22c55e; }
        .score-circle-fail .cap-score-percent { color: #ef4444; }
        .cap-result-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .result-pass { background: #dcfce7; color: #16a34a; }
        .result-fail { background: #fee2e2; color: #dc2626; }

        /* ============ EMPTY STATE ============ */
        .empty-state-cap {
          text-align: center;
          padding: 60px 20px;
          background: linear-gradient(135deg, #fafbfc 0%, #f5f6f8 100%);
          border-radius: 16px;
          border: 2px dashed #dee2e6;
        }
        .empty-icon-cap {
          font-size: 3.5rem;
          color: #adb5bd;
          margin-bottom: 16px;
        }
        .empty-state-cap h5 {
          color: #495057;
          font-weight: 700;
        }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 768px) {
          .cap-card-body { padding: 14px 16px 12px; }
          .stat-card-cap { padding: 14px 10px; }
          .stat-value-cap { font-size: 1.4rem; }
          .cap-detail-box { padding: 12px 8px; }
          .cap-calificacion-card { padding: 16px; }
          .cap-score-circle { width: 64px; height: 64px; }
          .cap-score-number { font-size: 1.3rem; }
        }
      `}</style>
    </div>
  );
}

export default CapacitacionesTab;
