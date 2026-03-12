import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';
import '../styles/Capacitacion.css';

// Datos de ejemplo para mostrar cuando no hay datos
const EJEMPLO_CAPACITACIONES = [
  {
    id: 'ejemplo-1',
    titulo: 'Excel Avanzado para Reportes',
    descripcion: 'Curso completo de Excel enfocado en tablas dinamicas, macros basicas y creacion de dashboards para reportes empresariales.',
    tipo: 'curso',
    proveedor: 'Interno',
    fechaInicio: '2026-02-01',
    fechaFin: '2026-02-15',
    duracionHoras: 20,
    departamentos: ['Todos'],
    obligatoria: false,
    participantes: [
      { uid: 'demo1', nombre: 'Maria Garcia', email: 'maria@ejemplo.com', estado: 'completada', calificacion: 95 },
      { uid: 'demo2', nombre: 'Juan Lopez', email: 'juan@ejemplo.com', estado: 'en_progreso', calificacion: null },
      { uid: 'demo3', nombre: 'Ana Martinez', email: 'ana@ejemplo.com', estado: 'inscrito', calificacion: null }
    ],
    esEjemplo: true
  },
  {
    id: 'ejemplo-2',
    titulo: 'Certificacion ISO 9001:2015',
    descripcion: 'Capacitacion obligatoria para conocer los estandares de calidad ISO 9001 y su aplicacion en los procesos internos de la empresa.',
    tipo: 'certificacion',
    proveedor: 'Externo',
    fechaInicio: '2026-02-10',
    fechaFin: '2026-02-12',
    duracionHoras: 16,
    departamentos: ['Operaciones', 'Calidad'],
    obligatoria: true,
    participantes: [
      { uid: 'demo4', nombre: 'Carlos Ruiz', email: 'carlos@ejemplo.com', estado: 'completada', calificacion: 88 },
      { uid: 'demo5', nombre: 'Laura Hernandez', email: 'laura@ejemplo.com', estado: 'completada', calificacion: 92 }
    ],
    esEjemplo: true
  },
  {
    id: 'ejemplo-3',
    titulo: 'Taller de Comunicacion Efectiva',
    descripcion: 'Taller practico para mejorar habilidades de comunicacion verbal y escrita en el ambiente laboral.',
    tipo: 'taller',
    proveedor: 'Interno',
    fechaInicio: '2026-03-01',
    fechaFin: '2026-03-01',
    duracionHoras: 4,
    departamentos: ['Recursos Humanos', 'Ventas'],
    obligatoria: false,
    participantes: [],
    esEjemplo: true
  }
];

function Capacitacion() {
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCap, setSelectedCap] = useState(null);
  const [stats, setStats] = useState(null);
  const [usandoEjemplos, setUsandoEjemplos] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null); // uid del participante siendo actualizado
  const userRole = sessionStorage.getItem('userRole') || 'empleado';
  const userDepartamento = sessionStorage.getItem('userDepartamento') || '';

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');

  // Para inscripcion
  const [selectedEmployeeToEnroll, setSelectedEmployeeToEnroll] = useState('');

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'curso',
    proveedor: 'Interno',
    fechaInicio: '',
    fechaFin: '',
    duracionHoras: 0,
    departamentos: ['Todos'],
    obligatoria: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async (keepSelectedCapId = null) => {
    if (!keepSelectedCapId) setLoading(true);
    try {
      const [capRes, usersRes] = await Promise.all([
        api.getTrainings({}),
        api.getUsers()
      ]);

      let capsData = capRes.data.data || [];
      setEmpleados(usersRes.data.data || []);

      if (capsData.length === 0) {
        capsData = EJEMPLO_CAPACITACIONES;
        setUsandoEjemplos(true);
      } else {
        setUsandoEjemplos(false);
      }

      setCapacitaciones(capsData);

      // Si hay un modal abierto, actualizar selectedCap con los datos frescos
      if (keepSelectedCapId) {
        const updatedCap = capsData.find(c => c.id === keepSelectedCapId);
        if (updatedCap) {
          setSelectedCap(updatedCap);
        }
      }

      // Calcular stats
      const statsCalc = {
        total: capsData.length,
        totalParticipantes: capsData.reduce((acc, c) => acc + (c.participantes?.length || 0), 0),
        participantesCompletados: capsData.reduce((acc, c) =>
          acc + (c.participantes?.filter(p => p.estado === 'completada').length || 0), 0),
        enProgreso: capsData.reduce((acc, c) =>
          acc + (c.participantes?.filter(p => p.estado === 'en_progreso').length || 0), 0),
        obligatorias: capsData.filter(c => c.obligatoria).length,
        porTipo: {
          curso: capsData.filter(c => c.tipo === 'curso').length,
          certificacion: capsData.filter(c => c.tipo === 'certificacion').length,
          taller: capsData.filter(c => c.tipo === 'taller').length
        }
      };
      setStats(statsCalc);

    } catch (err) {
      console.error('Error cargando datos:', err);
      setCapacitaciones(EJEMPLO_CAPACITACIONES);
      setUsandoEjemplos(true);
      setStats({
        total: 3,
        totalParticipantes: 5,
        participantesCompletados: 3,
        enProgreso: 1,
        obligatorias: 1,
        porTipo: { curso: 1, certificacion: 1, taller: 1 }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedCap && !selectedCap.esEjemplo) {
        await api.updateTraining(selectedCap.id, formData);
        showMessage('Capacitacion actualizada exitosamente', 'success');
      } else {
        await api.createTraining(formData);
        showMessage('Capacitacion creada exitosamente', 'success');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Error guardando capacitacion:', err);
      setError(err.response?.data?.message || 'Error al guardar la capacitacion');
    }
  };

  const handleEdit = (cap) => {
    if (cap.esEjemplo) {
      showMessage('Este es un ejemplo. Crea una capacitacion real para editarla.', 'warning');
      return;
    }
    setSelectedCap(cap);
    setFormData({
      titulo: cap.titulo,
      descripcion: cap.descripcion || '',
      tipo: cap.tipo,
      proveedor: cap.proveedor || 'Interno',
      fechaInicio: cap.fechaInicio || '',
      fechaFin: cap.fechaFin || '',
      duracionHoras: cap.duracionHoras || 0,
      departamentos: cap.departamentos || ['Todos'],
      obligatoria: cap.obligatoria || false
    });
    setShowModal(true);
  };

  const handleDelete = async (id, esEjemplo) => {
    if (esEjemplo) {
      showMessage('Los ejemplos no se pueden eliminar', 'warning');
      return;
    }
    const result = await Swal.fire({
      title: '¿Eliminar capacitación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      await api.deleteTraining(id);
      showMessage('Capacitacion eliminada', 'success');
      loadData();
    } catch (err) {
      console.error('Error eliminando capacitacion:', err);
      setError('Error al eliminar la capacitacion');
    }
  };

  const handleEnroll = async (trainingId, uid, esEjemplo) => {
    if (esEjemplo) {
      showMessage('Crea una capacitacion real para inscribir empleados', 'warning');
      setShowEnrollModal(false);
      setSelectedEmployeeToEnroll('');
      return;
    }
    try {
      await api.enrollEmployee(trainingId, uid);
      showMessage('Empleado inscrito exitosamente', 'success');
      await loadData(trainingId);
      setShowEnrollModal(false);
      setSelectedEmployeeToEnroll('');
    } catch (err) {
      console.error('Error inscribiendo empleado:', err);
      setError(err.response?.data?.message || 'Error al inscribir empleado');
    }
  };

  const handleUnenroll = async (trainingId, uid, esEjemplo) => {
    if (esEjemplo) return;
    const result = await Swal.fire({
      title: '¿Desinscribir empleado?',
      text: 'Se eliminará al empleado de esta capacitación',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, desinscribir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      await api.unenrollEmployee(trainingId, uid);
      showMessage('Empleado desinscrito', 'success');
      await loadData(trainingId);
    } catch (err) {
      console.error('Error desinscribiendo empleado:', err);
      setError('Error al desinscribir empleado');
    }
  };

  const handleUpdateStatus = async (trainingId, uid, estado, esEjemplo) => {
    if (esEjemplo) {
      showMessage('Los ejemplos no se pueden modificar', 'warning');
      return;
    }
    try {
      setUpdatingStatus(uid);
      let calificacion = null;
      if (estado === 'completada') {
        const cal = prompt('Calificacion (0-100):', '100');
        if (cal === null) {
          setUpdatingStatus(null);
          return; // usuario cancelo
        }
        calificacion = parseInt(cal) || 0;
      }
      await api.updateParticipantStatus(trainingId, uid, {
        estado,
        calificacion
      });
      showMessage('Estado actualizado correctamente', 'success');
      // Recargar datos y actualizar el selectedCap con datos frescos
      await loadData(trainingId);
    } catch (err) {
      console.error('Error actualizando estado:', err);
      setError('Error al actualizar estado');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const showMessage = (msg, type) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else if (type === 'warning') {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    } else {
      setError(msg);
    }
  };

  const resetForm = () => {
    setSelectedCap(null);
    setFormData({
      titulo: '',
      descripcion: '',
      tipo: 'curso',
      proveedor: 'Interno',
      fechaInicio: '',
      fechaFin: '',
      duracionHoras: 0,
      departamentos: ['Todos'],
      obligatoria: false
    });
  };

  const getTipoConfig = (tipo) => {
    const config = {
      curso: { badge: 'cap-badge-curso', icon: 'bi-book', label: 'Curso', color: '#4361ee' },
      certificacion: { badge: 'cap-badge-cert', icon: 'bi-award', label: 'Certificacion', color: '#7209b7' },
      taller: { badge: 'cap-badge-taller', icon: 'bi-tools', label: 'Taller', color: '#f77f00' }
    };
    return config[tipo] || config.curso;
  };

  const getEstadoConfig = (estado) => {
    const config = {
      inscrito: { badge: 'cap-estado-inscrito', icon: 'bi-person-plus', label: 'Inscrito', color: '#6c757d' },
      en_progreso: { badge: 'cap-estado-progreso', icon: 'bi-play-circle-fill', label: 'En Progreso', color: '#0077b6' },
      completada: { badge: 'cap-estado-completada', icon: 'bi-check-circle-fill', label: 'Completada', color: '#16a34a' },
      reprobada: { badge: 'cap-estado-reprobada', icon: 'bi-x-circle-fill', label: 'Reprobada', color: '#dc2626' }
    };
    return config[estado] || config.inscrito;
  };

  const getProgresoCapacitacion = (cap) => {
    if (!cap.participantes || cap.participantes.length === 0) return { completados: 0, enProgreso: 0, total: 0, porcentaje: 0 };
    const completados = cap.participantes.filter(p => p.estado === 'completada').length;
    const enProgreso = cap.participantes.filter(p => p.estado === 'en_progreso').length;
    const total = cap.participantes.length;
    return {
      completados,
      enProgreso,
      total,
      porcentaje: Math.round((completados / total) * 100)
    };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const fecha = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch { return dateStr; }
  };

  const getCapacitacionEstado = (cap) => {
    const hoy = new Date().toISOString().split('T')[0];
    if (!cap.fechaInicio) return { label: 'Sin fecha', color: '#6c757d', icon: 'bi-question-circle' };
    if (cap.fechaInicio > hoy) return { label: 'Proxima', color: '#f77f00', icon: 'bi-calendar-event' };
    if (cap.fechaFin && cap.fechaFin < hoy) return { label: 'Finalizada', color: '#6c757d', icon: 'bi-calendar-check' };
    return { label: 'En curso', color: '#0077b6', icon: 'bi-broadcast' };
  };

  const filtrarCapacitaciones = () => {
    return capacitaciones.filter(cap => {
      if (userRole === 'admin_area' && userDepartamento) {
        const deptos = cap.departamentos || ['Todos'];
        if (!deptos.includes('Todos') && !deptos.includes(userDepartamento)) return false;
      }
      if (filtroDepartamento) {
        const deptos = cap.departamentos || ['Todos'];
        if (!deptos.includes('Todos') && !deptos.includes(filtroDepartamento)) return false;
      }
      if (filtroTipo && cap.tipo !== filtroTipo) return false;
      if (filtroEstado === 'activa') {
        const hoy = new Date().toISOString().split('T')[0];
        if (cap.fechaFin && cap.fechaFin < hoy) return false;
      }
      if (filtroEstado === 'finalizada') {
        const hoy = new Date().toISOString().split('T')[0];
        if (!cap.fechaFin || cap.fechaFin >= hoy) return false;
      }
      return true;
    });
  };

  const getDepartamentosUnicos = () => {
    const deptos = new Set();
    capacitaciones.forEach(cap => {
      (cap.departamentos || []).forEach(d => { if (d !== 'Todos') deptos.add(d); });
    });
    return Array.from(deptos);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-muted">Cargando capacitaciones...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="capacitacion-container">
        {/* Header */}
        <div className="cap-page-header mb-4">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h2 className="mb-1 fw-bold">
                <i className="bi bi-mortarboard-fill me-2" style={{ color: '#4361ee' }}></i>
                Gestion de Capacitacion
              </h2>
              <p className="text-muted mb-0">Administra cursos, certificaciones y talleres</p>
            </div>
            <div className="col-md-6 text-md-end mt-3 mt-md-0">
              {userRole === 'admin_rh' && (
                <button
                  className="btn btn-primary btn-lg shadow-sm"
                  style={{ borderRadius: '12px' }}
                  onClick={() => { resetForm(); setShowModal(true); }}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Nueva Capacitacion
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Alertas */}
        {usandoEjemplos && (
          <div className="alert alert-info alert-dismissible fade show d-flex align-items-center" style={{ borderRadius: '12px' }}>
            <i className="bi bi-info-circle-fill me-2 fs-5"></i>
            <div>
              <strong>Modo Demo:</strong> Estos son ejemplos para mostrar como funciona el sistema.
              Crea tu primera capacitacion para comenzar.
            </div>
            <button type="button" className="btn-close" onClick={() => setUsandoEjemplos(false)}></button>
          </div>
        )}

        {error && (
          <div className="alert alert-warning alert-dismissible fade show d-flex align-items-center" style={{ borderRadius: '12px' }}>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show d-flex align-items-center" style={{ borderRadius: '12px' }}>
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMsg}
            <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="row g-3 mb-4">
            {[
              { label: 'Capacitaciones', value: stats.total, icon: 'bi-collection-fill', gradient: 'cap-stat-blue' },
              { label: 'Participantes', value: stats.totalParticipantes, icon: 'bi-people-fill', gradient: 'cap-stat-cyan' },
              { label: 'En Progreso', value: stats.enProgreso, icon: 'bi-play-circle-fill', gradient: 'cap-stat-amber' },
              { label: 'Completados', value: stats.participantesCompletados, icon: 'bi-patch-check-fill', gradient: 'cap-stat-green' }
            ].map((s, i) => (
              <div key={i} className="col-6 col-lg-3">
                <div className={`cap-stat-card ${s.gradient}`}>
                  <div className="cap-stat-icon-wrap">
                    <i className={`bi ${s.icon}`}></i>
                  </div>
                  <div className="cap-stat-info">
                    <div className="cap-stat-value">{s.value}</div>
                    <div className="cap-stat-label">{s.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="cap-filter-bar mb-4">
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <span className="text-muted fw-medium"><i className="bi bi-funnel me-1"></i> Filtros:</span>
            <select className="form-select form-select-sm cap-filter-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="curso">Cursos</option>
              <option value="certificacion">Certificaciones</option>
              <option value="taller">Talleres</option>
            </select>
            <select className="form-select form-select-sm cap-filter-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Estado</option>
              <option value="activa">Activas</option>
              <option value="finalizada">Finalizadas</option>
            </select>
            {userRole === 'admin_rh' && (
              <select className="form-select form-select-sm cap-filter-select" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}>
                <option value="">Todos los departamentos</option>
                {getDepartamentosUnicos().map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            )}
            {userRole === 'admin_area' && userDepartamento && (
              <span className="badge rounded-pill" style={{ background: '#4361ee', padding: '6px 14px' }}>
                <i className="bi bi-building me-1"></i>{userDepartamento}
              </span>
            )}
            <span className="ms-auto badge bg-light text-dark" style={{ fontSize: '0.8rem' }}>
              {filtrarCapacitaciones().length} resultados
            </span>
          </div>
        </div>

        {/* Grid de Capacitaciones */}
        {filtrarCapacitaciones().length === 0 ? (
          <div className="cap-empty-state">
            <i className="bi bi-mortarboard"></i>
            <h5>No hay capacitaciones registradas</h5>
            <p className="text-muted">Comienza creando tu primera capacitacion</p>
            {userRole === 'admin_rh' && (
              <button className="btn btn-primary" style={{ borderRadius: '10px' }} onClick={() => { resetForm(); setShowModal(true); }}>
                <i className="bi bi-plus-circle me-2"></i>Crear Capacitacion
              </button>
            )}
          </div>
        ) : (
          <div className="row g-4">
            {filtrarCapacitaciones().map((cap) => {
              const tipoConfig = getTipoConfig(cap.tipo);
              const progreso = getProgresoCapacitacion(cap);
              const capEstado = getCapacitacionEstado(cap);

              return (
                <div key={cap.id} className="col-lg-6 col-xl-4">
                  <div className={`cap-admin-card ${cap.esEjemplo ? 'cap-card-demo' : ''}`}>
                    {/* Accent bar */}
                    <div className="cap-admin-accent" style={{ background: `linear-gradient(90deg, ${tipoConfig.color}, ${tipoConfig.color}88)` }}></div>

                    <div className="cap-admin-card-body">
                      {/* Row 1: badges + actions */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex gap-2 flex-wrap">
                          <span className={`cap-type-badge ${tipoConfig.badge}`}>
                            <i className={`bi ${tipoConfig.icon} me-1`}></i>
                            {tipoConfig.label}
                          </span>
                          <span className="cap-status-pill" style={{ color: capEstado.color, background: `${capEstado.color}15` }}>
                            <i className={`bi ${capEstado.icon} me-1`}></i>
                            {capEstado.label}
                          </span>
                          {cap.obligatoria && (
                            <span className="cap-type-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>Obligatoria
                            </span>
                          )}
                          {cap.esEjemplo && (
                            <span className="cap-type-badge" style={{ background: '#e0f2fe', color: '#0077b6' }}>Demo</span>
                          )}
                        </div>
                        {userRole === 'admin_rh' && (
                          <div className="dropdown">
                            <button className="btn btn-sm btn-light border-0" data-bs-toggle="dropdown" style={{ borderRadius: '8px' }}>
                              <i className="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end shadow-sm" style={{ borderRadius: '10px' }}>
                              <li>
                                <button className="dropdown-item" onClick={() => handleEdit(cap)}>
                                  <i className="bi bi-pencil me-2 text-primary"></i>Editar
                                </button>
                              </li>
                              <li><hr className="dropdown-divider" /></li>
                              <li>
                                <button className="dropdown-item text-danger" onClick={() => handleDelete(cap.id, cap.esEjemplo)}>
                                  <i className="bi bi-trash me-2"></i>Eliminar
                                </button>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h5 className="fw-bold mb-1" style={{ fontSize: '1.05rem', color: '#1a1a2e' }}>{cap.titulo}</h5>
                      <p className="text-muted small mb-3" style={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '36px'
                      }}>
                        {cap.descripcion || 'Sin descripcion'}
                      </p>

                      {/* Info chips */}
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <span className="cap-info-chip">
                          <i className="bi bi-calendar3"></i> {formatDate(cap.fechaInicio)}
                        </span>
                        <span className="cap-info-chip">
                          <i className="bi bi-clock"></i> {cap.duracionHoras || 0}h
                        </span>
                        <span className="cap-info-chip">
                          <i className="bi bi-building"></i> {(cap.departamentos || ['Todos']).join(', ')}
                        </span>
                      </div>

                      {/* Progress - Stacked bar */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <small className="text-muted fw-medium">Avance de participantes</small>
                          <small className="fw-bold" style={{ color: progreso.porcentaje === 100 ? '#16a34a' : '#4361ee' }}>
                            {progreso.completados}/{progreso.total}
                          </small>
                        </div>
                        <div className="cap-stacked-bar">
                          {progreso.total > 0 && (
                            <>
                              <div className="cap-bar-completados" style={{ width: `${(progreso.completados / progreso.total) * 100}%` }}></div>
                              <div className="cap-bar-progreso" style={{ width: `${(progreso.enProgreso / progreso.total) * 100}%` }}></div>
                            </>
                          )}
                        </div>
                        {progreso.total > 0 && (
                          <div className="d-flex gap-3 mt-1">
                            <small style={{ color: '#16a34a' }}><span className="cap-legend-dot" style={{ background: '#16a34a' }}></span> {progreso.completados} completados</small>
                            <small style={{ color: '#0077b6' }}><span className="cap-legend-dot" style={{ background: '#0077b6' }}></span> {progreso.enProgreso} en progreso</small>
                            <small style={{ color: '#6c757d' }}><span className="cap-legend-dot" style={{ background: '#dee2e6' }}></span> {progreso.total - progreso.completados - progreso.enProgreso} pendientes</small>
                          </div>
                        )}
                      </div>

                      {/* Participantes preview */}
                      <div className="cap-participants-preview">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <small className="text-muted fw-bold">
                            <i className="bi bi-people me-1"></i> Participantes
                          </small>
                          <span className="badge bg-light text-dark" style={{ fontSize: '0.7rem' }}>
                            {cap.participantes?.length || 0}
                          </span>
                        </div>
                        {cap.participantes && cap.participantes.length > 0 ? (
                          <div className="cap-participant-list">
                            {cap.participantes.slice(0, 3).map((p, idx) => {
                              const ec = getEstadoConfig(p.estado);
                              return (
                                <div key={idx} className="cap-participant-row">
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="cap-avatar">{p.nombre?.charAt(0) || '?'}</div>
                                    <div>
                                      <div className="fw-medium" style={{ fontSize: '0.85rem' }}>{p.nombre}</div>
                                      <span className={`cap-mini-badge ${ec.badge}`}>
                                        <i className={`bi ${ec.icon}`}></i> {ec.label}
                                      </span>
                                    </div>
                                  </div>
                                  {p.calificacion != null && (
                                    <span className="cap-cal-badge" style={{
                                      background: p.calificacion >= 70 ? '#dcfce7' : '#fee2e2',
                                      color: p.calificacion >= 70 ? '#16a34a' : '#dc2626'
                                    }}>
                                      {p.calificacion}%
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {cap.participantes.length > 3 && (
                              <div className="text-center py-1">
                                <small className="text-muted">+{cap.participantes.length - 3} mas</small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-3" style={{ background: '#fafbfc', borderRadius: '8px' }}>
                            <i className="bi bi-person-plus text-muted"></i>
                            <small className="d-block text-muted">Sin participantes</small>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="cap-admin-card-footer">
                      <button
                        className="btn btn-sm btn-outline-primary flex-grow-1"
                        style={{ borderRadius: '8px' }}
                        onClick={() => { setSelectedCap(cap); setShowDetailModal(true); }}
                      >
                        <i className="bi bi-eye me-1"></i> Ver Detalles
                      </button>
                      <button
                        className="btn btn-sm btn-outline-success"
                        style={{ borderRadius: '8px' }}
                        onClick={() => { setSelectedCap(cap); setShowEnrollModal(true); }}
                        title="Inscribir empleado"
                      >
                        <i className="bi bi-person-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Crear/Editar */}
        {showModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowModal(false)}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div className="modal-header text-white" style={{ background: 'linear-gradient(135deg, #4361ee, #3a4ed4)' }}>
                  <h5 className="modal-title">
                    <i className={`bi ${selectedCap ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
                    {selectedCap ? 'Editar Capacitacion' : 'Nueva Capacitacion'}
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body p-4">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-bold">Titulo *</label>
                        <input type="text" className="form-control form-control-lg" style={{ borderRadius: '10px' }}
                          value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                          placeholder="Ej: Excel Avanzado para Reportes" required />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-bold">Descripcion</label>
                        <textarea className="form-control" rows="3" style={{ borderRadius: '10px' }}
                          value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                          placeholder="Describe el contenido y objetivos..." />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Tipo</label>
                        <select className="form-select" style={{ borderRadius: '10px' }}
                          value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                          <option value="curso">Curso</option>
                          <option value="certificacion">Certificacion</option>
                          <option value="taller">Taller</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Proveedor</label>
                        <select className="form-select" style={{ borderRadius: '10px' }}
                          value={formData.proveedor} onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}>
                          <option value="Interno">Interno</option>
                          <option value="Externo">Externo</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Duracion (horas)</label>
                        <input type="number" className="form-control" style={{ borderRadius: '10px' }}
                          value={formData.duracionHoras} onChange={(e) => setFormData({ ...formData, duracionHoras: parseInt(e.target.value) || 0 })} min="0" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Fecha Inicio</label>
                        <input type="date" className="form-control" style={{ borderRadius: '10px' }}
                          value={formData.fechaInicio} onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Fecha Fin</label>
                        <input type="date" className="form-control" style={{ borderRadius: '10px' }}
                          value={formData.fechaFin} onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })} />
                      </div>
                      <div className="col-12">
                        <div className="form-check form-switch">
                          <input type="checkbox" className="form-check-input" id="obligatoria"
                            checked={formData.obligatoria} onChange={(e) => setFormData({ ...formData, obligatoria: e.target.checked })} />
                          <label className="form-check-label fw-bold" htmlFor="obligatoria">
                            <i className="bi bi-exclamation-triangle text-danger me-1"></i>
                            Capacitacion obligatoria
                          </label>
                          <small className="d-block text-muted">Los empleados deberan completar esta capacitacion</small>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 px-4 pb-4">
                    <button type="button" className="btn btn-light px-4" style={{ borderRadius: '10px' }} onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary px-4" style={{ borderRadius: '10px' }}>
                      <i className="bi bi-check-lg me-2"></i>
                      {selectedCap ? 'Actualizar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal Inscribir */}
        {showEnrollModal && selectedCap && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => { setShowEnrollModal(false); setSelectedEmployeeToEnroll(''); }}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div className="modal-header text-white" style={{ background: 'linear-gradient(135deg, #198754, #15753e)' }}>
                  <h5 className="modal-title">
                    <i className="bi bi-person-plus me-2"></i>
                    Inscribir Empleado
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => { setShowEnrollModal(false); setSelectedEmployeeToEnroll(''); }}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="p-3 mb-3" style={{ background: '#f0f4ff', borderRadius: '10px', borderLeft: '4px solid #4361ee' }}>
                    <strong>{selectedCap.titulo}</strong>
                    <br />
                    <small className="text-muted">{selectedCap.participantes?.length || 0} participantes actuales</small>
                  </div>
                  <label className="form-label fw-bold">Seleccionar Empleado</label>
                  <select className="form-select form-select-lg" style={{ borderRadius: '10px' }}
                    value={selectedEmployeeToEnroll} onChange={(e) => setSelectedEmployeeToEnroll(e.target.value)}>
                    <option value="">-- Seleccionar empleado --</option>
                    {empleados
                      .filter(emp => !selectedCap.participantes?.some(p => p.uid === (emp.uid || emp.id)))
                      .map((emp) => (
                        <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                          {emp.nombre} - {emp.departamento || 'Sin departamento'}
                        </option>
                      ))}
                  </select>
                  {empleados.filter(emp => !selectedCap.participantes?.some(p => p.uid === (emp.uid || emp.id))).length === 0 && (
                    <small className="text-muted d-block mt-2">Todos los empleados ya estan inscritos</small>
                  )}
                </div>
                <div className="modal-footer border-0 px-4 pb-4">
                  <button type="button" className="btn btn-light px-4" style={{ borderRadius: '10px' }}
                    onClick={() => { setShowEnrollModal(false); setSelectedEmployeeToEnroll(''); }}>Cancelar</button>
                  <button type="button" className="btn btn-success px-4" style={{ borderRadius: '10px' }}
                    disabled={!selectedEmployeeToEnroll}
                    onClick={() => { if (selectedEmployeeToEnroll) handleEnroll(selectedCap.id, selectedEmployeeToEnroll, selectedCap.esEjemplo); }}>
                    <i className="bi bi-check-lg me-2"></i>Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Detalles - Mejorado */}
        {showDetailModal && selectedCap && (() => {
          const tipoConfig = getTipoConfig(selectedCap.tipo);
          const capEstado = getCapacitacionEstado(selectedCap);
          const progreso = getProgresoCapacitacion(selectedCap);

          return (
            <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowDetailModal(false)}>
              <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                  {/* Header con gradiente */}
                  <div style={{
                    background: `linear-gradient(135deg, ${tipoConfig.color} 0%, ${tipoConfig.color}cc 100%)`,
                    padding: '24px 28px', color: 'white', position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)', pointerEvents: 'none' }}></div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="d-flex gap-2 flex-wrap mb-2">
                          <span className="badge bg-white bg-opacity-25 text-white">
                            <i className={`bi ${tipoConfig.icon} me-1`}></i>{tipoConfig.label}
                          </span>
                          <span className="badge bg-white bg-opacity-25 text-white">
                            <i className={`bi ${capEstado.icon} me-1`}></i>{capEstado.label}
                          </span>
                          {selectedCap.obligatoria && (
                            <span className="badge bg-danger">
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>Obligatoria
                            </span>
                          )}
                        </div>
                        <button type="button" className="btn btn-sm text-white border-0"
                          style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => setShowDetailModal(false)}>
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                      <h4 className="fw-bold mb-1 mt-1">{selectedCap.titulo}</h4>
                      {selectedCap.proveedor && (
                        <small className="opacity-75"><i className="bi bi-building me-1"></i>{selectedCap.proveedor}</small>
                      )}
                    </div>
                  </div>

                  <div className="modal-body p-4">
                    {/* Descripcion */}
                    {selectedCap.descripcion && (
                      <p className="text-muted mb-4" style={{ lineHeight: '1.6' }}>{selectedCap.descripcion}</p>
                    )}

                    {/* Info cards */}
                    <div className="row g-3 mb-4">
                      {[
                        { icon: 'bi-calendar3', color: '#4361ee', label: 'Inicio', value: formatDate(selectedCap.fechaInicio) },
                        { icon: 'bi-calendar-check', color: '#e63946', label: 'Fin', value: formatDate(selectedCap.fechaFin) },
                        { icon: 'bi-clock-history', color: '#f77f00', label: 'Duracion', value: `${selectedCap.duracionHoras || 0} hrs` },
                        { icon: 'bi-diagram-3', color: '#7209b7', label: 'Departamentos', value: (selectedCap.departamentos || ['Todos']).join(', ') }
                      ].map((item, i) => (
                        <div key={i} className="col-6 col-md-3">
                          <div className="cap-detail-box-admin">
                            <div style={{ color: item.color, fontSize: '1.3rem', marginBottom: '4px' }}>
                              <i className={`bi ${item.icon}`}></i>
                            </div>
                            <div className="cap-detail-box-label">{item.label}</div>
                            <div className="cap-detail-box-value">{item.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Progreso resumen */}
                    {progreso.total > 0 && (
                      <div className="cap-progress-summary mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0 fw-bold"><i className="bi bi-graph-up me-2"></i>Avance General</h6>
                          <span className="badge rounded-pill" style={{ background: tipoConfig.color, fontSize: '0.85rem' }}>
                            {progreso.porcentaje}%
                          </span>
                        </div>
                        <div className="cap-stacked-bar" style={{ height: '12px' }}>
                          <div className="cap-bar-completados" style={{ width: `${(progreso.completados / progreso.total) * 100}%` }}></div>
                          <div className="cap-bar-progreso" style={{ width: `${(progreso.enProgreso / progreso.total) * 100}%` }}></div>
                        </div>
                        <div className="d-flex gap-4 mt-2">
                          <small><span className="cap-legend-dot" style={{ background: '#16a34a' }}></span> {progreso.completados} completados</small>
                          <small><span className="cap-legend-dot" style={{ background: '#0077b6' }}></span> {progreso.enProgreso} en progreso</small>
                          <small><span className="cap-legend-dot" style={{ background: '#dee2e6' }}></span> {progreso.total - progreso.completados - progreso.enProgreso} pendientes</small>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Participantes */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0 fw-bold">
                        <i className="bi bi-people me-2"></i>
                        Participantes ({selectedCap.participantes?.length || 0})
                      </h6>
                      <button className="btn btn-sm btn-success" style={{ borderRadius: '8px' }}
                        onClick={() => { setShowDetailModal(false); setTimeout(() => setShowEnrollModal(true), 200); }}>
                        <i className="bi bi-person-plus me-1"></i>Inscribir
                      </button>
                    </div>

                    {selectedCap.participantes && selectedCap.participantes.length > 0 ? (
                      <div className="cap-participants-table">
                        {selectedCap.participantes.map((p, idx) => {
                          const ec = getEstadoConfig(p.estado);
                          const isUpdating = updatingStatus === p.uid;
                          return (
                            <div key={idx} className="cap-participant-detail-row">
                              <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ minWidth: 0 }}>
                                <div className="cap-avatar-lg">{p.nombre?.charAt(0) || '?'}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.9rem' }}>{p.nombre}</div>
                                  <small className="text-muted">{p.email}</small>
                                </div>
                              </div>

                              {/* Estado badge */}
                              <div className="d-flex align-items-center gap-2">
                                <span className={`cap-estado-badge-lg ${ec.badge}`}>
                                  <i className={`bi ${ec.icon} me-1`}></i>
                                  {ec.label}
                                </span>

                                {/* Calificacion */}
                                {p.calificacion != null && (
                                  <span className="cap-cal-badge-lg" style={{
                                    background: p.calificacion >= 70 ? '#dcfce7' : '#fee2e2',
                                    color: p.calificacion >= 70 ? '#16a34a' : '#dc2626'
                                  }}>
                                    <i className={`bi ${p.calificacion >= 70 ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                                    {p.calificacion}%
                                  </span>
                                )}
                              </div>

                              {/* Acciones */}
                              <div className="d-flex align-items-center gap-1">
                                {isUpdating ? (
                                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                                    <span className="visually-hidden">Actualizando...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="dropdown">
                                      <button className="btn btn-sm btn-outline-primary" data-bs-toggle="dropdown"
                                        style={{ borderRadius: '8px', fontSize: '0.78rem' }}
                                        disabled={selectedCap.esEjemplo}>
                                        <i className="bi bi-arrow-repeat me-1"></i>Cambiar Estado
                                      </button>
                                      <ul className="dropdown-menu shadow-sm" style={{ borderRadius: '10px' }}>
                                        {['inscrito', 'en_progreso', 'completada', 'reprobada'].map(estado => {
                                          const conf = getEstadoConfig(estado);
                                          const isActive = p.estado === estado;
                                          return (
                                            <li key={estado}>
                                              <button
                                                className={`dropdown-item d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                                                disabled={isActive}
                                                onClick={() => handleUpdateStatus(selectedCap.id, p.uid, estado, selectedCap.esEjemplo)}
                                              >
                                                <i className={`bi ${conf.icon}`} style={{ color: isActive ? 'inherit' : conf.color }}></i>
                                                {conf.label}
                                                {isActive && <i className="bi bi-check2 ms-auto"></i>}
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                    {(p.estado || 'inscrito') !== 'completada' && p.estado !== 'reprobada' && (
                                      <button className="btn btn-sm btn-outline-danger" style={{ borderRadius: '8px' }}
                                        onClick={() => handleUnenroll(selectedCap.id, p.uid, selectedCap.esEjemplo)}
                                        title="Desinscribir" disabled={selectedCap.esEjemplo}>
                                        <i className="bi bi-person-x"></i>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-5" style={{ background: '#fafbfc', borderRadius: '12px' }}>
                        <i className="bi bi-person-plus display-4 text-muted"></i>
                        <p className="text-muted mt-2">No hay participantes inscritos</p>
                        <button className="btn btn-sm btn-success" style={{ borderRadius: '8px' }}
                          onClick={() => { setShowDetailModal(false); setTimeout(() => setShowEnrollModal(true), 200); }}>
                          <i className="bi bi-person-plus me-1"></i>Inscribir primer empleado
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0">
                    <button type="button" className="btn btn-secondary px-4" style={{ borderRadius: '10px' }}
                      onClick={() => setShowDetailModal(false)}>
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </AdminLayout>
  );
}

export default Capacitacion;
