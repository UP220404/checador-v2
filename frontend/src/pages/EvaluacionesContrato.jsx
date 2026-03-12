import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { toast } from 'sonner';
import { api } from '../services/api';
import '../styles/EvaluacionesContrato.css';

const AVATAR_COLORS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
];

function EvaluacionesContrato() {
  const { isAdminRH, departmentFilter } = useRoleData();

  const [evaluaciones, setEvaluaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    completadas: 0,
    vencidas: 0,
    aprobadas: 0,
    rechazadas: 0
  });

  const [filtros, setFiltros] = useState({
    estado: '',
    tipoEvaluacion: '',
    busqueda: ''
  });

  const [showModal, setShowModal] = useState(false);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState(null);
  const [formData, setFormData] = useState({
    resultado: '',
    comentarios: ''
  });
  const [saving, setSaving] = useState(false);

  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [evalResponse, statsResponse] = await Promise.all([
        api.getContractEvaluations(),
        api.getContractEvaluationStats()
      ]);

      if (evalResponse.data.success) {
        setEvaluaciones(evalResponse.data.data || []);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const evaluacionesFiltradas = evaluaciones.filter(e => {
    const matchEstado = !filtros.estado || e.estado === filtros.estado;
    const matchTipo = !filtros.tipoEvaluacion || e.tipoEvaluacion === filtros.tipoEvaluacion;
    const matchBusqueda = !filtros.busqueda ||
      e.empleadoNombre?.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      e.empleadoEmail?.toLowerCase().includes(filtros.busqueda.toLowerCase());
    return matchEstado && matchTipo && matchBusqueda;
  });

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const abrirModalCompletar = (evaluacion) => {
    setEvaluacionSeleccionada(evaluacion);
    setFormData({ resultado: '', comentarios: '' });
    setShowModal(true);
  };

  const completarEvaluacion = async () => {
    if (!formData.resultado) {
      showToast('Debe seleccionar un resultado', 'warning');
      return;
    }

    try {
      setSaving(true);
      const response = await api.completeContractEvaluation(evaluacionSeleccionada.id, formData);

      if (response.data.success) {
        showToast(response.data.message, 'success');
        setShowModal(false);
        cargarDatos();
      }
    } catch (error) {
      console.error('Error completando evaluacion:', error);
      showToast(error.response?.data?.message || 'Error al completar evaluacion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const verificarPendientes = async () => {
    try {
      const response = await api.checkPendingContractEvaluations();
      if (response.data.success) {
        showToast(response.data.message, 'success');
        cargarDatos();
      }
    } catch (error) {
      console.error('Error verificando pendientes:', error);
      showToast('Error al verificar pendientes', 'error');
    }
  };

  const getNombreCorto = (nombreCompleto) => {
    if (!nombreCompleto) return 'Sin nombre';
    const palabras = nombreCompleto.trim().split(/\s+/);
    if (palabras.length <= 2) return nombreCompleto;
    return `${palabras[0]} ${palabras[1]}`;
  };

  const getInitials = (nombre) => {
    if (!nombre) return '?';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const getAvatarColor = (nombre) => {
    if (!nombre) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const calcularDiasRestantes = (fechaProgramada) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaProgramada + 'T00:00:00');
    return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '-';
    try {
      const d = new Date(fecha + 'T00:00:00');
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return fecha; }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'pendiente': return 'bi-hourglass-split';
      case 'completada': return 'bi-check-circle-fill';
      case 'vencida': return 'bi-exclamation-triangle-fill';
      default: return 'bi-question-circle';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'completada': return 'Completada';
      case 'vencida': return 'Vencida';
      default: return estado;
    }
  };

  const getAccionClass = (accion) => {
    switch (accion) {
      case 'extension_contrato': return 'extension';
      case 'conversion_indefinido': return 'indefinido';
      case 'terminacion': return 'terminacion';
      default: return '';
    }
  };

  const getAccionLabel = (accion) => {
    switch (accion) {
      case 'extension_contrato': return 'Extendido a 2 meses';
      case 'conversion_indefinido': return 'Contrato Indefinido';
      case 'terminacion': return 'Terminado';
      default: return accion || '-';
    }
  };

  const getAccionIcon = (accion) => {
    switch (accion) {
      case 'extension_contrato': return 'bi-arrow-repeat';
      case 'conversion_indefinido': return 'bi-infinity';
      case 'terminacion': return 'bi-x-circle';
      default: return 'bi-dash';
    }
  };

  const statsConfig = [
    { key: 'pendientes', label: 'Pendientes', icon: 'bi-hourglass-split', cls: 'pending' },
    { key: 'completadas', label: 'Completadas', icon: 'bi-check-circle', cls: 'completed' },
    { key: 'vencidas', label: 'Vencidas', icon: 'bi-exclamation-circle', cls: 'expired' },
    { key: 'aprobadas', label: 'Aprobadas', icon: 'bi-hand-thumbs-up', cls: 'approved' },
    { key: 'rechazadas', label: 'Rechazadas', icon: 'bi-hand-thumbs-down', cls: 'rejected' },
    { key: 'total', label: 'Total', icon: 'bi-list-check', cls: 'total' },
  ];

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="evcon-page-header">
        <div className="evcon-page-header-top">
          <div>
            <h2 className="evcon-page-title">
              <i className="bi bi-file-earmark-person"></i>
              Evaluaciones de Contrato
            </h2>
            <div className="evcon-page-subtitle">
              Seguimiento de evaluaciones de empleados en periodo de prueba
            </div>
          </div>
          {isAdminRH && (
            <div className="evcon-header-actions">
              <button className="evcon-btn-verify" onClick={verificarPendientes}>
                <i className="bi bi-arrow-clockwise"></i>
                Verificar Pendientes
              </button>
            </div>
          )}
        </div>

        {/* Stats inline in header */}
        <div className="evcon-stats-row">
          {statsConfig.map(s => (
            <div key={s.key} className={`evcon-stat-card ${s.cls}`}>
              <div className="evcon-stat-icon">
                <i className={`bi ${s.icon}`}></i>
              </div>
              <div className="evcon-stat-value">{stats[s.key] || 0}</div>
              <div className="evcon-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <DepartmentBanner />

      {/* Filter Bar */}
      <div className="evcon-filter-bar">
        <div className="evcon-filter-group">
          <label className="evcon-filter-label">Estado</label>
          <select
            className="evcon-filter-select"
            value={filtros.estado}
            onChange={(e) => handleFiltroChange('estado', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="completada">Completadas</option>
            <option value="vencida">Vencidas</option>
          </select>
        </div>
        <div className="evcon-filter-group">
          <label className="evcon-filter-label">Tipo</label>
          <select
            className="evcon-filter-select"
            value={filtros.tipoEvaluacion}
            onChange={(e) => handleFiltroChange('tipoEvaluacion', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="evaluacion_1_mes">Evaluacion 1 Mes</option>
            <option value="evaluacion_2_meses">Evaluacion 2 Meses</option>
          </select>
        </div>
        <div className="evcon-filter-group search">
          <label className="evcon-filter-label">Buscar empleado</label>
          <input
            type="text"
            className="evcon-filter-input"
            placeholder="Nombre o email..."
            value={filtros.busqueda}
            onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="evcon-loading">
          <div className="evcon-spinner"></div>
          <div className="evcon-loading-text">Cargando evaluaciones...</div>
        </div>
      ) : evaluacionesFiltradas.length === 0 ? (
        <div className="evcon-empty">
          <i className="bi bi-inbox"></i>
          <p>No hay evaluaciones que mostrar</p>
        </div>
      ) : (
        <div className="evcon-list">
          {evaluacionesFiltradas.map((evaluacion) => {
            const fechaRef = evaluacion.fechaFinContrato || evaluacion.fechaProgramada;
            const diasRestantes = calcularDiasRestantes(fechaRef);
            const isUrgent = evaluacion.estado === 'pendiente' && diasRestantes <= 7;
            const diasClass = diasRestantes <= 0 ? 'danger' : diasRestantes <= 3 ? 'warning' : diasRestantes <= 7 ? 'warning' : 'safe';

            return (
              <div
                key={evaluacion.id}
                className={`evcon-card estado-${evaluacion.estado} ${isUrgent ? 'urgent' : ''}`}
              >
                <div className="evcon-card-accent"></div>
                <div className="evcon-card-body">
                  {/* Avatar */}
                  <div
                    className="evcon-avatar"
                    style={{ background: getAvatarColor(evaluacion.empleadoNombre) }}
                  >
                    {getInitials(evaluacion.empleadoNombre)}
                  </div>

                  {/* Employee Info */}
                  <div className="evcon-card-info">
                    <div className="evcon-card-name">{getNombreCorto(evaluacion.empleadoNombre)}</div>
                    <div className="evcon-card-dept">{evaluacion.departamento || 'Sin departamento'}</div>
                  </div>

                  {/* Chips */}
                  <div className="evcon-chips">
                    <span className={`evcon-chip ${evaluacion.tipoEvaluacion === 'evaluacion_1_mes' ? 'tipo-1mes' : 'tipo-2meses'}`}>
                      <i className={`bi ${evaluacion.tipoEvaluacion === 'evaluacion_1_mes' ? 'bi-1-circle' : 'bi-2-circle'}`}></i>
                      {evaluacion.tipoEvaluacion === 'evaluacion_1_mes' ? '1 Mes' : '2 Meses'}
                    </span>
                    <span className="evcon-chip fecha" title="Fin de contrato">
                      <i className="bi bi-calendar-x"></i>
                      Vence: {formatFecha(evaluacion.fechaFinContrato || evaluacion.fechaProgramada)}
                    </span>
                  </div>

                  {/* Estado badge */}
                  <span className={`evcon-estado ${evaluacion.estado}`}>
                    <i className={`bi ${getEstadoIcon(evaluacion.estado)}`}></i>
                    {getEstadoLabel(evaluacion.estado)}
                  </span>

                  {/* Resultado / Dias / Accion */}
                  {evaluacion.resultado ? (
                    <span className={`evcon-resultado ${evaluacion.resultado}`}>
                      <i className={`bi ${evaluacion.resultado === 'aprobado' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                      {evaluacion.resultado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  ) : evaluacion.estado === 'pendiente' ? (
                    <div className="evcon-dias">
                      <div className={`evcon-dias-number ${diasClass}`}>
                        {diasRestantes <= 0 ? '!' : diasRestantes}
                      </div>
                      <div className="evcon-dias-label">
                        {diasRestantes <= 0 ? 'Vencido' : diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                      </div>
                    </div>
                  ) : null}

                  {/* Accion tomada */}
                  {evaluacion.accionTomada && (
                    <span className={`evcon-accion ${getAccionClass(evaluacion.accionTomada)}`}>
                      <i className={`bi ${getAccionIcon(evaluacion.accionTomada)}`}></i>
                      {getAccionLabel(evaluacion.accionTomada)}
                    </span>
                  )}

                  {/* Boton evaluar */}
                  {evaluacion.estado === 'pendiente' && isAdminRH && (
                    <button
                      className="evcon-btn-eval"
                      onClick={() => abrirModalCompletar(evaluacion)}
                    >
                      <i className="bi bi-clipboard-check"></i>
                      Evaluar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Completar Evaluacion */}
      {showModal && evaluacionSeleccionada && (
        <div className="evcon-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="evcon-modal">
            <div className="evcon-modal-header">
              <h5 className="evcon-modal-title">
                <i className="bi bi-clipboard-check"></i>
                Completar Evaluacion
              </h5>
              <button className="evcon-modal-close" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="evcon-modal-body">
              {/* Employee info */}
              <div className="evcon-modal-employee">
                <div className="evcon-modal-emp-avatar">
                  {getInitials(evaluacionSeleccionada.empleadoNombre)}
                </div>
                <div>
                  <div className="evcon-modal-emp-name">{evaluacionSeleccionada.empleadoNombre}</div>
                  <div className="evcon-modal-emp-email">{evaluacionSeleccionada.empleadoEmail}</div>
                  <span className="evcon-modal-emp-tipo">
                    <i className="bi bi-clock"></i>
                    {evaluacionSeleccionada.tipoEvaluacion === 'evaluacion_1_mes' ? 'Evaluacion 1 Mes' : 'Evaluacion 2 Meses'}
                  </span>
                </div>
              </div>

              {/* Resultado selection */}
              <label className="evcon-form-label">
                Resultado de la Evaluacion <span className="required">*</span>
              </label>
              <div className="evcon-resultado-options">
                <label className="evcon-resultado-option">
                  <input
                    type="radio"
                    name="resultado"
                    value="aprobado"
                    checked={formData.resultado === 'aprobado'}
                    onChange={(e) => setFormData(prev => ({ ...prev, resultado: e.target.value }))}
                  />
                  <span className="evcon-resultado-label aprobado">
                    <i className="bi bi-check-circle"></i>
                    Aprobado
                  </span>
                </label>
                <label className="evcon-resultado-option">
                  <input
                    type="radio"
                    name="resultado"
                    value="rechazado"
                    checked={formData.resultado === 'rechazado'}
                    onChange={(e) => setFormData(prev => ({ ...prev, resultado: e.target.value }))}
                  />
                  <span className="evcon-resultado-label rechazado">
                    <i className="bi bi-x-circle"></i>
                    Rechazado
                  </span>
                </label>
              </div>

              {/* Alert info */}
              {formData.resultado && (
                <div className={`evcon-alert ${formData.resultado === 'aprobado' ? 'success' : 'danger'}`}>
                  <i className={`bi ${formData.resultado === 'aprobado' ? 'bi-info-circle' : 'bi-exclamation-triangle'}`}></i>
                  {formData.resultado === 'aprobado' ? (
                    evaluacionSeleccionada.tipoEvaluacion === 'evaluacion_1_mes' ?
                      'El contrato se extendera por 2 meses adicionales.' :
                      'El contrato se convertira a indefinido.'
                  ) : (
                    'El contrato sera terminado y el empleado sera desactivado.'
                  )}
                </div>
              )}

              {/* Comentarios */}
              <label className="evcon-form-label">Comentarios</label>
              <textarea
                className="evcon-textarea"
                placeholder="Observaciones sobre el desempeno del empleado..."
                value={formData.comentarios}
                onChange={(e) => setFormData(prev => ({ ...prev, comentarios: e.target.value }))}
              ></textarea>
            </div>
            <div className="evcon-modal-footer">
              <button className="evcon-btn-cancel" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </button>
              <button className="evcon-btn-submit" onClick={completarEvaluacion} disabled={saving || !formData.resultado}>
                {saving ? (
                  <>
                    <span className="evcon-spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0, display: 'inline-block' }}></span>
                    Procesando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle"></i>
                    Completar Evaluacion
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export default EvaluacionesContrato;
