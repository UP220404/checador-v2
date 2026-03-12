import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'sonner';
import { api } from '../services/api';
import '../styles/Evaluaciones.css';

const EJEMPLO_EVALUACIONES = [
  {
    id: 'eval-1', empleadoUid: 'demo1', empleadoEmail: 'maria@ejemplo.com',
    empleadoNombre: 'Maria Garcia', departamento: 'Recursos Humanos',
    periodo: { tipo: 'trimestral', fechaInicio: '2026-01-01', fechaFin: '2026-03-31' },
    categorias: [
      { nombre: 'Puntualidad', calificacion: 5, comentarios: 'Siempre llega a tiempo' },
      { nombre: 'Trabajo en equipo', calificacion: 4, comentarios: 'Colabora bien con el equipo' },
      { nombre: 'Productividad', calificacion: 5, comentarios: 'Cumple metas consistentemente' },
      { nombre: 'Comunicacion', calificacion: 4, comentarios: 'Buena comunicacion verbal' },
      { nombre: 'Iniciativa', calificacion: 5, comentarios: 'Propone mejoras constantemente' }
    ],
    fortalezas: 'Excelente organizacion, proactividad, liderazgo natural',
    areasOportunidad: 'Mejorar documentacion de procesos',
    estado: 'completada', fechaCreacion: '2026-01-15', esEjemplo: true
  },
  {
    id: 'eval-2', empleadoUid: 'demo2', empleadoEmail: 'juan@ejemplo.com',
    empleadoNombre: 'Juan Lopez', departamento: 'Operaciones',
    periodo: { tipo: 'trimestral', fechaInicio: '2026-01-01', fechaFin: '2026-03-31' },
    categorias: [
      { nombre: 'Puntualidad', calificacion: 4, comentarios: '' },
      { nombre: 'Trabajo en equipo', calificacion: 5, comentarios: 'Excelente colaborador' },
      { nombre: 'Productividad', calificacion: 4, comentarios: '' },
      { nombre: 'Comunicacion', calificacion: 3, comentarios: 'Puede mejorar' },
      { nombre: 'Iniciativa', calificacion: 4, comentarios: '' }
    ],
    fortalezas: 'Trabajo en equipo, resolucion de problemas',
    areasOportunidad: 'Comunicacion escrita, presentaciones',
    estado: 'borrador', fechaCreacion: '2026-01-20', esEjemplo: true
  },
  {
    id: 'eval-3', empleadoUid: 'demo3', empleadoEmail: 'ana@ejemplo.com',
    empleadoNombre: 'Ana Martinez', departamento: 'Ventas',
    periodo: { tipo: 'mensual', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' },
    categorias: [
      { nombre: 'Puntualidad', calificacion: 5, comentarios: '' },
      { nombre: 'Trabajo en equipo', calificacion: 5, comentarios: '' },
      { nombre: 'Productividad', calificacion: 5, comentarios: 'Supera metas de ventas' },
      { nombre: 'Comunicacion', calificacion: 5, comentarios: 'Excelente con clientes' },
      { nombre: 'Iniciativa', calificacion: 5, comentarios: '' }
    ],
    fortalezas: 'Comunicacion excepcional, orientacion a resultados',
    areasOportunidad: 'Delegacion de tareas',
    estado: 'revisada', fechaCreacion: '2026-01-25', esEjemplo: true
  }
];

const CATEGORIAS_DEFAULT = [
  { nombre: 'Puntualidad', calificacion: 3, comentarios: '' },
  { nombre: 'Trabajo en equipo', calificacion: 3, comentarios: '' },
  { nombre: 'Productividad', calificacion: 3, comentarios: '' },
  { nombre: 'Comunicacion', calificacion: 3, comentarios: '' },
  { nombre: 'Iniciativa', calificacion: 3, comentarios: '' }
];

function Evaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEval, setSelectedEval] = useState(null);
  const [stats, setStats] = useState(null);
  const [usandoEjemplos, setUsandoEjemplos] = useState(false);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');

  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  const [formData, setFormData] = useState({
    empleadoUid: '', empleadoEmail: '', empleadoNombre: '', departamento: '',
    periodo: { tipo: 'trimestral', fechaInicio: '', fechaFin: '' },
    categorias: [...CATEGORIAS_DEFAULT], fortalezas: '', areasOportunidad: '', estado: 'borrador'
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes] = await Promise.all([api.getUsers()]);
      setEmpleados(usersRes.data.data || []);

      let evalsData = [];
      try {
        const evalRes = await api.getEvaluations({});
        evalsData = evalRes.data.data || [];
      } catch { console.log('No se pudieron cargar evaluaciones, usando ejemplos'); }

      if (evalsData.length === 0) { evalsData = EJEMPLO_EVALUACIONES; setUsandoEjemplos(true); }
      else { setUsandoEjemplos(false); }

      setEvaluaciones(evalsData);
      setStats({
        total: evalsData.length,
        promedioGeneral: calcularPromedioGeneral(evalsData),
        porEstado: {
          borrador: evalsData.filter(e => e.estado === 'borrador').length,
          completada: evalsData.filter(e => e.estado === 'completada').length,
          revisada: evalsData.filter(e => e.estado === 'revisada').length
        },
        departamentos: [...new Set(evalsData.map(e => e.departamento).filter(Boolean))]
      });
    } catch (err) {
      console.error('Error cargando datos:', err);
      setEvaluaciones(EJEMPLO_EVALUACIONES);
      setUsandoEjemplos(true);
    } finally { setLoading(false); }
  };

  // ============ HELPERS ============
  const calcularPromedioGeneral = (evals) => {
    if (evals.length === 0) return 0;
    return (evals.reduce((acc, e) => acc + calcularPromedio(e.categorias), 0) / evals.length).toFixed(1);
  };

  const calcularPromedio = (categorias) => {
    if (!categorias || categorias.length === 0) return 0;
    return categorias.reduce((sum, cat) => sum + (cat.calificacion || 0), 0) / categorias.length;
  };

  const getCalColor = (cal) => {
    if (cal >= 4.5) return '#16a34a';
    if (cal >= 3.5) return '#4361ee';
    if (cal >= 2.5) return '#e8850c';
    return '#dc2626';
  };

  const getCalBadgeClass = (cal) => {
    if (cal >= 4.5) return 'eval-cal-excelente';
    if (cal >= 3.5) return 'eval-cal-muybueno';
    if (cal >= 2.5) return 'eval-cal-bueno';
    return 'eval-cal-regular';
  };

  const getCalLabel = (cal) => {
    if (cal >= 4.5) return 'Excelente';
    if (cal >= 3.5) return 'Muy Bueno';
    if (cal >= 2.5) return 'Bueno';
    if (cal >= 1.5) return 'Regular';
    return 'Deficiente';
  };

  const getEstadoBadgeClass = (estado) => {
    const map = { borrador: 'eval-estado-borrador', completada: 'eval-estado-completada', revisada: 'eval-estado-revisada' };
    return map[estado] || 'eval-estado-borrador';
  };

  const getEstadoIcon = (estado) => {
    const map = { borrador: 'bi-pencil', completada: 'bi-check-circle-fill', revisada: 'bi-eye-fill' };
    return map[estado] || 'bi-pencil';
  };

  const getEstadoLabel = (estado) => {
    const map = { borrador: 'Borrador', completada: 'Completada', revisada: 'Revisada' };
    return map[estado] || 'Borrador';
  };

  const getAccentColor = (cal) => {
    if (cal >= 4.5) return 'linear-gradient(90deg, #16a34a, #22c55e)';
    if (cal >= 3.5) return 'linear-gradient(90deg, #4361ee, #6366f1)';
    if (cal >= 2.5) return 'linear-gradient(90deg, #e8850c, #f59e0b)';
    return 'linear-gradient(90deg, #dc2626, #ef4444)';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  // ============ HANDLERS ============
  const handleEmpleadoChange = (e) => {
    const uid = e.target.value;
    const empleado = empleados.find(emp => (emp.uid || emp.id) === uid);
    if (empleado) {
      setFormData({ ...formData, empleadoUid: empleado.uid || empleado.id, empleadoEmail: empleado.email || empleado.correo, empleadoNombre: empleado.nombre, departamento: empleado.departamento || '' });
    }
  };

  const handleCategoriaChange = (index, field, value) => {
    const newCategorias = [...formData.categorias];
    newCategorias[index] = { ...newCategorias[index], [field]: value };
    setFormData({ ...formData, categorias: newCategorias });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.empleadoUid) { showToast('Selecciona un empleado', 'warning'); return; }
    try {
      if (selectedEval && !selectedEval.esEjemplo) {
        await api.updateEvaluation(selectedEval.id, formData);
        showToast('Evaluacion actualizada exitosamente', 'success');
      } else {
        await api.createEvaluation(formData);
        showToast('Evaluacion creada exitosamente', 'success');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) { console.error('Error guardando evaluacion:', err); showToast('Error al guardar la evaluacion', 'error'); }
  };

  const handleEdit = (eval_) => {
    if (eval_.esEjemplo) { showToast('Este es un ejemplo. Crea una evaluacion real para editarla.', 'warning'); return; }
    setSelectedEval(eval_);
    setFormData({
      empleadoUid: eval_.empleadoUid, empleadoEmail: eval_.empleadoEmail, empleadoNombre: eval_.empleadoNombre,
      departamento: eval_.departamento, periodo: eval_.periodo || { tipo: 'trimestral', fechaInicio: '', fechaFin: '' },
      categorias: eval_.categorias || [...CATEGORIAS_DEFAULT], fortalezas: eval_.fortalezas || '', areasOportunidad: eval_.areasOportunidad || '', estado: eval_.estado
    });
    setShowModal(true);
  };

  const handleViewDetail = (eval_) => { setSelectedEval(eval_); setShowDetailModal(true); };

  const handleDelete = async (id, esEjemplo) => {
    if (esEjemplo) { showToast('Los ejemplos no se pueden eliminar', 'warning'); return; }
    
    const result = await Swal.fire({
      title: '¿Eliminar evaluación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    
    try { await api.deleteEvaluation(id); showToast('Evaluacion eliminada', 'success'); loadData(); }
    catch { showToast('Solo se pueden eliminar borradores', 'error'); }
  };

  const resetForm = () => {
    setSelectedEval(null);
    setFormData({
      empleadoUid: '', empleadoEmail: '', empleadoNombre: '', departamento: '',
      periodo: { tipo: 'trimestral', fechaInicio: '', fechaFin: '' },
      categorias: CATEGORIAS_DEFAULT.map(c => ({ ...c })), fortalezas: '', areasOportunidad: '', estado: 'borrador'
    });
  };

  const filtrarEvaluaciones = () => {
    return evaluaciones.filter(eval_ => {
      if (filtroEstado && eval_.estado !== filtroEstado) return false;
      if (filtroDepartamento && eval_.departamento !== filtroDepartamento) return false;
      return true;
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="evaluaciones-container d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status"><span className="visually-hidden">Cargando...</span></div>
            <p className="text-muted fw-semibold">Cargando evaluaciones...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const evalsFiltered = filtrarEvaluaciones();

  return (
    <AdminLayout>
      <div className="evaluaciones-container">
        {/* ============ HEADER ============ */}
        <div className="eval-page-header d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="eval-header-title">
              <i className="bi bi-clipboard-check-fill me-2"></i>
              Evaluaciones de Desempeno
            </div>
            <div className="eval-header-sub">Gestiona y da seguimiento a las evaluaciones periodicas del personal</div>
          </div>
          <button className="btn btn-light fw-bold" onClick={() => { resetForm(); setShowModal(true); }} style={{ position: 'relative', zIndex: 1, borderRadius: '12px', padding: '10px 22px' }}>
            <i className="bi bi-plus-circle me-2"></i>
            Nueva Evaluacion
          </button>
        </div>

        {/* ============ DEMO ALERT ============ */}
        {usandoEjemplos && (
          <div className="eval-demo-alert">
            <i className="bi bi-info-circle-fill" style={{ fontSize: '1.2rem', flexShrink: 0 }}></i>
            <div>
              <strong>Modo Demo:</strong> Estos son ejemplos para mostrar como funciona el sistema. Crea tu primera evaluacion para comenzar.
            </div>
            <button className="btn btn-sm btn-link text-primary ms-auto p-0" onClick={() => setUsandoEjemplos(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        {/* ============ STAT CARDS ============ */}
        {stats && (
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="eval-stat-card eval-stat-green">
                <div className="eval-stat-icon"><i className="bi bi-clipboard-check"></i></div>
                <div>
                  <div className="eval-stat-value">{stats.total}</div>
                  <div className="eval-stat-label">Total Evaluaciones</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="eval-stat-card eval-stat-blue">
                <div className="eval-stat-icon"><i className="bi bi-star-fill"></i></div>
                <div>
                  <div className="eval-stat-value">{stats.promedioGeneral}<span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.6 }}>/5</span></div>
                  <div className="eval-stat-label">Promedio General</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="eval-stat-card eval-stat-amber">
                <div className="eval-stat-icon"><i className="bi bi-pencil-square"></i></div>
                <div>
                  <div className="eval-stat-value">{stats.porEstado?.borrador || 0}</div>
                  <div className="eval-stat-label">En Borrador</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="eval-stat-card eval-stat-cyan">
                <div className="eval-stat-icon"><i className="bi bi-check2-all"></i></div>
                <div>
                  <div className="eval-stat-value">{(stats.porEstado?.completada || 0) + (stats.porEstado?.revisada || 0)}</div>
                  <div className="eval-stat-label">Completadas</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ FILTER BAR ============ */}
        <div className="eval-filter-bar d-flex align-items-center gap-3 flex-wrap">
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#8b95a5' }}>
            <i className="bi bi-funnel me-1"></i> Filtros
          </span>
          <select className="form-select eval-filter-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador ({stats?.porEstado?.borrador || 0})</option>
            <option value="completada">Completada ({stats?.porEstado?.completada || 0})</option>
            <option value="revisada">Revisada ({stats?.porEstado?.revisada || 0})</option>
          </select>
          <select className="form-select eval-filter-select" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}>
            <option value="">Todos los departamentos</option>
            {stats?.departamentos?.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="ms-auto">
            <span className="eval-filter-count">
              <i className="bi bi-list-check"></i>
              {evalsFiltered.length} evaluaciones
            </span>
          </div>
        </div>

        {/* ============ EVAL GRID ============ */}
        {evalsFiltered.length === 0 ? (
          <div className="eval-empty-state">
            <i className="bi bi-clipboard-x"></i>
            <h5 style={{ color: '#495057', fontWeight: 700 }}>No hay evaluaciones</h5>
            <p className="text-muted">Comienza creando tu primera evaluacion de desempeno</p>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} style={{ borderRadius: '12px', padding: '10px 22px', fontWeight: 600 }}>
              <i className="bi bi-plus-circle me-2"></i>Crear Evaluacion
            </button>
          </div>
        ) : (
          <div className="row g-4">
            {evalsFiltered.map((eval_) => {
              const promedio = calcularPromedio(eval_.categorias);
              const calColor = getCalColor(promedio);
              const ringPct = `${(promedio / 5) * 100}%`;

              return (
                <div key={eval_.id} className="col-lg-6 col-xl-4">
                  <div className="eval-card">
                    <div className="eval-card-accent" style={{ background: getAccentColor(promedio) }}></div>
                    <div className="eval-card-body">
                      {/* Header */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-3">
                          <div className="eval-avatar">{eval_.empleadoNombre?.charAt(0) || '?'}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e' }}>{eval_.empleadoNombre}</div>
                            <div style={{ fontSize: '0.76rem', color: '#8b95a5' }}>{eval_.departamento}</div>
                          </div>
                        </div>
                        <div className="d-flex flex-column align-items-end gap-1">
                          <span className={`eval-estado-badge ${getEstadoBadgeClass(eval_.estado)}`}>
                            <i className={`bi ${getEstadoIcon(eval_.estado)}`} style={{ fontSize: '0.6rem' }}></i>
                            {getEstadoLabel(eval_.estado)}
                          </span>
                          {eval_.esEjemplo && <span className="eval-estado-badge eval-badge-demo">Demo</span>}
                        </div>
                      </div>

                      {/* Score Ring */}
                      <div className="text-center mb-3">
                        <div className="eval-score-ring" style={{ '--ring-color': calColor, '--ring-pct': ringPct, background: `${calColor}10` }}>
                          <span className="eval-score-value" style={{ color: calColor }}>{promedio.toFixed(1)}</span>
                          <span className="eval-score-max">/5</span>
                        </div>
                        <div className={`eval-cal-badge ${getCalBadgeClass(promedio)} mt-2`}>
                          {getCalLabel(promedio)}
                        </div>
                      </div>

                      {/* Category mini bars */}
                      <div className="mb-3">
                        {eval_.categorias?.slice(0, 4).map((cat, idx) => (
                          <div key={idx} className="eval-cat-row">
                            <span className="eval-cat-name">{cat.nombre}</span>
                            <div className="eval-cat-bar-wrap">
                              <div className="eval-cat-bar" style={{ width: `${(cat.calificacion / 5) * 100}%`, background: getCalColor(cat.calificacion) }}></div>
                            </div>
                            <div className="eval-cat-stars">
                              {[1, 2, 3, 4, 5].map(s => (
                                <i key={s} className={`bi ${s <= cat.calificacion ? 'bi-star-fill text-warning' : 'bi-star'}`} style={{ color: s <= cat.calificacion ? '#f59e0b' : '#d0d5dd' }}></i>
                              ))}
                            </div>
                          </div>
                        ))}
                        {eval_.categorias?.length > 4 && (
                          <div style={{ fontSize: '0.72rem', color: '#8b95a5' }}>+{eval_.categorias.length - 4} categorias mas...</div>
                        )}
                      </div>

                      {/* Info chips */}
                      <div className="d-flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #f0f2f5' }}>
                        <span className="eval-info-chip">
                          <i className="bi bi-calendar3"></i>
                          {eval_.periodo?.tipo || 'N/A'}
                        </span>
                        <span className="eval-info-chip">
                          <i className="bi bi-clock"></i>
                          {formatDate(eval_.fechaCreacion)}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="eval-card-footer">
                      <button className="btn btn-sm flex-grow-1" onClick={() => handleViewDetail(eval_)} style={{ background: '#f0f4ff', color: '#4361ee', fontWeight: 600, borderRadius: '10px', fontSize: '0.8rem' }}>
                        <i className="bi bi-eye me-1"></i>Ver Detalle
                      </button>
                      <button className="btn btn-sm" onClick={() => handleEdit(eval_)} title="Editar" style={{ background: '#f8f9fa', borderRadius: '10px', fontSize: '0.8rem' }}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      {eval_.estado === 'borrador' && (
                        <button className="btn btn-sm" onClick={() => handleDelete(eval_.id, eval_.esEjemplo)} title="Eliminar" style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '10px', fontSize: '0.8rem' }}>
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ MODAL CREAR/EDITAR ============ */}
        {showModal && (
          <div className="eval-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="eval-modal eval-modal-xl">
              <div className="eval-modal-header eval-modal-header-green">
                <h5>
                  <i className={`bi ${selectedEval ? 'bi-pencil-square' : 'bi-clipboard-plus'}`}></i>
                  {selectedEval ? 'Editar Evaluacion' : 'Nueva Evaluacion'}
                </h5>
                <button className="eval-modal-close" onClick={() => setShowModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="eval-modal-body">
                  <div className="row g-4">
                    {/* Left Column */}
                    <div className="col-lg-5">
                      <div className="eval-form-group-title">
                        <i className="bi bi-person"></i>
                        Informacion del Empleado
                      </div>

                      <div className="mb-3">
                        <label className="eval-form-label">Empleado *</label>
                        <select className="form-select" value={formData.empleadoUid} onChange={handleEmpleadoChange} required disabled={selectedEval}>
                          <option value="">Seleccionar empleado...</option>
                          {empleados.map((emp) => (
                            <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                              {emp.nombre} - {emp.departamento || 'Sin depto'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="row g-3 mb-3">
                        <div className="col-6">
                          <label className="eval-form-label">Tipo de Periodo</label>
                          <select className="form-select" value={formData.periodo.tipo} onChange={(e) => setFormData({ ...formData, periodo: { ...formData.periodo, tipo: e.target.value } })}>
                            <option value="mensual">Mensual</option>
                            <option value="trimestral">Trimestral</option>
                            <option value="semestral">Semestral</option>
                            <option value="anual">Anual</option>
                          </select>
                        </div>
                        <div className="col-6">
                          <label className="eval-form-label">Estado</label>
                          <select className="form-select" value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })}>
                            <option value="borrador">Borrador</option>
                            <option value="completada">Completada</option>
                            <option value="revisada">Revisada</option>
                          </select>
                        </div>
                      </div>

                      <div className="row g-3 mb-3">
                        <div className="col-6">
                          <label className="eval-form-label">Fecha Inicio</label>
                          <input type="date" className="form-control" value={formData.periodo.fechaInicio} onChange={(e) => setFormData({ ...formData, periodo: { ...formData.periodo, fechaInicio: e.target.value } })} />
                        </div>
                        <div className="col-6">
                          <label className="eval-form-label">Fecha Fin</label>
                          <input type="date" className="form-control" value={formData.periodo.fechaFin} onChange={(e) => setFormData({ ...formData, periodo: { ...formData.periodo, fechaFin: e.target.value } })} />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="eval-form-label">
                          <i className="bi bi-hand-thumbs-up text-success me-1"></i>
                          Fortalezas
                        </label>
                        <textarea className="form-control" rows="3" value={formData.fortalezas} onChange={(e) => setFormData({ ...formData, fortalezas: e.target.value })} placeholder="Aspectos positivos del empleado..."></textarea>
                      </div>

                      <div className="mb-3">
                        <label className="eval-form-label">
                          <i className="bi bi-arrow-up-circle text-warning me-1"></i>
                          Areas de Oportunidad
                        </label>
                        <textarea className="form-control" rows="3" value={formData.areasOportunidad} onChange={(e) => setFormData({ ...formData, areasOportunidad: e.target.value })} placeholder="Aspectos a mejorar..."></textarea>
                      </div>
                    </div>

                    {/* Right Column - Categories */}
                    <div className="col-lg-7">
                      <div className="eval-form-group-title">
                        <i className="bi bi-star"></i>
                        Calificacion por Categoria
                      </div>

                      {formData.categorias.map((cat, index) => {
                        const catColor = getCalColor(cat.calificacion);
                        return (
                          <div key={index} className="eval-cat-form-card">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="eval-cat-form-label">{cat.nombre}</span>
                              <span className="eval-cat-form-score" style={{ background: `${catColor}15`, color: catColor }}>
                                {cat.calificacion}/5
                              </span>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                              <div className="d-flex">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button key={star} type="button" className="eval-star-btn" onClick={() => handleCategoriaChange(index, 'calificacion', star)}>
                                    <i className={`bi ${star <= cat.calificacion ? 'bi-star-fill' : 'bi-star'}`}></i>
                                  </button>
                                ))}
                              </div>
                              <input type="text" className="form-control form-control-sm" placeholder="Comentarios..." value={cat.comentarios} onChange={(e) => handleCategoriaChange(index, 'comentarios', e.target.value)} style={{ flex: 1, borderRadius: '8px', fontSize: '0.82rem' }} />
                            </div>
                          </div>
                        );
                      })}

                      {/* Promedio Preview */}
                      <div className="eval-promedio-preview mt-3">
                        {(() => {
                          const prom = calcularPromedio(formData.categorias);
                          const promColor = getCalColor(prom);
                          return (
                            <>
                              <div style={{ fontSize: '0.72rem', color: '#8b95a5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Promedio Actual</div>
                              <div style={{ fontSize: '2rem', fontWeight: 800, color: promColor }}>{prom.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.5 }}>/ 5</span></div>
                              <span className={`eval-cal-badge ${getCalBadgeClass(prom)}`}>{getCalLabel(prom)}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="eval-modal-footer">
                  <button type="button" className="eval-modal-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="eval-modal-confirm" style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                    <i className="bi bi-check-circle me-2"></i>
                    {selectedEval ? 'Actualizar' : 'Guardar'} Evaluacion
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============ MODAL DETALLE ============ */}
        {showDetailModal && selectedEval && (
          <div className="eval-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
            <div className="eval-modal eval-modal-lg">
              <div className="eval-modal-header eval-modal-header-blue">
                <h5>
                  <i className="bi bi-clipboard-data"></i>
                  Detalle de Evaluacion
                </h5>
                <button className="eval-modal-close" onClick={() => setShowDetailModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="eval-modal-body">
                {/* Employee header */}
                <div className="d-flex align-items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <div className="eval-avatar-lg">{selectedEval.empleadoNombre?.charAt(0)}</div>
                  <div className="flex-grow-1">
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e' }}>{selectedEval.empleadoNombre}</div>
                    <div style={{ fontSize: '0.82rem', color: '#8b95a5' }}>{selectedEval.departamento}</div>
                  </div>
                  <div className="text-end">
                    <span className={`eval-estado-badge ${getEstadoBadgeClass(selectedEval.estado)}`} style={{ fontSize: '0.78rem', padding: '4px 12px' }}>
                      <i className={`bi ${getEstadoIcon(selectedEval.estado)}`}></i>
                      {getEstadoLabel(selectedEval.estado)}
                    </span>
                    <div className="d-flex gap-2 mt-2 justify-content-end">
                      <span className="eval-info-chip">
                        <i className="bi bi-calendar3"></i>
                        {selectedEval.periodo?.tipo}
                      </span>
                      <span className="eval-info-chip">
                        <i className="bi bi-clock"></i>
                        {formatDate(selectedEval.fechaCreacion)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score + Categories */}
                <div className="row g-4 mb-4">
                  <div className="col-md-4 text-center">
                    {(() => {
                      const prom = calcularPromedio(selectedEval.categorias);
                      const promColor = getCalColor(prom);
                      const ringPct = `${(prom / 5) * 100}%`;
                      return (
                        <>
                          <div className="eval-score-ring-lg" style={{ '--ring-color': promColor, '--ring-pct': ringPct, background: `${promColor}10` }}>
                            <span className="eval-score-value-lg" style={{ color: promColor }}>{prom.toFixed(1)}</span>
                            <span className="eval-score-max-lg">/5</span>
                          </div>
                          <div className={`eval-cal-badge ${getCalBadgeClass(prom)} mt-3`} style={{ fontSize: '0.82rem', padding: '4px 14px' }}>
                            {getCalLabel(prom)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#8b95a5', marginTop: '8px' }}>
                            Calificacion General
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="col-md-8">
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                      Calificacion por Categoria
                    </div>
                    {selectedEval.categorias?.map((cat, idx) => {
                      const catColor = getCalColor(cat.calificacion);
                      return (
                        <div key={idx}>
                          <div className="eval-detail-cat-row">
                            <span className="eval-detail-cat-name">{cat.nombre}</span>
                            <div className="eval-detail-cat-bar-wrap">
                              <div className="eval-detail-cat-bar" style={{ width: `${(cat.calificacion / 5) * 100}%`, background: `linear-gradient(90deg, ${catColor}, ${catColor}cc)` }}></div>
                            </div>
                            <div className="d-flex gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <i key={s} className={`bi ${s <= cat.calificacion ? 'bi-star-fill' : 'bi-star'}`} style={{ fontSize: '0.72rem', color: s <= cat.calificacion ? '#f59e0b' : '#d0d5dd' }}></i>
                              ))}
                            </div>
                            <span className="eval-detail-cat-score" style={{ color: catColor }}>{cat.calificacion}/5</span>
                          </div>
                          {cat.comentarios && (
                            <div className="eval-detail-comment">
                              <i className="bi bi-chat-text me-1"></i>{cat.comentarios}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fortalezas & Areas */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="eval-detail-box eval-fortalezas-box">
                      <div className="eval-detail-box-label">
                        <i className="bi bi-hand-thumbs-up me-1" style={{ color: '#16a34a' }}></i>
                        Fortalezas
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#1a1a2e' }}>
                        {selectedEval.fortalezas || 'No especificadas'}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="eval-detail-box eval-areas-box">
                      <div className="eval-detail-box-label">
                        <i className="bi bi-arrow-up-circle me-1" style={{ color: '#e8850c' }}></i>
                        Areas de Oportunidad
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#1a1a2e' }}>
                        {selectedEval.areasOportunidad || 'No especificadas'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="eval-modal-footer">
                <button className="eval-modal-cancel" onClick={() => setShowDetailModal(false)}>Cerrar</button>
                <button className="eval-modal-confirm" onClick={() => { setShowDetailModal(false); handleEdit(selectedEval); }} style={{ background: 'linear-gradient(135deg, #4361ee, #6366f1)' }}>
                  <i className="bi bi-pencil me-2"></i>Editar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}

export default Evaluaciones;
