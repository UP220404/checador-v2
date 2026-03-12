import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData, ROLES } from '../components/DepartmentBanner';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import '../styles/Usuarios.css';

function Usuarios() {
  const { isAdminRH, isAdminArea, userDepartamento } = useRoleData();
  const [showModal, setShowModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [vistaCards, setVistaCards] = useState(true);
  const [showContratoModal, setShowContratoModal] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Toast
  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    role: ROLES.EMPLEADO,
    activo: true,
    telefono: '',
    departamento: '',
    puesto: '',
    fechaIngreso: '',
    salarioBase: '',
    // Datos personales
    fechaNacimiento: '',
    direccion: '',
    contactoEmergencia: '',
    contactoEmergenciaTelefono: '',
    // Nómina ampliada (RH only)
    tipoNomina: 'quincenal',
    horasQuincenal: '',
    tieneIMSS: false,
    tieneCajaAhorro: false,
    montoCajaAhorro: '',
    cuentaBancaria: '',
    nombreBanco: ''
  });

  // Consultas React Query
  const { 
    data: usuarios = [], 
    isLoading: loadingUsers, 
    refetch: refetchUsers 
  } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const res = await api.getUsers();
      return res.data?.data || [];
    }
  });

  const { 
    data: settingsData = {}, 
    isLoading: loadingSettings 
  } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.getAllSettings();
      return res.data?.data || {};
    }
  });

  const loading = loadingUsers || loadingSettings;
  const departamentos = settingsData?.departamentos?.lista || [];

  // Filtrar usuarios
  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusqueda = !busqueda ||
      u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      (u.correo || u.email)?.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = !filtroRol || u.role === filtroRol;
    const matchDepto = !filtroDepartamento || u.departamento === filtroDepartamento;
    const matchEstado = filtroEstado === '' ||
      (filtroEstado === 'activo' && u.activo !== false) ||
      (filtroEstado === 'inactivo' && u.activo === false);
    return matchBusqueda && matchRol && matchDepto && matchEstado;
  });

  // Estadísticas
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo !== false).length,
    admins: usuarios.filter(u => u.role === ROLES.ADMIN_RH || u.role === ROLES.ADMIN_AREA).length,
    sinDepartamento: usuarios.filter(u => !u.departamento).length
  };

  const handleFormChange = (campo, valor) => {
    setFormData(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setFormData({
      nombre: '',
      email: '',
      role: ROLES.EMPLEADO,
      activo: true,
      telefono: '',
      departamento: '',
      puesto: '',
      fechaIngreso: '',
      salarioBase: '',
      fechaNacimiento: '',
      direccion: '',
      contactoEmergencia: '',
      contactoEmergenciaTelefono: '',
      tipoNomina: 'quincenal',
      horasQuincenal: '',
      tieneIMSS: false,
      tieneCajaAhorro: false,
      montoCajaAhorro: '',
      cuentaBancaria: '',
      nombreBanco: ''
    });
    setShowModal(true);
  };

  const abrirModalEditar = async (usuario) => {
    setModoEdicion(true);
    setUsuarioSeleccionado(usuario);
    setFormData({
      nombre: usuario.nombre || '',
      email: usuario.correo || usuario.email || '',
      role: usuario.role || ROLES.EMPLEADO,
      activo: usuario.activo !== false,
      telefono: usuario.telefono || '',
      departamento: usuario.departamento || '',
      puesto: usuario.puesto || '',
      fechaIngreso: usuario.fechaIngreso || '',
      salarioBase: usuario.salarioBase || '',
      fechaNacimiento: usuario.fechaNacimiento || '',
      direccion: usuario.direccion || '',
      contactoEmergencia: usuario.contactoEmergencia || '',
      contactoEmergenciaTelefono: usuario.contactoEmergenciaTelefono || '',
      tipoNomina: 'quincenal',
      horasQuincenal: '',
      tieneIMSS: false,
      tieneCajaAhorro: false,
      montoCajaAhorro: '',
      cuentaBancaria: '',
      nombreBanco: ''
    });

    if (isAdminRH) {
      try {
        const payrollResp = await api.getPayrollConfig(usuario.id);
        const cfg = payrollResp.data?.data || payrollResp.data || {};
        setFormData(prev => ({
          ...prev,
          tipoNomina: cfg.tipoNomina || 'quincenal',
          horasQuincenal: cfg.horasQuincenal || '',
          tieneIMSS: cfg.tieneIMSS || false,
          tieneCajaAhorro: cfg.tieneCajaAhorro || false,
          montoCajaAhorro: cfg.montoCajaAhorro || '',
          cuentaBancaria: cfg.cuentaBancaria || '',
          nombreBanco: cfg.nombreBanco || ''
        }));
      } catch (e) { /* sin config de nómina, usar defaults */ }
    }

    setShowModal(true);
  };

  const guardarUsuario = async () => {
    try {
      if (!formData.nombre || !formData.email) {
        showToast('Nombre y email son requeridos', 'warning');
        return;
      }

      const userPayload = {
        nombre: formData.nombre,
        email: formData.email,
        role: formData.role,
        activo: formData.activo,
        telefono: formData.telefono,
        departamento: formData.departamento,
        puesto: formData.puesto,
        fechaIngreso: formData.fechaIngreso,
        salarioBase: formData.salarioBase,
        fechaNacimiento: formData.fechaNacimiento,
        direccion: formData.direccion,
        contactoEmergencia: formData.contactoEmergencia,
        contactoEmergenciaTelefono: formData.contactoEmergenciaTelefono
      };

      const payrollPayload = {
        tipoNomina: formData.tipoNomina,
        horasQuincenal: formData.horasQuincenal,
        tieneIMSS: formData.tieneIMSS,
        tieneCajaAhorro: formData.tieneCajaAhorro,
        montoCajaAhorro: formData.tieneCajaAhorro ? formData.montoCajaAhorro : 0,
        cuentaBancaria: formData.cuentaBancaria,
        nombreBanco: formData.nombreBanco
      };

      if (modoEdicion) {
        if (usuarioSeleccionado.role !== formData.role) {
          await api.updateUserRole(usuarioSeleccionado.id, formData.role, formData.departamento);
        }
        await api.updateUser(usuarioSeleccionado.id, userPayload);
        if (isAdminRH) {
          await api.updatePayrollConfig(usuarioSeleccionado.id, payrollPayload);
        }
        showToast('Usuario actualizado exitosamente', 'success');
      } else {
        const newUser = await api.createUser(userPayload);
        const newUid = newUser.data?.data?.uid || newUser.data?.data?.id || newUser.data?.uid;
        if (isAdminRH && newUid) {
          await api.updatePayrollConfig(newUid, payrollPayload);
        }
        showToast('Usuario creado exitosamente', 'success');
      }

      setShowModal(false);
      refetchUsers();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      const errorMsg = error.response?.data?.message || 'Error al guardar el usuario';
      showToast(errorMsg, 'error');
    }
  };

  const eliminarUsuario = async (id, nombre) => {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta accion no se puede deshacer.`)) return;

    try {
      await api.deleteUser(id);
      showToast('Usuario eliminado correctamente', 'success');
      refetchUsers(); // Forzar recarga
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      showToast('Error al eliminar el usuario', 'error');
    }
  };

  const toggleEstado = async (id, estadoActual, nombre) => {
    try {
      await api.updateUser(id, { activo: !estadoActual });
      showToast(`${nombre} ${!estadoActual ? 'activado' : 'desactivado'}`, 'success');
      refetchUsers(); // Forzar recarga
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showToast('Error al cambiar el estado', 'error');
    }
  };

  const getIniciales = (nombre) => {
    if (!nombre) return '?';
    return nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case ROLES.ADMIN_RH: return 'danger';
      case ROLES.ADMIN_AREA: return 'warning';
      default: return 'primary';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case ROLES.ADMIN_RH: return 'Admin RH';
      case ROLES.ADMIN_AREA: return 'Admin Area';
      default: return 'Empleado';
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroRol('');
    setFiltroDepartamento('');
    setFiltroEstado('');
  };

  return (
    <AdminLayout>
      <div className="usuarios-container">
        {/* Header */}
        <div className="page-header d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">
              <i className="bi bi-people-fill me-2 text-success"></i>
              {isAdminArea ? 'Empleados del Departamento' : 'Gestion de Usuarios'}
            </h2>
            <p className="text-muted mb-0">
              {isAdminArea ? `Empleados de ${userDepartamento}` : 'Administra todos los usuarios del sistema'}
            </p>
          </div>
          {isAdminRH && (
            <button className="btn btn-success btn-lg" onClick={abrirModalNuevo}>
              <i className="bi bi-plus-circle me-2"></i>
              Nuevo Usuario
            </button>
          )}
        </div>

        <DepartmentBanner />

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-primary bg-opacity-10 text-primary me-3">
                    <i className="bi bi-people"></i>
                  </div>
                  <div>
                    <h3 className="mb-0">{stats.total}</h3>
                    <small className="text-muted">Total</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-success bg-opacity-10 text-success me-3">
                    <i className="bi bi-person-check"></i>
                  </div>
                  <div>
                    <h3 className="mb-0">{stats.activos}</h3>
                    <small className="text-muted">Activos</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-danger bg-opacity-10 text-danger me-3">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <div>
                    <h3 className="mb-0">{stats.admins}</h3>
                    <small className="text-muted">Admins</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-warning bg-opacity-10 text-warning me-3">
                    <i className="bi bi-exclamation-triangle"></i>
                  </div>
                  <div>
                    <h3 className="mb-0">{stats.sinDepartamento}</h3>
                    <small className="text-muted">Sin Depto</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-lg-4">
                <label className="form-label small text-muted">Buscar</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Nombre o email..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label small text-muted">Rol</label>
                <select
                  className="form-select"
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value={ROLES.EMPLEADO}>Empleado</option>
                  <option value={ROLES.ADMIN_AREA}>Admin Area</option>
                  <option value={ROLES.ADMIN_RH}>Admin RH</option>
                </select>
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label small text-muted">Departamento</label>
                <select
                  className="form-select"
                  value={filtroDepartamento}
                  onChange={(e) => setFiltroDepartamento(e.target.value)}
                >
                  <option value="">Todos</option>
                  {departamentos.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label small text-muted">Estado</label>
                <select
                  className="form-select"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>
              <div className="col-6 col-lg-2">
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-secondary flex-grow-1"
                    onClick={limpiarFiltros}
                    title="Limpiar filtros"
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                  <div className="btn-group">
                    <button
                      className={`btn ${vistaCards ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setVistaCards(true)}
                      title="Vista tarjetas"
                    >
                      <i className="bi bi-grid-3x3-gap"></i>
                    </button>
                    <button
                      className={`btn ${!vistaCards ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setVistaCards(false)}
                      title="Vista tabla"
                    >
                      <i className="bi bi-list-ul"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="text-muted">
            Mostrando {usuariosFiltrados.length} de {usuarios.length} usuarios
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-search display-1 text-muted opacity-25"></i>
              <h5 className="mt-4 text-muted">No se encontraron usuarios</h5>
              <p className="text-muted">Intenta con otros filtros de busqueda</p>
              <button className="btn btn-outline-success" onClick={limpiarFiltros}>
                <i className="bi bi-arrow-counterclockwise me-2"></i>
                Limpiar filtros
              </button>
            </div>
          </div>
        ) : vistaCards ? (
          /* Vista Cards - Tarjetas Corporativas */
          <div className="row g-4">
            {usuariosFiltrados.map((usuario) => {
              const roleClass = usuario.role === ROLES.ADMIN_RH ? 'admin-rh' : usuario.role === ROLES.ADMIN_AREA ? 'admin-area' : '';

              return (
                <div key={usuario.id} className="col-sm-6 col-lg-4 col-xl-3">
                  <div className={`employee-card ${usuario.activo === false ? 'inactive' : ''}`}>
                    {/* Header con gradiente */}
                    <div className={`employee-card-header ${roleClass}`}>
                      <span className="employee-role-badge">
                        {getRoleLabel(usuario.role)}
                      </span>
                    </div>

                    {/* Avatar circular */}
                    <div className={`employee-avatar ${roleClass}`}>
                      {getIniciales(usuario.nombre)}
                    </div>

                    {/* Contenido */}
                    <div className="employee-card-body">
                      <h5 className="employee-name">{usuario.nombre || 'Sin nombre'}</h5>
                      <p className="employee-puesto">{usuario.puesto || 'Empleado'}</p>

                      {/* Info Carousel - Mini slides de información */}
                      <div className="employee-info-carousel">
                        <div className="info-slide">
                          <div className="info-slide-icon">
                            <i className="bi bi-building"></i>
                          </div>
                          <div className="info-slide-content">
                            <span className="info-slide-label">Departamento</span>
                            <span className="info-slide-value">{usuario.departamento || 'Sin asignar'}</span>
                          </div>
                        </div>
                        <div className="info-slide">
                          <div className="info-slide-icon">
                            <i className="bi bi-telephone"></i>
                          </div>
                          <div className="info-slide-content">
                            <span className="info-slide-label">Telefono</span>
                            <span className="info-slide-value">{usuario.telefono || 'No registrado'}</span>
                          </div>
                        </div>
                        <div className="info-slide">
                          <div className="info-slide-icon">
                            <i className="bi bi-envelope"></i>
                          </div>
                          <div className="info-slide-content">
                            <span className="info-slide-label">Email</span>
                            <span className="info-slide-value info-email">{usuario.correo || usuario.email}</span>
                          </div>
                        </div>
                        {usuario.fechaIngreso && (
                          <div className="info-slide">
                            <div className="info-slide-icon">
                              <i className="bi bi-calendar-check"></i>
                            </div>
                            <div className="info-slide-content">
                              <span className="info-slide-label">Ingreso</span>
                              <span className="info-slide-value">{usuario.fechaIngreso}</span>
                            </div>
                          </div>
                        )}
                        {usuario.contrato && (
                          <div className="info-slide">
                            <div className="info-slide-icon">
                              <i className="bi bi-file-earmark-text"></i>
                            </div>
                            <div className="info-slide-content">
                              <span className="info-slide-label">Contrato</span>
                              <span className="info-slide-value">
                                {usuario.contrato.tipo === 'inicial_1_mes' ? '1 Mes' :
                                 usuario.contrato.tipo === 'extension_2_meses' ? '2 Meses' :
                                 usuario.contrato.tipo === 'indefinido' ? 'Indefinido' : usuario.contrato.tipo}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Estado */}
                      <div className={`employee-status ${usuario.activo !== false ? 'active' : 'inactive'}`}>
                        <i className={`bi ${usuario.activo !== false ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                        {usuario.activo !== false ? 'Activo' : 'Inactivo'}
                      </div>
                    </div>

                    {/* Footer con acciones */}
                    <div className="employee-card-footer">
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => abrirModalEditar(usuario)}
                        title={isAdminRH ? 'Editar' : 'Ver detalles'}
                      >
                        <i className={`bi ${isAdminRH ? 'bi-pencil' : 'bi-eye'} me-1`}></i>
                        {isAdminRH ? 'Editar' : 'Ver'}
                      </button>
                      {isAdminRH && (
                        <>
                          <button
                            className={`btn ${usuario.activo !== false ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            onClick={() => toggleEstado(usuario.id, usuario.activo !== false, usuario.nombre)}
                            title={usuario.activo !== false ? 'Desactivar' : 'Activar'}
                          >
                            <i className={`bi ${usuario.activo !== false ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => eliminarUsuario(usuario.id, usuario.nombre)}
                            title="Eliminar"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vista Tabla */
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '50px' }}></th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Departamento</th>
                      <th>Telefono</th>
                      <th className="text-center">Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((usuario) => (
                      <tr key={usuario.id} className={usuario.activo === false ? 'table-secondary' : ''}>
                        <td>
                          <div className={`avatar-circle-sm bg-${getRoleColor(usuario.role)} bg-opacity-10 text-${getRoleColor(usuario.role)}`}>
                            {getIniciales(usuario.nombre)}
                          </div>
                        </td>
                        <td>
                          <strong>{usuario.nombre || 'Sin nombre'}</strong>
                          {usuario.puesto && (
                            <small className="d-block text-muted">{usuario.puesto}</small>
                          )}
                        </td>
                        <td>{usuario.correo || usuario.email}</td>
                        <td>
                          <span className={`badge bg-${getRoleColor(usuario.role)} bg-opacity-10 text-${getRoleColor(usuario.role)}`}>
                            {getRoleLabel(usuario.role)}
                          </span>
                        </td>
                        <td>{usuario.departamento || '-'}</td>
                        <td>{usuario.telefono || '-'}</td>
                        <td className="text-center">
                          <span className={`badge ${usuario.activo !== false ? 'bg-success' : 'bg-secondary'}`}>
                            {usuario.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => abrirModalEditar(usuario)}
                              title={isAdminRH ? 'Editar' : 'Ver'}
                            >
                              <i className={`bi ${isAdminRH ? 'bi-pencil' : 'bi-eye'}`}></i>
                            </button>
                            {isAdminRH && (
                              <>
                                <button
                                  className={`btn btn-sm ${usuario.activo !== false ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  onClick={() => toggleEstado(usuario.id, usuario.activo !== false, usuario.nombre)}
                                  title={usuario.activo !== false ? 'Desactivar' : 'Activar'}
                                >
                                  <i className={`bi ${usuario.activo !== false ? 'bi-pause' : 'bi-play'}`}></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => eliminarUsuario(usuario.id, usuario.nombre)}
                                  title="Eliminar"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Crear/Editar Usuario */}
        {showModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'auto' }}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable" style={{ margin: '1.75rem auto' }}>
              <div className="modal-content border-0 shadow">
                <div className="modal-header bg-success text-white">
                  <h5 className="modal-title">
                    <i className={`bi ${modoEdicion ? (isAdminRH ? 'bi-pencil-square' : 'bi-person') : 'bi-person-plus'} me-2`}></i>
                    {modoEdicion
                      ? (isAdminRH ? 'Editar Usuario' : 'Detalles del Empleado')
                      : 'Nuevo Usuario'}
                  </h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  {isAdminArea && modoEdicion && (
                    <div className="alert alert-warning mb-4">
                      <i className="bi bi-info-circle me-2"></i>
                      Solo puedes ver los datos. Contacta a RH para realizar cambios.
                    </div>
                  )}

                  {/* Datos basicos */}
                  <h6 className="text-muted mb-3">
                    <i className="bi bi-person me-2"></i>
                    Datos Basicos
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label">
                        Nombre Completo {isAdminRH && <span className="text-danger">*</span>}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.nombre}
                        onChange={(e) => handleFormChange('nombre', e.target.value)}
                        placeholder="Juan Perez"
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">
                        Email {isAdminRH && <span className="text-danger">*</span>}
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        placeholder="usuario@empresa.com"
                        disabled={modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Telefono</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formData.telefono}
                        onChange={(e) => handleFormChange('telefono', e.target.value)}
                        placeholder="55 1234 5678"
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Estado</label>
                      <select
                        className="form-select"
                        value={formData.activo}
                        onChange={(e) => handleFormChange('activo', e.target.value === 'true')}
                        disabled={isAdminArea && modoEdicion}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                  </div>

                  {/* Datos personales */}
                  <h6 className="text-muted mb-3">
                    <i className="bi bi-person-vcard me-2"></i>
                    Datos Personales
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Fecha de Nacimiento</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.fechaNacimiento}
                        onChange={(e) => handleFormChange('fechaNacimiento', e.target.value)}
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Dirección</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.direccion}
                        onChange={(e) => handleFormChange('direccion', e.target.value)}
                        placeholder="Calle, Colonia, Ciudad"
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Contacto de Emergencia</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.contactoEmergencia}
                        onChange={(e) => handleFormChange('contactoEmergencia', e.target.value)}
                        placeholder="Nombre del contacto"
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Teléfono del Contacto</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formData.contactoEmergenciaTelefono}
                        onChange={(e) => handleFormChange('contactoEmergenciaTelefono', e.target.value)}
                        placeholder="55 1234 5678"
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                  </div>

                  {/* Datos laborales */}
                  <h6 className="text-muted mb-3">
                    <i className="bi bi-briefcase me-2"></i>
                    Datos Laborales
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Rol</label>
                      <select
                        className="form-select"
                        value={formData.role}
                        onChange={(e) => handleFormChange('role', e.target.value)}
                        disabled={isAdminArea && modoEdicion}
                      >
                        <option value={ROLES.EMPLEADO}>Empleado</option>
                        <option value={ROLES.ADMIN_AREA}>Admin de Area</option>
                        <option value={ROLES.ADMIN_RH}>Admin RH</option>
                      </select>
                      {formData.role === ROLES.ADMIN_AREA && (
                        <small className="text-muted">Administra solo su departamento</small>
                      )}
                      {formData.role === ROLES.ADMIN_RH && (
                        <small className="text-danger">Acceso total al sistema</small>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Departamento</label>
                      <select
                        className="form-select"
                        value={formData.departamento}
                        onChange={(e) => handleFormChange('departamento', e.target.value)}
                        disabled={isAdminArea && modoEdicion}
                      >
                        <option value="">Seleccionar...</option>
                        {departamentos.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Puesto</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.puesto}
                        onChange={(e) => handleFormChange('puesto', e.target.value)}
                        placeholder="Desarrollador, Analista, etc."
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fecha de Ingreso</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.fechaIngreso}
                        onChange={(e) => handleFormChange('fechaIngreso', e.target.value)}
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                  </div>

                  {/* Datos de nomina - solo RH */}
                  {isAdminRH && (
                    <>
                      <h6 className="text-muted mb-3 mt-2">
                        <i className="bi bi-cash-coin me-2"></i>
                        Datos de Nómina
                      </h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Salario Base (Quincenal)</label>
                          <div className="input-group">
                            <span className="input-group-text">$</span>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.salarioBase}
                              onChange={(e) => handleFormChange('salarioBase', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Tipo de Nómina</label>
                          <select
                            className="form-select"
                            value={formData.tipoNomina}
                            onChange={(e) => handleFormChange('tipoNomina', e.target.value)}
                          >
                            <option value="quincenal">Quincenal</option>
                            <option value="mensual">Mensual</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Horas por Quincena</label>
                          <input
                            type="number"
                            className="form-control"
                            value={formData.horasQuincenal}
                            onChange={(e) => handleFormChange('horasQuincenal', e.target.value)}
                            placeholder="96"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Cuenta Bancaria</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.cuentaBancaria}
                            onChange={(e) => handleFormChange('cuentaBancaria', e.target.value)}
                            placeholder="Número de cuenta o CLABE"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Banco</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.nombreBanco}
                            onChange={(e) => handleFormChange('nombreBanco', e.target.value)}
                            placeholder="BBVA, Santander, HSBC..."
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label d-block">IMSS</label>
                          <div className="form-check form-switch m-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              role="switch"
                              id="chkIMSS"
                              checked={formData.tieneIMSS}
                              onChange={(e) => handleFormChange('tieneIMSS', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="chkIMSS">
                              <i className="bi bi-shield-plus me-1 text-success"></i>
                              {formData.tieneIMSS ? 'Con IMSS' : 'Sin IMSS'}
                            </label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label d-block">Caja de Ahorro</label>
                          <div className="form-check form-switch m-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              role="switch"
                              id="chkCaja"
                              checked={formData.tieneCajaAhorro}
                              onChange={(e) => handleFormChange('tieneCajaAhorro', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="chkCaja">
                              <i className="bi bi-piggy-bank me-1 text-primary"></i>
                              {formData.tieneCajaAhorro ? 'Con Caja de Ahorro' : 'Sin Caja de Ahorro'}
                            </label>
                          </div>
                        </div>
                        {formData.tieneCajaAhorro && (
                          <div className="col-md-6">
                            <label className="form-label">Monto Caja de Ahorro</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="number"
                                className="form-control"
                                value={formData.montoCajaAhorro}
                                onChange={(e) => handleFormChange('montoCajaAhorro', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Datos de contrato - solo RH y en modo edicion */}
                  {isAdminRH && modoEdicion && (
                    <>
                      <h6 className="text-muted mb-3 mt-4">
                        <i className="bi bi-file-earmark-text me-2"></i>
                        Informacion de Contrato
                      </h6>
                      {usuarioSeleccionado?.contrato ? (
                        <div className="row g-3">
                          <div className="col-md-4">
                            <label className="form-label">Tipo de Contrato</label>
                            <div className="form-control-plaintext">
                              <span className={`badge ${
                                usuarioSeleccionado.contrato.tipo === 'indefinido' ? 'bg-success' :
                                usuarioSeleccionado.contrato.tipo === 'extension_2_meses' ? 'bg-info' :
                                'bg-warning text-dark'
                              }`}>
                                {usuarioSeleccionado.contrato.tipo === 'inicial_1_mes' ? 'Inicial (1 mes)' :
                                 usuarioSeleccionado.contrato.tipo === 'extension_2_meses' ? 'Extension (2 meses)' :
                                 'Indefinido'}
                              </span>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Inicio Contrato</label>
                            <div className="form-control-plaintext">
                              {usuarioSeleccionado.contrato.fechaInicioContrato || '-'}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Fin Contrato</label>
                            <div className="form-control-plaintext">
                              {usuarioSeleccionado.contrato.fechaFinContrato || 'Sin fecha fin'}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Estado</label>
                            <div className="form-control-plaintext">
                              <span className={`badge ${
                                usuarioSeleccionado.contrato.estado === 'activo' ? 'bg-success' :
                                usuarioSeleccionado.contrato.estado === 'pendiente_evaluacion' ? 'bg-warning text-dark' :
                                'bg-secondary'
                              }`}>
                                {usuarioSeleccionado.contrato.estado}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert alert-info d-flex align-items-center justify-content-between">
                          <div>
                            <i className="bi bi-info-circle me-2"></i>
                            Este empleado no tiene contrato inicializado.
                          </div>
                          {formData.fechaIngreso && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={async () => {
                                try {
                                  await api.initializeUserContract(usuarioSeleccionado.id, {
                                    fechaIngreso: formData.fechaIngreso
                                  });
                                  showToast('Contrato inicializado correctamente', 'success');
                                  cargarDatos(true);
                                  setShowModal(false);
                                } catch (error) {
                                  showToast(error.response?.data?.message || 'Error al inicializar contrato', 'error');
                                }
                              }}
                            >
                              <i className="bi bi-plus-circle me-1"></i>
                              Inicializar Contrato
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {isAdminRH && (
                    <div className="alert alert-light mt-4 mb-0">
                      <i className="bi bi-info-circle me-2 text-primary"></i>
                      <small>Los campos con <span className="text-danger">*</span> son obligatorios</small>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" onClick={() => setShowModal(false)}>
                    <i className="bi bi-x-circle me-2"></i>
                    {isAdminArea && modoEdicion ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {isAdminRH && (
                    <button className="btn btn-success" onClick={guardarUsuario}>
                      <i className="bi bi-check-circle me-2"></i>
                      {modoEdicion ? 'Actualizar' : 'Crear'} Usuario
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}

export default Usuarios;
