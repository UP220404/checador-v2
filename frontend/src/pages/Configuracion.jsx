import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'sonner';
import { api } from '../services/api';
import '../styles/Configuracion.css';

function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('empresa');
  const [settings, setSettings] = useState({
    ausencias: { tipos: [] },
    nomina: {},
    horarios: {},
    departamentos: { lista: [] },
    empresa: {},
    seguridad: {},
    notificaciones: {}
  });

  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  const [showModalTipo, setShowModalTipo] = useState(false);
  const [showModalDepartamento, setShowModalDepartamento] = useState(false);
  const [showModalHorario, setShowModalHorario] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);

  const [formTipo, setFormTipo] = useState({ id: '', nombre: '', requiereAprobacion: true, diasMaximos: 0, color: '#28a745' });
  const [formDepartamento, setFormDepartamento] = useState({ nombre: '', responsable: '', ubicacion: '' });
  const [formNomina, setFormNomina] = useState({});
  const [formHorarios, setFormHorarios] = useState({});
  const [formEmpresa, setFormEmpresa] = useState({});
  const [formSeguridad, setFormSeguridad] = useState({});
  const [formNotificaciones, setFormNotificaciones] = useState({});
  const [formHorarioNuevo, setFormHorarioNuevo] = useState({ nombre: '', entrada: '09:00', salida: '18:00', tolerancia: 15 });

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      setLoading(true);
      const response = await api.getAllSettings();
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        setFormNomina(data.nomina || {});
        setFormHorarios(data.horarios || {});
        setFormEmpresa(data.empresa || { nombre: 'Cielito Home', rfc: '', direccion: '', telefono: '', email: '', logo: '' });
        setFormSeguridad(data.seguridad || { sesionMaxima: 8, intentosLogin: 5, requerirCambioPassword: false, diasCambioPassword: 90 });
        setFormNotificaciones(data.notificaciones || { emailAprobaciones: true, emailRechazo: true, emailNomina: true, emailCumpleanos: false, pushNotificaciones: true });
      }
    } catch (error) {
      console.error('Error cargando configuracion:', error);
      showToast('Error al cargar la configuracion', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============ HANDLERS ============
  const handleGuardarEmpresa = async () => {
    try {
      const response = await api.updateSettings('empresa', formEmpresa);
      if (response.data.success) { showToast('Datos de empresa guardados', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error guardando empresa:', error); showToast('Error al guardar', 'error'); }
  };

  const handleAgregarTipo = async () => {
    if (!formTipo.id || !formTipo.nombre) { showToast('ID y nombre son requeridos', 'warning'); return; }
    try {
      const response = await api.addAbsenceType(formTipo);
      if (response.data.success) {
        showToast('Tipo de ausencia agregado correctamente', 'success');
        setShowModalTipo(false);
        setFormTipo({ id: '', nombre: '', requiereAprobacion: true, diasMaximos: 0, color: '#28a745' });
        setEditingTipo(null);
        cargarConfiguracion();
      }
    } catch (error) { console.error('Error agregando tipo:', error); showToast(error.response?.data?.message || 'Error al agregar tipo', 'error'); }
  };

  const handleEditarTipo = (tipo) => {
    setEditingTipo(tipo);
    setFormTipo({ id: tipo.id, nombre: tipo.nombre, requiereAprobacion: tipo.requiereAprobacion !== false, diasMaximos: tipo.diasMaximos || 0, color: tipo.color || '#28a745' });
    setShowModalTipo(true);
  };

  const handleToggleTipo = async (typeId, activo) => {
    try {
      const response = await api.updateAbsenceType(typeId, { activo: !activo });
      if (response.data.success) { showToast(`Tipo de ausencia ${!activo ? 'activado' : 'desactivado'}`, 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error actualizando tipo:', error); showToast('Error al actualizar tipo', 'error'); }
  };

  const handleGuardarNomina = async () => {
    try {
      const response = await api.updateSettings('nomina', formNomina);
      if (response.data.success) { showToast('Configuracion de nomina guardada', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error guardando nomina:', error); showToast('Error al guardar configuracion', 'error'); }
  };

  const handleGuardarHorarios = async () => {
    try {
      const response = await api.updateSettings('horarios', formHorarios);
      if (response.data.success) { showToast('Configuracion de horarios guardada', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error guardando horarios:', error); showToast('Error al guardar configuracion', 'error'); }
  };

  const handleAgregarHorario = () => {
    const nuevosHorarios = [...(formHorarios.turnos || []), formHorarioNuevo];
    setFormHorarios({ ...formHorarios, turnos: nuevosHorarios });
    setFormHorarioNuevo({ nombre: '', entrada: '09:00', salida: '18:00', tolerancia: 15 });
    setShowModalHorario(false);
    showToast('Turno agregado. Guarda los cambios para confirmar.', 'info');
  };

  const handleEliminarHorario = (index) => {
    const nuevos = formHorarios.turnos.filter((_, i) => i !== index);
    setFormHorarios({ ...formHorarios, turnos: nuevos });
    showToast('Turno eliminado. Guarda los cambios para confirmar.', 'info');
  };

  const handleAgregarDepartamento = async () => {
    if (!formDepartamento.nombre.trim()) { showToast('Nombre del departamento es requerido', 'warning'); return; }
    try {
      const response = await api.addDepartment(formDepartamento.nombre.trim());
      if (response.data.success) {
        showToast('Departamento agregado correctamente', 'success');
        setShowModalDepartamento(false);
        setFormDepartamento({ nombre: '', responsable: '', ubicacion: '' });
        cargarConfiguracion();
      }
    } catch (error) { console.error('Error agregando departamento:', error); showToast(error.response?.data?.message || 'Error al agregar departamento', 'error'); }
  };

  const handleEliminarDepartamento = async (nombre) => {
    if (!confirm(`¿Eliminar el departamento "${nombre}"? Los empleados asignados quedaran sin departamento.`)) return;
    try {
      const response = await api.removeDepartment(nombre);
      if (response.data.success) { showToast('Departamento eliminado', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error eliminando departamento:', error); showToast('Error al eliminar departamento', 'error'); }
  };

  const handleGuardarSeguridad = async () => {
    try {
      const response = await api.updateSettings('seguridad', formSeguridad);
      if (response.data.success) { showToast('Configuracion de seguridad guardada', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error guardando seguridad:', error); showToast('Error al guardar', 'error'); }
  };

  const handleGuardarNotificaciones = async () => {
    try {
      const response = await api.updateSettings('notificaciones', formNotificaciones);
      if (response.data.success) { showToast('Configuracion de notificaciones guardada', 'success'); cargarConfiguracion(); }
    } catch (error) { console.error('Error guardando notificaciones:', error); showToast('Error al guardar', 'error'); }
  };

  // ============ NAV CONFIG ============
  const secciones = [
    { id: 'empresa', icon: 'bi-building', label: 'Empresa', desc: 'Datos corporativos' },
    { id: 'departamentos', icon: 'bi-diagram-3', label: 'Departamentos', desc: 'Areas de trabajo' },
    { id: 'horarios', icon: 'bi-clock', label: 'Horarios', desc: 'Turnos y registro' },
    { id: 'ausencias', icon: 'bi-calendar-x', label: 'Ausencias', desc: 'Tipos de permisos' },
    { id: 'nomina', icon: 'bi-cash-coin', label: 'Nomina', desc: 'Parametros de pago' },
    { id: 'seguridad', icon: 'bi-shield-lock', label: 'Seguridad', desc: 'Acceso y sesiones' },
    { id: 'notificaciones', icon: 'bi-bell', label: 'Notificaciones', desc: 'Alertas y avisos' }
  ];

  // ============ HELPER: count configured items ============
  const countConfigured = () => {
    let count = 0;
    if (formEmpresa.nombre) count++;
    if ((settings.departamentos?.lista || []).length > 0) count++;
    if (formHorarios.horaLimiteEntrada) count++;
    if ((settings.ausencias?.tipos || []).length > 0) count++;
    if (formNomina.frecuenciaPago) count++;
    if (formSeguridad.sesionMaxima) count++;
    if (formNotificaciones.emailAprobaciones !== undefined) count++;
    return count;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="configuracion-container d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="spinner-border text-success mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-muted fw-semibold">Cargando configuracion...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="configuracion-container">
        {/* ============ HEADER ============ */}
        <div className="cfg-page-header d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="cfg-header-title">
              <i className="bi bi-gear-fill me-2"></i>
              Configuracion del Sistema
            </div>
            <div className="cfg-header-sub">Administra y personaliza todos los parametros de tu organizacion</div>
          </div>
          <div className="cfg-header-stats">
            <div className="cfg-header-stat">
              <div className="cfg-header-stat-value">{countConfigured()}/7</div>
              <div className="cfg-header-stat-label">Secciones</div>
            </div>
            <div className="cfg-header-stat">
              <div className="cfg-header-stat-value">{(settings.departamentos?.lista || []).length}</div>
              <div className="cfg-header-stat-label">Departamentos</div>
            </div>
            <div className="cfg-header-stat">
              <div className="cfg-header-stat-value">{(settings.ausencias?.tipos || []).filter(t => t.activo !== false).length}</div>
              <div className="cfg-header-stat-label">Tipos Ausencia</div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* ============ SIDEBAR NAV ============ */}
          <div className="col-lg-3">
            <div className="cfg-nav-card">
              <div className="cfg-nav-header">
                <div className="cfg-nav-header-label">Secciones</div>
              </div>
              <div className="cfg-nav-list">
                {secciones.map(sec => (
                  <button
                    key={sec.id}
                    className={`cfg-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(sec.id)}
                  >
                    <span className={`cfg-nav-icon`}>
                      <i className={`bi ${sec.icon}`}></i>
                    </span>
                    <span className="cfg-nav-label">{sec.label}</span>
                    <i className="bi bi-chevron-right cfg-nav-arrow"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ============ CONTENT ============ */}
          <div className="col-lg-9">

            {/* ==================== EMPRESA ==================== */}
            {activeSection === 'empresa' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-empresa">
                      <i className="bi bi-building"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Datos de la Empresa</div>
                      <div className="cfg-section-subtitle">Informacion corporativa y de contacto</div>
                    </div>
                  </div>
                </div>
                <div className="cfg-section-body">
                  {/* Identidad */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-card-heading"></i>
                      Identidad Corporativa
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="cfg-form-label">Nombre de la Empresa</label>
                        <input type="text" className="form-control" value={formEmpresa.nombre || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, nombre: e.target.value })} placeholder="Cielito Home" />
                      </div>
                      <div className="col-md-6">
                        <label className="cfg-form-label">RFC</label>
                        <input type="text" className="form-control" value={formEmpresa.rfc || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, rfc: e.target.value.toUpperCase() })} placeholder="XAXX010101000" maxLength={13} />
                      </div>
                      <div className="col-12">
                        <label className="cfg-form-label">URL del Logo</label>
                        <input type="url" className="form-control" value={formEmpresa.logo || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, logo: e.target.value })} placeholder="https://..." />
                        {formEmpresa.logo && (
                          <div className="mt-2 d-inline-block p-2 bg-light rounded-3">
                            <img src={formEmpresa.logo} alt="Logo" style={{ maxHeight: '50px' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ubicacion */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-geo-alt"></i>
                      Ubicacion
                    </div>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="cfg-form-label">Direccion Completa</label>
                        <input type="text" className="form-control" value={formEmpresa.direccion || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, direccion: e.target.value })} placeholder="Calle, Numero, Colonia, Ciudad, Estado, CP" />
                      </div>
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-telephone"></i>
                      Contacto
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Telefono</label>
                        <input type="tel" className="form-control" value={formEmpresa.telefono || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, telefono: e.target.value })} placeholder="55 1234 5678" />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Email</label>
                        <input type="email" className="form-control" value={formEmpresa.email || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, email: e.target.value })} placeholder="contacto@empresa.com" />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Sitio Web</label>
                        <input type="url" className="form-control" value={formEmpresa.sitioWeb || ''} onChange={(e) => setFormEmpresa({ ...formEmpresa, sitioWeb: e.target.value })} placeholder="https://www.empresa.com" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button className="cfg-save-btn cfg-save-empresa" onClick={handleGuardarEmpresa}>
                      <i className="bi bi-check-circle"></i>
                      Guardar Datos de Empresa
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== DEPARTAMENTOS ==================== */}
            {activeSection === 'departamentos' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-departamentos">
                      <i className="bi bi-diagram-3"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Departamentos</div>
                      <div className="cfg-section-subtitle">{(settings.departamentos?.lista || []).length} departamentos configurados</div>
                    </div>
                  </div>
                  <button className="cfg-save-btn cfg-save-empresa" onClick={() => setShowModalDepartamento(true)} style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                    <i className="bi bi-plus-circle"></i>
                    Nuevo
                  </button>
                </div>
                <div className="cfg-section-body">
                  {(settings.departamentos?.lista || []).length === 0 ? (
                    <div className="cfg-empty-state">
                      <i className="bi bi-building"></i>
                      <p>No hay departamentos configurados</p>
                      <button className="cfg-save-btn" onClick={() => setShowModalDepartamento(true)} style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white' }}>
                        <i className="bi bi-plus-circle"></i>
                        Crear primer departamento
                      </button>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {(settings.departamentos?.lista || []).map((depto, index) => (
                        <div key={index} className="col-md-6 col-lg-4">
                          <div className="cfg-dept-card">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="cfg-dept-icon">
                                  <i className="bi bi-building"></i>
                                </div>
                                <div className="cfg-dept-name">{depto}</div>
                                <div className="cfg-dept-status">Activo</div>
                              </div>
                              <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleEliminarDepartamento(depto)} title="Eliminar">
                                <i className="bi bi-trash" style={{ fontSize: '0.9rem' }}></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== HORARIOS ==================== */}
            {activeSection === 'horarios' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-horarios">
                      <i className="bi bi-clock"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Configuracion de Horarios</div>
                      <div className="cfg-section-subtitle">Turnos, tolerancias y registro de asistencia</div>
                    </div>
                  </div>
                </div>
                <div className="cfg-section-body">
                  {/* Horario general */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-clock-history"></i>
                      Horario General
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Hora Limite de Entrada</label>
                        <input type="time" className="form-control" value={formHorarios.horaLimiteEntrada || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaLimiteEntrada: e.target.value })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Tolerancia (minutos)</label>
                        <input type="number" className="form-control" value={formHorarios.toleranciaMinutos || ''} onChange={(e) => setFormHorarios({ ...formHorarios, toleranciaMinutos: parseInt(e.target.value) })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Minutos para Retardo</label>
                        <input type="number" className="form-control" value={formHorarios.minutosRetardo || 15} onChange={(e) => setFormHorarios({ ...formHorarios, minutosRetardo: parseInt(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  {/* Registro de asistencia */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-calendar-check"></i>
                      Registro de Asistencia
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="cfg-form-label">Hora Inicio de Registro</label>
                        <input type="time" className="form-control" value={formHorarios.horaInicioRegistro || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaInicioRegistro: e.target.value })} />
                        <div className="cfg-form-hint">Hora desde la cual se puede registrar entrada</div>
                      </div>
                      <div className="col-md-6">
                        <label className="cfg-form-label">Hora Fin de Registro</label>
                        <input type="time" className="form-control" value={formHorarios.horaFinRegistro || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaFinRegistro: e.target.value })} />
                        <div className="cfg-form-hint">Hora limite para registrar entrada</div>
                      </div>
                    </div>
                  </div>

                  {/* Horarios de salida por tipo */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-door-open"></i>
                      Horarios de Salida por Tipo
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Salida Empleado Regular</label>
                        <input type="time" className="form-control" value={formHorarios.horaSalidaEmpleado || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaSalidaEmpleado: e.target.value })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Salida Becario</label>
                        <input type="time" className="form-control" value={formHorarios.horaSalidaBecario || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaSalidaBecario: e.target.value })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Salida Medio Tiempo</label>
                        <input type="time" className="form-control" value={formHorarios.horaSalidaMedioTiempo || ''} onChange={(e) => setFormHorarios({ ...formHorarios, horaSalidaMedioTiempo: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Turnos adicionales */}
                  <div className="cfg-form-group">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="cfg-group-title mb-0">
                        <i className="bi bi-calendar2-week"></i>
                        Turnos Adicionales
                      </div>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setShowModalHorario(true)} style={{ borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600 }}>
                        <i className="bi bi-plus me-1"></i>
                        Agregar
                      </button>
                    </div>
                    {(formHorarios.turnos || []).length === 0 ? (
                      <div className="cfg-empty-state" style={{ padding: '30px 20px' }}>
                        <i className="bi bi-calendar-plus" style={{ fontSize: '2rem' }}></i>
                        <p className="mb-0">No hay turnos adicionales configurados</p>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {formHorarios.turnos.map((turno, idx) => (
                          <div key={idx} className="cfg-turno-card">
                            <div className="cfg-turno-icon">
                              <i className="bi bi-clock"></i>
                            </div>
                            <div className="flex-grow-1">
                              <div className="cfg-turno-name">{turno.nombre}</div>
                              <div className="cfg-turno-time">
                                <i className="bi bi-box-arrow-in-right me-1"></i>{turno.entrada}
                                <span className="mx-2">-</span>
                                <i className="bi bi-box-arrow-right me-1"></i>{turno.salida}
                                <span className="ms-3"><i className="bi bi-hourglass-split me-1"></i>{turno.tolerancia} min</span>
                              </div>
                            </div>
                            <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleEliminarHorario(idx)} title="Eliminar">
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button className="cfg-save-btn cfg-save-horarios" onClick={handleGuardarHorarios}>
                      <i className="bi bi-check-circle"></i>
                      Guardar Configuracion de Horarios
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== AUSENCIAS ==================== */}
            {activeSection === 'ausencias' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-ausencias">
                      <i className="bi bi-calendar-x"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Tipos de Ausencia</div>
                      <div className="cfg-section-subtitle">{(settings.ausencias?.tipos || []).length} tipos configurados</div>
                    </div>
                  </div>
                  <button className="cfg-save-btn" onClick={() => { setEditingTipo(null); setFormTipo({ id: '', nombre: '', requiereAprobacion: true, diasMaximos: 0, color: '#28a745' }); setShowModalTipo(true); }} style={{ background: 'linear-gradient(135deg, #e8850c, #f59e0b)', color: 'white' }}>
                    <i className="bi bi-plus-circle"></i>
                    Nuevo Tipo
                  </button>
                </div>
                <div className="cfg-section-body">
                  {(settings.ausencias?.tipos || []).length === 0 ? (
                    <div className="cfg-empty-state">
                      <i className="bi bi-calendar-x"></i>
                      <p>No hay tipos de ausencia configurados</p>
                    </div>
                  ) : (
                    <div className="cfg-absence-table">
                      {(settings.ausencias?.tipos || []).map((tipo) => (
                        <div key={tipo.id} className="cfg-absence-row">
                          <div className="cfg-absence-color" style={{ backgroundColor: tipo.color || '#28a745' }}></div>
                          <div className="cfg-absence-info">
                            <div className="cfg-absence-name">{tipo.nombre}</div>
                            <div className="cfg-absence-id">{tipo.id}</div>
                          </div>
                          <div className="cfg-absence-badges">
                            {tipo.requiereAprobacion ? (
                              <span className="cfg-badge cfg-badge-blue">
                                <i className="bi bi-check-circle" style={{ fontSize: '0.65rem' }}></i>
                                Aprobacion
                              </span>
                            ) : (
                              <span className="cfg-badge cfg-badge-gray">Auto</span>
                            )}
                            {tipo.diasMaximos > 0 && (
                              <span className="cfg-badge cfg-badge-amber">
                                {tipo.diasMaximos} dias max
                              </span>
                            )}
                            <span className={`cfg-badge ${tipo.activo !== false ? 'cfg-badge-green' : 'cfg-badge-red'}`}>
                              {tipo.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-link text-primary p-1" onClick={() => handleEditarTipo(tipo)} title="Editar">
                              <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className={`btn btn-sm btn-link p-1 ${tipo.activo !== false ? 'text-danger' : 'text-success'}`} onClick={() => handleToggleTipo(tipo.id, tipo.activo !== false)} title={tipo.activo !== false ? 'Desactivar' : 'Activar'}>
                              <i className={`bi ${tipo.activo !== false ? 'bi-toggle-on' : 'bi-toggle-off'}`} style={{ fontSize: '1.2rem' }}></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== NOMINA ==================== */}
            {activeSection === 'nomina' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-nomina">
                      <i className="bi bi-cash-coin"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Parametros de Nomina</div>
                      <div className="cfg-section-subtitle">Descuentos, deducciones y periodos de pago</div>
                    </div>
                  </div>
                </div>
                <div className="cfg-section-body">
                  {/* Descuentos */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-dash-circle"></i>
                      Descuentos por Incidencias
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Descuento por Retardo</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" value={formNomina.descuentoPorRetardo || ''} onChange={(e) => setFormNomina({ ...formNomina, descuentoPorRetardo: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Retardos para Descuento</label>
                        <input type="number" className="form-control" value={formNomina.retardosParaDescuento || ''} onChange={(e) => setFormNomina({ ...formNomina, retardosParaDescuento: parseInt(e.target.value) })} />
                        <div className="cfg-form-hint">Retardos antes de aplicar descuento</div>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Descuento por Falta</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" value={formNomina.descuentoPorFalta || ''} onChange={(e) => setFormNomina({ ...formNomina, descuentoPorFalta: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deducciones fijas */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-receipt"></i>
                      Deducciones Fijas
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Descuento IMSS</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" value={formNomina.descuentoIMSS || ''} onChange={(e) => setFormNomina({ ...formNomina, descuentoIMSS: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">ISR</label>
                        <div className="input-group">
                          <input type="number" className="form-control" value={formNomina.porcentajeISR || ''} onChange={(e) => setFormNomina({ ...formNomina, porcentajeISR: parseFloat(e.target.value) })} />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Caja de Ahorro</label>
                        <div className="input-group">
                          <input type="number" className="form-control" value={formNomina.porcentajeCajaAhorro || ''} onChange={(e) => setFormNomina({ ...formNomina, porcentajeCajaAhorro: parseFloat(e.target.value) })} />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vacaciones y prestaciones */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-gift"></i>
                      Vacaciones y Prestaciones
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Dias de Vacaciones / Ano</label>
                        <input type="number" className="form-control" value={formNomina.diasVacacionesPorAnio || ''} onChange={(e) => setFormNomina({ ...formNomina, diasVacacionesPorAnio: parseInt(e.target.value) })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Prima Vacacional</label>
                        <div className="input-group">
                          <input type="number" className="form-control" value={formNomina.primaVacacional || ''} onChange={(e) => setFormNomina({ ...formNomina, primaVacacional: parseFloat(e.target.value) })} />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Aguinaldo (dias)</label>
                        <input type="number" className="form-control" value={formNomina.diasAguinaldo || ''} onChange={(e) => setFormNomina({ ...formNomina, diasAguinaldo: parseInt(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  {/* Periodo de pago */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-calendar3"></i>
                      Periodo de Pago
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="cfg-form-label">Frecuencia de Pago</label>
                        <select className="form-select" value={formNomina.frecuenciaPago || 'quincenal'} onChange={(e) => setFormNomina({ ...formNomina, frecuenciaPago: e.target.value })}>
                          <option value="semanal">Semanal</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="mensual">Mensual</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Dia de Corte</label>
                        <input type="number" className="form-control" min="1" max="31" value={formNomina.diaCorte || ''} onChange={(e) => setFormNomina({ ...formNomina, diaCorte: parseInt(e.target.value) })} />
                      </div>
                      <div className="col-md-4">
                        <label className="cfg-form-label">Dia de Pago</label>
                        <input type="number" className="form-control" min="1" max="31" value={formNomina.diaPago || ''} onChange={(e) => setFormNomina({ ...formNomina, diaPago: parseInt(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button className="cfg-save-btn cfg-save-nomina" onClick={handleGuardarNomina}>
                      <i className="bi bi-check-circle"></i>
                      Guardar Parametros de Nomina
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SEGURIDAD ==================== */}
            {activeSection === 'seguridad' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-seguridad">
                      <i className="bi bi-shield-lock"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Configuracion de Seguridad</div>
                      <div className="cfg-section-subtitle">Sesiones, autenticacion y proteccion de acceso</div>
                    </div>
                  </div>
                </div>
                <div className="cfg-section-body">
                  {/* Sesiones */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-person-lock"></i>
                      Control de Sesiones
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="cfg-form-label">Duracion Maxima de Sesion (horas)</label>
                        <input type="number" className="form-control" value={formSeguridad.sesionMaxima || 8} onChange={(e) => setFormSeguridad({ ...formSeguridad, sesionMaxima: parseInt(e.target.value) })} />
                        <div className="cfg-form-hint">Tiempo antes de cerrar sesion automaticamente</div>
                      </div>
                      <div className="col-md-6">
                        <label className="cfg-form-label">Intentos de Login Permitidos</label>
                        <input type="number" className="form-control" value={formSeguridad.intentosLogin || 5} onChange={(e) => setFormSeguridad({ ...formSeguridad, intentosLogin: parseInt(e.target.value) })} />
                        <div className="cfg-form-hint">Antes de bloquear temporalmente la cuenta</div>
                      </div>
                    </div>
                  </div>

                  {/* Opciones de seguridad */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-toggles"></i>
                      Opciones de Seguridad
                    </div>
                    <div className="cfg-switch-item" style={formSeguridad.requerirCambioPassword ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Cambio periodico de contrasena</div>
                        <div className="cfg-switch-desc">Obliga a los usuarios a cambiar su contrasena periodicamente</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formSeguridad.requerirCambioPassword || false} onChange={(e) => setFormSeguridad({ ...formSeguridad, requerirCambioPassword: e.target.checked })} />
                      </div>
                    </div>
                    {formSeguridad.requerirCambioPassword && (
                      <div className="mt-2 ms-3">
                        <label className="cfg-form-label">Dias para cambio de contrasena</label>
                        <input type="number" className="form-control" style={{ maxWidth: '200px' }} value={formSeguridad.diasCambioPassword || 90} onChange={(e) => setFormSeguridad({ ...formSeguridad, diasCambioPassword: parseInt(e.target.value) })} />
                      </div>
                    )}
                    <div className="cfg-switch-item" style={formSeguridad.dobleAutenticacion ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Doble autenticacion (2FA)</div>
                        <div className="cfg-switch-desc">Capa adicional de seguridad al iniciar sesion</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formSeguridad.dobleAutenticacion || false} onChange={(e) => setFormSeguridad({ ...formSeguridad, dobleAutenticacion: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formSeguridad.registrarIP ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Registro de IP</div>
                        <div className="cfg-switch-desc">Guardar la direccion IP en cada inicio de sesion</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formSeguridad.registrarIP || false} onChange={(e) => setFormSeguridad({ ...formSeguridad, registrarIP: e.target.checked })} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button className="cfg-save-btn cfg-save-seguridad" onClick={handleGuardarSeguridad}>
                      <i className="bi bi-check-circle"></i>
                      Guardar Configuracion de Seguridad
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== NOTIFICACIONES ==================== */}
            {activeSection === 'notificaciones' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                    <div className="cfg-section-icon cfg-icon-notificaciones">
                      <i className="bi bi-bell"></i>
                    </div>
                    <div>
                      <div className="cfg-section-title">Configuracion de Notificaciones</div>
                      <div className="cfg-section-subtitle">Alertas por email, push y recordatorios</div>
                    </div>
                  </div>
                </div>
                <div className="cfg-section-body">
                  {/* Email */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-envelope"></i>
                      Notificaciones por Email
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.emailAprobaciones ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Aprobacion de solicitudes</div>
                        <div className="cfg-switch-desc">Notificar cuando se apruebe una solicitud</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.emailAprobaciones || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, emailAprobaciones: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.emailRechazo ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Rechazo de solicitudes</div>
                        <div className="cfg-switch-desc">Notificar cuando se rechace una solicitud</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.emailRechazo || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, emailRechazo: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.emailNomina ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Generacion de nomina</div>
                        <div className="cfg-switch-desc">Avisar cuando se genere un nuevo periodo de nomina</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.emailNomina || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, emailNomina: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.emailCumpleanos ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Cumpleanos de empleados</div>
                        <div className="cfg-switch-desc">Enviar felicitaciones por cumpleanos</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.emailCumpleanos || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, emailCumpleanos: e.target.checked })} />
                      </div>
                    </div>
                  </div>

                  {/* Push */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-app-indicator"></i>
                      Notificaciones en Sistema
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.pushNotificaciones ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Notificaciones push</div>
                        <div className="cfg-switch-desc">Habilitar notificaciones en tiempo real</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.pushNotificaciones || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, pushNotificaciones: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.sonidoNotificacion ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Sonido en notificaciones</div>
                        <div className="cfg-switch-desc">Reproducir sonido al recibir notificaciones</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.sonidoNotificacion || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, sonidoNotificacion: e.target.checked })} />
                      </div>
                    </div>
                  </div>

                  {/* Recordatorios */}
                  <div className="cfg-form-group">
                    <div className="cfg-group-title">
                      <i className="bi bi-alarm"></i>
                      Recordatorios Automaticos
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.recordatorioChecada ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Recordar checar entrada/salida</div>
                        <div className="cfg-switch-desc">Enviar recordatorio si no ha registrado asistencia</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.recordatorioChecada || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, recordatorioChecada: e.target.checked })} />
                      </div>
                    </div>
                    <div className="cfg-switch-item" style={formNotificaciones.recordatorioVacaciones ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                      <div>
                        <div className="cfg-switch-label">Recordar vacaciones disponibles</div>
                        <div className="cfg-switch-desc">Notificar cuando haya dias de vacaciones pendientes</div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" checked={formNotificaciones.recordatorioVacaciones || false} onChange={(e) => setFormNotificaciones({ ...formNotificaciones, recordatorioVacaciones: e.target.checked })} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button className="cfg-save-btn cfg-save-notificaciones" onClick={handleGuardarNotificaciones}>
                      <i className="bi bi-check-circle"></i>
                      Guardar Notificaciones
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== MODAL: TIPO DE AUSENCIA ==================== */}
        {showModalTipo && (
          <div className="cfg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModalTipo(false); }}>
            <div className="cfg-modal">
              <div className="cfg-modal-header cfg-modal-header-amber">
                <h5>
                  <i className="bi bi-calendar-x"></i>
                  {editingTipo ? 'Editar Tipo de Ausencia' : 'Nuevo Tipo de Ausencia'}
                </h5>
                <button className="cfg-modal-close" onClick={() => setShowModalTipo(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="cfg-modal-body">
                <div className="mb-3">
                  <label className="cfg-form-label">ID (sin espacios)</label>
                  <input type="text" className="form-control" placeholder="ej: permiso_especial" value={formTipo.id} onChange={(e) => setFormTipo({ ...formTipo, id: e.target.value.toLowerCase().replace(/\s/g, '_') })} disabled={editingTipo} />
                </div>
                <div className="mb-3">
                  <label className="cfg-form-label">Nombre</label>
                  <input type="text" className="form-control" placeholder="ej: Permiso Especial" value={formTipo.nombre} onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })} />
                </div>
                <div className="row mb-3 g-3">
                  <div className="col-6">
                    <label className="cfg-form-label">Dias Maximos</label>
                    <input type="number" className="form-control" value={formTipo.diasMaximos || 0} onChange={(e) => setFormTipo({ ...formTipo, diasMaximos: parseInt(e.target.value) })} />
                    <div className="cfg-form-hint">0 = sin limite</div>
                  </div>
                  <div className="col-6">
                    <label className="cfg-form-label">Color</label>
                    <div className="d-flex align-items-center gap-2">
                      <input type="color" className="form-control form-control-color" style={{ width: '50px', height: '40px', borderRadius: '10px', padding: '2px' }} value={formTipo.color || '#28a745'} onChange={(e) => setFormTipo({ ...formTipo, color: e.target.value })} />
                      <span className="cfg-form-hint">{formTipo.color || '#28a745'}</span>
                    </div>
                  </div>
                </div>
                <div className="cfg-switch-item" style={formTipo.requiereAprobacion ? { borderColor: '#28a745', background: '#f0fff4' } : {}}>
                  <div>
                    <div className="cfg-switch-label">Requiere aprobacion de RH</div>
                    <div className="cfg-switch-desc">Se necesita autorizacion para aprobar este tipo</div>
                  </div>
                  <div className="form-check form-switch m-0">
                    <input className="form-check-input" type="checkbox" checked={formTipo.requiereAprobacion} onChange={(e) => setFormTipo({ ...formTipo, requiereAprobacion: e.target.checked })} />
                  </div>
                </div>
              </div>
              <div className="cfg-modal-footer">
                <button className="cfg-modal-cancel" onClick={() => setShowModalTipo(false)}>Cancelar</button>
                <button className="cfg-modal-confirm" onClick={handleAgregarTipo} style={{ background: 'linear-gradient(135deg, #e8850c, #f59e0b)' }}>
                  <i className="bi bi-check-circle me-2"></i>
                  {editingTipo ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL: DEPARTAMENTO ==================== */}
        {showModalDepartamento && (
          <div className="cfg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModalDepartamento(false); }}>
            <div className="cfg-modal">
              <div className="cfg-modal-header cfg-modal-header-green">
                <h5>
                  <i className="bi bi-building"></i>
                  Nuevo Departamento
                </h5>
                <button className="cfg-modal-close" onClick={() => setShowModalDepartamento(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="cfg-modal-body">
                <div className="mb-3">
                  <label className="cfg-form-label">Nombre del Departamento</label>
                  <input type="text" className="form-control" placeholder="ej: Contabilidad" value={formDepartamento.nombre} onChange={(e) => setFormDepartamento({ ...formDepartamento, nombre: e.target.value })} />
                </div>
              </div>
              <div className="cfg-modal-footer">
                <button className="cfg-modal-cancel" onClick={() => setShowModalDepartamento(false)}>Cancelar</button>
                <button className="cfg-modal-confirm" onClick={handleAgregarDepartamento} style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                  <i className="bi bi-check-circle me-2"></i>
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL: TURNO ==================== */}
        {showModalHorario && (
          <div className="cfg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModalHorario(false); }}>
            <div className="cfg-modal">
              <div className="cfg-modal-header cfg-modal-header-blue">
                <h5>
                  <i className="bi bi-clock"></i>
                  Nuevo Turno
                </h5>
                <button className="cfg-modal-close" onClick={() => setShowModalHorario(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="cfg-modal-body">
                <div className="mb-3">
                  <label className="cfg-form-label">Nombre del Turno</label>
                  <input type="text" className="form-control" placeholder="ej: Turno Nocturno" value={formHorarioNuevo.nombre} onChange={(e) => setFormHorarioNuevo({ ...formHorarioNuevo, nombre: e.target.value })} />
                </div>
                <div className="row mb-3 g-3">
                  <div className="col-6">
                    <label className="cfg-form-label">Hora Entrada</label>
                    <input type="time" className="form-control" value={formHorarioNuevo.entrada} onChange={(e) => setFormHorarioNuevo({ ...formHorarioNuevo, entrada: e.target.value })} />
                  </div>
                  <div className="col-6">
                    <label className="cfg-form-label">Hora Salida</label>
                    <input type="time" className="form-control" value={formHorarioNuevo.salida} onChange={(e) => setFormHorarioNuevo({ ...formHorarioNuevo, salida: e.target.value })} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="cfg-form-label">Tolerancia (minutos)</label>
                  <input type="number" className="form-control" value={formHorarioNuevo.tolerancia} onChange={(e) => setFormHorarioNuevo({ ...formHorarioNuevo, tolerancia: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="cfg-modal-footer">
                <button className="cfg-modal-cancel" onClick={() => setShowModalHorario(false)}>Cancelar</button>
                <button className="cfg-modal-confirm" onClick={handleAgregarHorario} style={{ background: 'linear-gradient(135deg, #0077b6, #0096c7)' }}>
                  <i className="bi bi-check-circle me-2"></i>
                  Agregar Turno
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}

export default Configuracion;
