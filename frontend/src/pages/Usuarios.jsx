import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData, ROLES } from '../components/DepartmentBanner';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import '../styles/Usuarios.css';

function Usuarios() {
  const { isAdminRH, isAdminArea, userRole, userDepartamento } = useRoleData();
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
  const [activeTab, setActiveTab] = useState('activos'); // 'activos' o 'ex-empleados'
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [bajaMotivo, setBajaMotivo] = useState('Renuncia Voluntaria');
  const [bajaComentario, setBajaComentario] = useState('');
  const [bajaFecha, setBajaFecha] = useState(new Date().toISOString().split('T')[0]);
  const [usuarioParaBaja, setUsuarioParaBaja] = useState(null);

  const [showExpedienteModal, setShowExpedienteModal] = useState(false);
  const [expedienteUsuario, setExpedienteUsuario] = useState(null);
  const [loadingExpediente, setLoadingExpediente] = useState(false);
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
      (u.email)?.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = !filtroRol || u.role === filtroRol;
    const matchDepto = !filtroDepartamento || u.departamento === filtroDepartamento;
    const matchEstado = filtroEstado === '' ||
      (filtroEstado === 'activo' && u.activo !== false) ||
      (filtroEstado === 'inactivo' && u.activo === false);
    return matchBusqueda && matchRol && matchDepto && matchEstado;
  });

  const usuariosActivos = usuariosFiltrados.filter(u => u.activo !== false);
  const exEmpleados = usuariosFiltrados.filter(u => u.activo === false);
  const usuariosDisplay = activeTab === 'activos' ? usuariosActivos : exEmpleados;

  // Estadísticas
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo !== false).length,
    exEmpleados: usuarios.filter(u => u.activo === false).length,
    admins: usuarios.filter(u => u.role === ROLES.ADMIN_RH || u.role === ROLES.ADMIN_AREA).length
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
      email: usuario.email || '',
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

  const abrirExpediente = async (usuario) => {
    setExpedienteUsuario(usuario);
    setShowExpedienteModal(true);
    setLoadingExpediente(true);
    try {
      // Obtener datos detallados del usuario para asegurar información real completa
      const resp = await api.getUserById(usuario.id);
      const userData = resp.data?.data || resp.data || usuario;
      
      // Combinar con fallbacks para nombres de campos comunes
      let fullData = { 
        ...usuario, 
        ...userData,
        // Normalizar campos que podrían tener nombres distintos en el backend
        departamento: userData.departamento || userData.area || usuario.departamento || usuario.area || '',
        puesto: userData.puesto || userData.cargo || usuario.puesto || usuario.cargo || '',
        fechaIngreso: userData.fechaIngreso || userData.ingreso || usuario.fechaIngreso || usuario.ingreso || '',
        correo: userData.email || userData.email || usuario.email || ''
      };

      // Si es admin, intentar traer también la configuración de nómina para el expediente
      if (isAdminRH) {
        try {
          const payrollResp = await api.getPayrollConfig(usuario.id);
          const payrollData = payrollResp.data?.data || payrollResp.data || {};
          fullData = { ...fullData, ...payrollData };
        } catch (e) {
          console.warn('No se pudo cargar config de nómina para el expediente:', e);
        }
      }
      
      setExpedienteUsuario(fullData);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    } finally {
      setLoadingExpediente(false);
    }
  };

  const generarPDFExpediente = async () => {
    const input = document.getElementById('expediente-content');
    if (!input) return;

    try {
      const canvas = await html2canvas(input, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Expediente_${expedienteUsuario.nombre.replace(/\s+/g, '_')}.pdf`);
      showToast('PDF generado correctamente', 'success');
    } catch (error) {
      console.error('Error generando PDF:', error);
      showToast('Error al generar el PDF', 'error');
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

  const toggleEstado = async (id, estadoActual, nombre, emailActual) => {
    if (estadoActual) {
      // Si está activo y se va a desactivar, abrir modal de baja
      setUsuarioParaBaja({ id, nombre, email: emailActual });
      setBajaFecha(new Date().toISOString().split('T')[0]);
      setShowBajaModal(true);
      return;
    }

    try {
      await api.updateUser(id, { activo: true });
      showToast(`${nombre} reactivado correctamente`, 'success');
      refetchUsers(); // Forzar recarga
    } catch (error) {
      console.error('Error reactivando usuario:', error);
      showToast('Error al reactivar el usuario', 'error');
    }
  };

  const confirmarBaja = async () => {
    try {
      const timestamp = Date.now();
      const payload = { 
        activo: false,
        email: `baja_${timestamp}_${usuarioParaBaja.email}`,
        motivoBaja: bajaMotivo,
        comentarioBaja: bajaComentario,
        fechaBaja: bajaFecha || new Date().toISOString().split('T')[0]
      };

      await api.updateUser(usuarioParaBaja.id, payload);
      showToast(`${usuarioParaBaja.nombre} dado de baja (Correo liberado)`, 'success');
      setShowBajaModal(false);
      setUsuarioParaBaja(null);
      refetchUsers();
    } catch (error) {
      console.error('Error en proceso de baja:', error);
      showToast('Error al procesar la baja', 'error');
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
            <div className="card stat-card border-0 shadow-sm h-100" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('ex-empleados')}>
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-danger bg-opacity-10 text-danger me-3">
                    <i className="bi bi-person-x"></i>
                  </div>
                  <div>
                    <h3 className="mb-0">{stats.exEmpleados}</h3>
                    <small className="text-muted">Ex-empleados</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Estilizados */}
        <div className="card border-0 shadow-sm mb-4 overflow-hidden">
          <div className="card-body p-0">
            <div className="nav nav-tabs nav-fill border-0">
              <button 
                className={`nav-link border-0 py-3 d-flex align-items-center justify-content-center gap-2 ${activeTab === 'activos' ? 'active bg-white text-success border-bottom border-success border-3 fw-bold' : 'bg-light text-muted fw-semibold'}`}
                onClick={() => setActiveTab('activos')}
                style={activeTab === 'activos' ? { borderBottomWidth: '4px !important' } : {}}
              >
                <i className="bi bi-person-check-fill fs-5"></i>
                Empleados Activos
              </button>
              <button 
                className={`nav-link border-0 py-3 d-flex align-items-center justify-content-center gap-2 ${activeTab === 'ex-empleados' ? 'active bg-white text-danger border-bottom border-danger border-3 fw-bold' : 'bg-light text-muted fw-semibold'}`}
                onClick={() => setActiveTab('ex-empleados')}
              >
                <i className="bi bi-person-x-fill fs-5"></i>
                Ex-empleados (Bajas)
              </button>
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
          <span className="text-muted fw-semibold">
            {activeTab === 'activos' ? `Empleados Activos: ${usuariosActivos.length}` : `Ex-empleados (Bajas): ${exEmpleados.length}`}
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
            {usuariosDisplay.map((usuario) => {
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
                            <span className="info-slide-value info-email">{usuario.email}</span>
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
                      
                      {usuario.activo === false && usuario.motivoBaja && (
                        <div className="mt-2 small text-danger fw-bold">
                          <i className="bi bi-info-circle-fill me-1"></i>
                          {usuario.motivoBaja}
                        </div>
                      )}
                    </div>

                    {/* Footer con acciones */}
                    <div className="employee-card-footer">
                      {usuario.activo === false ? (
                        <>
                          <button
                            className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={() => abrirExpediente(usuario)}
                          >
                            <i className="bi bi-file-earmark-pdf"></i>
                            Expediente
                          </button>
                          {isAdminRH && (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => toggleEstado(usuario.id, false, usuario.nombre, usuario.email)}
                              title="Reactivar"
                            >
                              <i className="bi bi-person-plus-fill"></i>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => abrirModalEditar(usuario)}
                            title={isAdminRH ? 'Editar' : 'Ver detalles'}
                          >
                            <i className={`bi ${isAdminRH ? 'bi-pencil' : 'bi-eye'} me-1`}></i>
                            {isAdminRH ? 'Editar' : 'Ver'}
                          </button>
                          {isAdminRH && (
                            <button
                              className={`btn ${usuario.activo !== false ? 'btn-outline-warning' : 'btn-outline-success'}`}
                              onClick={() => toggleEstado(usuario.id, usuario.activo !== false, usuario.nombre, usuario.email)}
                              title={usuario.activo !== false ? 'Desactivar/Baja' : 'Reactivar'}
                            >
                              <i className={`bi ${usuario.activo !== false ? 'bi-person-dash-fill' : 'bi-person-plus-fill'}`}></i>
                            </button>
                          )}
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
                    {usuariosDisplay.map((usuario) => (
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
                        <td>{usuario.email}</td>
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
                                  onClick={() => toggleEstado(usuario.id, usuario.activo !== false, usuario.nombre, usuario.email)}
                                  title={usuario.activo !== false ? 'Dar de Baja' : 'Reactivar'}
                                >
                                  <i className={`bi ${usuario.activo !== false ? 'bi-person-dash' : 'bi-person-plus'}`}></i>
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
                        disabled={isAdminArea && modoEdicion}
                      />
                    </div>
                    {modoEdicion && (
                      <div className="col-md-12 mt-2">
                        <label className="form-label text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                          <i className="bi bi-fingerprint me-1"></i> ID del Empleado (UID)
                        </label>
                        <div className="d-flex align-items-center gap-2">
                          <code className="bg-light p-2 rounded text-secondary border flex-grow-1" style={{ userSelect: 'all' }}>
                            {usuarioSeleccionado?.uid || usuarioSeleccionado?.id}
                          </code>
                        </div>
                      </div>
                    )}
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
                        <option value={ROLES.ADMIN_AREA}>Admin de Área</option>
                        <option value={ROLES.ADMIN_RH}>Admin RH</option>
                        {/* Solo super_admin puede ver/asignar roles superiores */}
                        {userRole === ROLES.SUPER_ADMIN && (
                          <>
                            <option value={ROLES.DIRECTOR}>Director</option>
                            <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
                          </>
                        )}
                      </select>
                      {formData.role === ROLES.ADMIN_AREA && (
                        <small className="text-muted">Administra solo su departamento</small>
                      )}
                      {formData.role === ROLES.ADMIN_RH && (
                        <small className="text-warning"><i className="bi bi-exclamation-triangle me-1"></i>Gestión de RH y ausencias</small>
                      )}
                      {formData.role === ROLES.DIRECTOR && (
                        <small className="text-danger"><i className="bi bi-shield-exclamation me-1"></i>Acceso total excepto Configuración</small>
                      )}
                      {formData.role === ROLES.SUPER_ADMIN && (
                        <small className="text-danger fw-bold"><i className="bi bi-shield-fill-exclamation me-1"></i>Acceso total al sistema ⚠️</small>
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

        {/* Boton Expediente solo en edicion */}
                  {modoEdicion && (
                    <div className="mt-4 pt-4 border-top">
                      <div className="d-flex align-items-center justify-content-between bg-light p-3 rounded-3">
                        <div>
                          <h6 className="mb-0 fw-bold text-dark">Expediente Digital</h6>
                          <small className="text-muted">Generar reporte detallado en PDF</small>
                        </div>
                        <button 
                          className="btn btn-primary d-flex align-items-center gap-2 px-4 shadow-sm"
                          onClick={() => abrirExpediente(usuarioSeleccionado)}
                        >
                          <i className="bi bi-file-earmark-pdf fs-5"></i>
                          Ver Expediente
                        </button>
                      </div>
                    </div>
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

        {/* Modal Motivo de Baja */}
        {showBajaModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-person-x-fill me-2"></i>
                    Confirmar Baja de Empleado
                  </h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowBajaModal(false)}></button>
                </div>
                <div className="modal-body py-4">
                  <div className="text-center mb-4">
                    <div className="display-6 text-danger mb-2">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h5 className="fw-bold">¿Dar de baja a {usuarioParaBaja?.nombre}?</h5>
                    <p className="text-muted">El correo actual será liberado para futuros usos.</p>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Motivo de la Baja</label>
                    <select 
                      className="form-select"
                      value={bajaMotivo}
                      onChange={(e) => setBajaMotivo(e.target.value)}
                    >
                      <option value="Renuncia Voluntaria">Renuncia Voluntaria</option>
                      <option value="Despido con Causa">Despido con Causa</option>
                      <option value="Despido sin Causa">Despido sin Causa</option>
                      <option value="Fin de Contrato">Fin de Contrato</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Fecha Efectiva de Baja</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={bajaFecha}
                      onChange={(e) => setBajaFecha(e.target.value)}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="form-label fw-bold">Comentarios Adicionales</label>
                    <textarea 
                      className="form-control"
                      rows="3"
                      placeholder="Observaciones sobre la baja..."
                      value={bajaComentario}
                      onChange={(e) => setBajaComentario(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button className="btn btn-outline-secondary" onClick={() => setShowBajaModal(false)}>Cancelar</button>
                  <button className="btn btn-danger px-4" onClick={confirmarBaja}>
                    Confirmar Baja Definitiva
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Expediente PDF */}
        {showExpedienteModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1070 }}>
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
              <div className="modal-content border-0">
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '12px 20px', 
                  background: '#212529', 
                  color: 'white',
                  gap: '12px'
                }}>
                  <i className="bi bi-file-pdf-fill text-danger fs-4"></i>
                  <span className="fw-semibold fs-5 flex-grow-1">Vista Previa de Expediente</span>
                  <button 
                    className="btn btn-success d-flex align-items-center gap-2" 
                    onClick={generarPDFExpediente}
                    style={{ height: '36px', whiteSpace: 'nowrap' }}
                  >
                    <i className="bi bi-download"></i> 
                    <span className="fw-semibold">Descargar PDF</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowExpedienteModal(false);
                      setExpedienteUsuario(null);
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'white', 
                      fontSize: '1.2rem', 
                      cursor: 'pointer',
                      lineHeight: '1',
                      padding: '4px 8px',
                      opacity: 0.8
                    }}
                    title="Cerrar"
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body p-0 bg-secondary bg-opacity-10">
                  {loadingExpediente ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 text-muted">Generando vista previa...</p>
                    </div>
                  ) : (
                    <div className="d-flex justify-content-center p-4">
                      <div 
                        id="expediente-content" 
                        className="bg-white shadow-lg p-5" 
                        style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}
                      >
                        {/* Header PDF */}
                        <div className="d-flex justify-content-between align-items-center mb-5 border-bottom pb-4">
                          <div>
                            <h2 className="text-success fw-bold mb-0">CIELITO HOME</h2>
                            <p className="text-muted small mb-0">SISTEMA INTEGRAL DE RECURSOS HUMANOS</p>
                          </div>
                          <div className="text-end text-muted">
                            <h5 className="mb-0 fw-bold text-dark">EXPEDIENTE DE EMPLEADO</h5>
                            <small>Fecha de Emisión: {new Date().toLocaleDateString()}</small>
                          </div>
                        </div>

                        {/* Foto y Datos Principales */}
                        <div className="row mb-5">
                          <div className="col-4">
                            <div className="bg-light d-flex align-items-center justify-content-center border" style={{ height: '180px', borderRadius: '12px' }}>
                              <i className="bi bi-person text-muted display-1"></i>
                            </div>
                          </div>
                          <div className="col-8">
                            <h3 className="fw-bold text-dark mb-1">{expedienteUsuario?.nombre}</h3>
                            <h5 className="text-success mb-3">{(expedienteUsuario?.puesto || 'Empleado').trim() || 'Empleado'}</h5>
                            
                            <div className="row g-3">
                              <div className="col-6">
                                <small className="text-muted d-block fw-bold text-uppercase">Departamento</small>
                                <span className="text-dark fw-semibold">{expedienteUsuario?.departamento?.trim() || '-'}</span>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block fw-bold text-uppercase">Fecha de Ingreso</small>
                                <span className="text-dark fw-semibold">{expedienteUsuario?.fechaIngreso?.trim() || '-'}</span>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block fw-bold text-uppercase">ID de Empleado</small>
                                <span className="text-dark fw-semibold">#{expedienteUsuario?.id?.substring(0,8) || '-'}</span>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block fw-bold text-uppercase">Estatus</small>
                                <div>
                                  <span className={expedienteUsuario?.activo ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                                    {expedienteUsuario?.activo ? 'ACTIVO' : 'BAJA'}
                                  </span>
                                  {!expedienteUsuario?.activo && expedienteUsuario?.fechaBaja && (
                                    <small className="text-danger d-block mt-1">
                                      Fecha de Baja: {expedienteUsuario.fechaBaja}
                                    </small>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bloques de Información */}
                        <div className="row mb-4">
                          <div className="col-12">
                            <h6 className="bg-light p-2 fw-bold border-start border-success border-4 mb-3">INFORMACIÓN DE CONTACTO</h6>
                            <div className="row g-4 ps-2">
                              <div className="col-4">
                                <small className="text-muted d-block">Correo Electrónico</small>
                                <strong className="text-dark text-break">{(expedienteUsuario?.email || '').trim() || '-'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Teléfono Celular</small>
                                <strong className="text-dark">{expedienteUsuario?.telefono?.trim() || '-'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Dirección Residencia</small>
                                <strong className="text-dark">{expedienteUsuario?.direccion?.trim() || '-'}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="row mb-4">
                          <div className="col-12">
                            <h6 className="bg-light p-2 fw-bold border-start border-success border-4 mb-3">INFORMACIÓN PERSONAL</h6>
                            <div className="row g-4 ps-2">
                              <div className="col-4">
                                <small className="text-muted d-block">Fecha Nacimiento</small>
                                <strong className="text-dark">{expedienteUsuario?.fechaNacimiento?.trim() || '-'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Contacto Emergencia</small>
                                <strong className="text-dark">{expedienteUsuario?.contactoEmergencia?.trim() || '-'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Teléfono Emergencia</small>
                                <strong className="text-dark">{expedienteUsuario?.contactoEmergenciaTelefono?.trim() || '-'}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Nueva Sección: Información Laboral */}
                        <div className="row mb-4">
                          <div className="col-12">
                            <h6 className="bg-light p-2 fw-bold border-start border-success border-4 mb-3">INFORMACIÓN LABORAL</h6>
                            <div className="row g-4 ps-2">
                              <div className="col-4">
                                <small className="text-muted d-block">Rol en Sistema</small>
                                <strong className="text-dark text-uppercase">{expedienteUsuario?.role?.trim() || 'EMPLEADO'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Salario Base</small>
                                <strong className="text-dark">
                                  {expedienteUsuario?.salarioBase ? `$${Number(expedienteUsuario.salarioBase).toLocaleString()} MXN` : '-'}
                                </strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Seguro Social (IMSS)</small>
                                <strong className="text-dark">{expedienteUsuario?.tieneIMSS ? 'SÍ' : 'NO'}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Nueva Sección: Nómina y Banco */}
                        <div className="row mb-4">
                          <div className="col-12">
                            <h6 className="bg-light p-2 fw-bold border-start border-success border-4 mb-3">INFORMACIÓN DE NÓMINA Y BANCARIA</h6>
                            <div className="row g-4 ps-2 pb-2">
                              <div className="col-4">
                                <small className="text-muted d-block">Tipo de Nómina</small>
                                <strong className="text-dark text-capitalize">{expedienteUsuario?.tipoNomina?.trim() || 'Desconocido'}</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Horas por Período</small>
                                <strong className="text-dark">{expedienteUsuario?.horasQuincenal || '-'} hrs</strong>
                              </div>
                              <div className="col-4">
                                <small className="text-muted d-block">Caja de Ahorro</small>
                                <strong className="text-dark">
                                  {expedienteUsuario?.tieneCajaAhorro 
                                    ? `SÍ ($${Number(expedienteUsuario?.montoCajaAhorro || 0).toLocaleString()} MXN)` 
                                    : 'NO'}
                                </strong>
                              </div>
                            </div>
                            <div className="row g-4 ps-2 mt-0">
                              <div className="col-4">
                                <small className="text-muted d-block">Nombre del Banco</small>
                                <strong className="text-dark text-uppercase">{expedienteUsuario?.nombreBanco?.trim() || '-'}</strong>
                              </div>
                              <div className="col-8">
                                <small className="text-muted d-block">Cuenta Bancaria / CLABE</small>
                                <strong className="text-dark">{expedienteUsuario?.cuentaBancaria?.trim() || '-'}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Firmas al Final */}
                        <div className="mt-auto pt-5">
                          <div className="row text-center mt-5">
                            <div className="col-6">
                              <div className="border-top mx-4 mt-5 pt-2">
                                <small className="text-muted text-uppercase fw-bold">Firma del Empleado</small>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="border-top mx-4 mt-5 pt-2">
                                <small className="text-muted text-uppercase fw-bold">Validación Recursos Humanos</small>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-center mt-5 pt-4 border-top">
                            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                              * Este documento y la información contenida en el sistema permanecerá en resguardo por un periodo de <strong>2 años</strong> a partir de la fecha de baja para fines de aclaraciones legales o referencias laborales.
                            </small>
                            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                              Generado por Cielito Home SIRH - Emisión: {new Date().toLocaleString()}
                            </small>
                          </div>
                        </div>

                        {/* Footer Logo Background */}
                        <div style={{ position: 'absolute', bottom: '20px', right: '30px', opacity: 0.1, fontSize: '3rem', fontWeight: 'bold' }}>
                          CIELITO HOME
                        </div>
                      </div>
                    </div>
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
