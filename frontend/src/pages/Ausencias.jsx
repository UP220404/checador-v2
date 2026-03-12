import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import '../styles/Ausencias.css';

function Ausencias() {
  const { departmentFilter } = useRoleData();

  const [ausencias, setAusencias] = useState([]);
  const [ausenciasFiltradas, setAusenciasFiltradas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetallesModal, setShowDetallesModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [ausenciaSeleccionada, setAusenciaSeleccionada] = useState(null);

  // Sistema de notificaciones Toast
  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  // Obtener mes actual en formato YYYY-MM
  const obtenerMesActual = () => {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  };

  // Filtros - Inicializar con mes actual
  const [filtros, setFiltros] = useState({
    anio: new Date().getFullYear(),
    mes: obtenerMesActual(),
    estado: '',
    tipo: '',
    busqueda: '',
    soloUrgentes: false
  });

  // Estadísticas
  const [stats, setStats] = useState({
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    total: 0,
    urgentes: 0
  });

  // Formulario nueva ausencia
  const [formData, setFormData] = useState({
    userId: '',
    tipo: 'permiso',
    fechaInicio: '',
    fechaFin: '',
    motivo: '',
    observaciones: ''
  });

  const { data: allUsuarios = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.getUsers();
      return response.data?.data || [];
    }
  });

  const usuarios = departmentFilter 
    ? allUsuarios.filter(u => u.departamento === departmentFilter) 
    : allUsuarios;

  useEffect(() => {
    aplicarFiltros();
  }, [filtros, ausencias]);

  useEffect(() => {
    cargarAusencias();
  }, [filtros.mes]);

  const cargarAusencias = async () => {
    try {
      setLoading(true);

      // Extraer año y mes del filtro
      const [anio, mes] = filtros.mes.split('-').map(Number);

      console.log('[Ausencias] Cargando ausencias para:', { mes, anio });

      // Llamar al endpoint de ausencias con parámetros de mes y año
      const response = await api.getAbsences({ mes, anio });

      console.log('[Ausencias] Respuesta recibida:', response.data);

      if (response.data.success) {
        let ausenciasData = response.data.data || [];

        // Filtrar por departamento si es admin_area
        if (departmentFilter) {
          ausenciasData = ausenciasData.filter(a => a.departamentoUsuario === departmentFilter);
        }

        console.log('[Ausencias] Ausencias cargadas:', ausenciasData.length);
        setAusencias(ausenciasData);
        calcularEstadisticas(ausenciasData);
      } else {
        console.warn('[Ausencias] Respuesta sin éxito:', response.data);
        showToast('No se pudieron cargar las ausencias', 'warning');
      }
    } catch (error) {
      console.error('[Ausencias] Error cargando ausencias:', error);
      console.error('[Ausencias] Error details:', error.response?.data || error.message);
      showToast(`Error al cargar ausencias: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (ausenciasData) => {
    const stats = {
      pendientes: ausenciasData.filter(a => a.estado === 'pendiente').length,
      aprobadas: ausenciasData.filter(a => a.estado === 'aprobado' || a.estado === 'aprobada').length,
      rechazadas: ausenciasData.filter(a => a.estado === 'rechazado' || a.estado === 'rechazada').length,
      total: ausenciasData.length,
      urgentes: ausenciasData.filter(a =>
        a.estado === 'pendiente' && (a.esEmergencia || a.requiereRevisionUrgente)
      ).length
    };
    setStats(stats);
  };

  const aplicarFiltros = () => {
    let filtered = [...ausencias];

    // No filtrar por mes aquí, ya viene filtrado del backend

    if (filtros.estado) {
      filtered = filtered.filter(a => a.estado === filtros.estado);
    }

    if (filtros.tipo) {
      filtered = filtered.filter(a => a.tipo === filtros.tipo);
    }

    if (filtros.busqueda) {
      filtered = filtered.filter(a =>
        a.nombreUsuario?.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
        a.email?.toLowerCase().includes(filtros.busqueda.toLowerCase())
      );
    }

    // Filtro de urgentes
    if (filtros.soloUrgentes) {
      filtered = filtered.filter(a =>
        a.estado === 'pendiente' && (a.esEmergencia || a.requiereRevisionUrgente)
      );
    }

    setAusenciasFiltradas(filtered);
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
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
      userId: '',
      tipo: 'permiso',
      fechaInicio: '',
      fechaFin: '',
      motivo: '',
      observaciones: ''
    });
    setShowModal(true);
  };

  const abrirModalEditar = (ausencia) => {
    setModoEdicion(true);
    setAusenciaSeleccionada(ausencia);
    setFormData({
      userId: ausencia.userId,
      tipo: ausencia.tipo,
      fechaInicio: ausencia.fechaInicio,
      fechaFin: ausencia.fechaFin || ausencia.fechaInicio,
      motivo: ausencia.motivo || '',
      observaciones: ausencia.observaciones || ''
    });
    setShowModal(true);
  };

  const abrirModalDetalles = (ausencia) => {
    setAusenciaSeleccionada(ausencia);
    setShowDetallesModal(true);
  };

  const guardarAusencia = async () => {
    try {
      // Validar campos requeridos
      if (!modoEdicion && !formData.userId) {
        showToast('Por favor seleccione un empleado', 'warning');
        return;
      }
      if (!formData.tipo || !formData.fechaInicio || !formData.motivo) {
        showToast('Por favor complete todos los campos obligatorios', 'warning');
        return;
      }

      // Obtener datos del usuario seleccionado
      const usuarioSeleccionado = usuarios.find(u => u.uid === formData.userId);

      const dataToSend = {
        ...formData,
        emailUsuario: usuarioSeleccionado?.correo || ausenciaSeleccionada?.emailUsuario,
        nombreUsuario: usuarioSeleccionado?.nombre || ausenciaSeleccionada?.nombreUsuario
      };

      if (modoEdicion) {
        await api.updateAbsence(ausenciaSeleccionada.id, dataToSend);
      } else {
        await api.createAbsence(dataToSend);
      }

      setShowModal(false);
      cargarAusencias();
      showToast(`Ausencia ${modoEdicion ? 'actualizada' : 'creada'} exitosamente`, 'success');
    } catch (error) {
      console.error('Error guardando ausencia:', error);
      showToast('Error al guardar la ausencia: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      if (nuevoEstado === 'aprobado') {
        await api.approveAbsence(id);
      } else if (nuevoEstado === 'rechazado') {
        await api.rejectAbsence(id);
      }

      cargarAusencias();
      showToast(`Ausencia ${nuevoEstado} correctamente`, 'success');
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showToast('Error al cambiar el estado', 'error');
    }
  };

  const eliminarAusencia = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta ausencia?')) return;

    try {
      await api.deleteAbsence(id);
      cargarAusencias();
      showToast('Ausencia eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error eliminando ausencia:', error);
      showToast('Error al eliminar la ausencia', 'error');
    }
  };

  const generarReportePDF = async () => {
    try {
      showToast('Generando reporte PDF...', 'info');

      // Extraer año y mes del filtro actual
      const [anio, mes] = filtros.mes.split('-').map(Number);

      const response = await api.exportAbsencesPDF({
        mes,
        anio
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_ausencias_${mes}_${anio}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Reporte PDF descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando PDF:', error);
      showToast('Error al generar el reporte PDF', 'error');
    }
  };

  // Convierte cualquier formato de fecha (string ISO, Timestamp Firestore, Date) a Date válido
  const parseFecha = (fecha) => {
    if (!fecha) return null;
    if (fecha instanceof Date) return fecha;
    // Timestamp de Firestore serializado: { _seconds, _nanoseconds } o { seconds, nanoseconds }
    if (typeof fecha === 'object' && (fecha._seconds !== undefined || fecha.seconds !== undefined)) {
      return new Date((fecha._seconds ?? fecha.seconds) * 1000);
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatFecha = (fecha, opciones = {}) => {
    const d = parseFecha(fecha);
    if (!d) return 'N/A';
    return opciones.conHora
      ? d.toLocaleString('es-MX')
      : d.toLocaleDateString('es-MX');
  };

  const obtenerBadgeEstado = (estado) => {
    const badges = {
      pendiente: 'bg-warning',
      aprobado: 'bg-success',
      aprobada: 'bg-success',
      rechazado: 'bg-danger',
      rechazada: 'bg-danger'
    };
    return badges[estado] || 'bg-secondary';
  };

  const obtenerTextoEstado = (estado) => {
    const textos = {
      pendiente: 'Pendiente',
      aprobado: 'Aprobada',
      aprobada: 'Aprobada',
      rechazado: 'Rechazada',
      rechazada: 'Rechazada'
    };
    return textos[estado] || estado;
  };

  const obtenerIconoTipo = (tipo) => {
    const iconos = {
      permiso: 'bi-envelope-paper',
      justificante: 'bi-file-earmark-text',
      vacaciones: 'bi-calendar-heart',
      incapacidad: 'bi-hospital',
      viaje_negocios: 'bi-airplane',
      retardo_justificado: 'bi-clock-history'
    };
    return iconos[tipo] || 'bi-question-circle';
  };

  // Generar lista de años disponibles (desde 2024 hasta año actual)
  const generarListaAnios = () => {
    const anios = [];
    const anioInicio = 2024;
    const anioActual = new Date().getFullYear();

    for (let anio = anioActual; anio >= anioInicio; anio--) {
      anios.push(anio);
    }

    return anios;
  };

  // Generar lista de meses del año seleccionado
  const generarListaMeses = (anio) => {
    const meses = [];
    const nombresMeses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const hoy = new Date();
    const mesActual = hoy.getMonth(); // 0-11
    const anioActual = hoy.getFullYear();

    // Determinar qué meses mostrar según el año
    const primerMes = (anio === 2024) ? 6 : 0; // Julio 2024 o Enero para otros años
    const ultimoMes = (anio === anioActual) ? mesActual : 11;

    for (let mes = primerMes; mes <= ultimoMes; mes++) {
      const mesStr = String(mes + 1).padStart(2, '0');
      meses.push({
        value: `${anio}-${mesStr}`,
        label: nombresMeses[mes]
      });
    }

    return meses.reverse(); // Mostrar del más reciente al más antiguo
  };

  const anios = generarListaAnios();
  const meses = generarListaMeses(filtros.anio);

  return (
    <AdminLayout>
      <div className="section-header">
        <h2>
          <i className="bi bi-envelope-paper me-2"></i>
          Gestion de Ausencias
        </h2>
        <div>
          <button className="btn btn-danger me-2" onClick={generarReportePDF}>
            <i className="bi bi-file-earmark-pdf me-2"></i>
            Generar Reporte PDF
          </button>
          <button className="btn btn-primary" onClick={abrirModalNuevo}>
            <i className="bi bi-plus-circle me-2"></i>
            Nueva Ausencia
          </button>
        </div>
      </div>

      {/* Banner de departamento para admin_area */}
      <DepartmentBanner />

      {/* Estadisticas */}
      <div className="row mb-4 g-3">
        <div className="col-6 col-md">
          <div className="card text-center p-3 stat-card">
            <div className="text-warning mb-2">
              <i className="bi bi-clock-history" style={{ fontSize: '2rem' }}></i>
            </div>
            <h5>{stats.pendientes}</h5>
            <small className="text-muted">Pendientes</small>
          </div>
        </div>
        <div className="col-6 col-md">
          <div
            className={`card text-center p-3 stat-card ${filtros.soloUrgentes ? 'border-danger border-2' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => handleFiltroChange('soloUrgentes', !filtros.soloUrgentes)}
            title="Click para filtrar urgentes"
          >
            <div className="text-danger mb-2">
              <i className="bi bi-lightning-fill" style={{ fontSize: '2rem' }}></i>
            </div>
            <h5>{stats.urgentes}</h5>
            <small className="text-muted">Urgentes</small>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card text-center p-3 stat-card">
            <div className="text-success mb-2">
              <i className="bi bi-check-circle" style={{ fontSize: '2rem' }}></i>
            </div>
            <h5>{stats.aprobadas}</h5>
            <small className="text-muted">Aprobadas</small>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card text-center p-3 stat-card">
            <div className="text-secondary mb-2">
              <i className="bi bi-x-circle" style={{ fontSize: '2rem' }}></i>
            </div>
            <h5>{stats.rechazadas}</h5>
            <small className="text-muted">Rechazadas</small>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card text-center p-3 stat-card">
            <div className="text-info mb-2">
              <i className="bi bi-calendar-check" style={{ fontSize: '2rem' }}></i>
            </div>
            <h5>{stats.total}</h5>
            <small className="text-muted">Total</small>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-bar mb-3 p-3 rounded-3 shadow-sm">
        <div className="row g-2">
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">
              <i className="bi bi-calendar3 me-1"></i>
              Año
            </label>
            <select
              className="form-select"
              value={filtros.anio}
              onChange={(e) => {
                const nuevoAnio = parseInt(e.target.value);
                const mesesNuevoAnio = generarListaMeses(nuevoAnio);
                handleFiltroChange('anio', nuevoAnio);
                // Actualizar al primer mes disponible del nuevo año
                if (mesesNuevoAnio.length > 0) {
                  handleFiltroChange('mes', mesesNuevoAnio[0].value);
                }
              }}
            >
              {anios.map(anio => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">
              <i className="bi bi-calendar-month me-1"></i>
              Mes
            </label>
            <select
              className="form-select"
              value={filtros.mes}
              onChange={(e) => handleFiltroChange('mes', e.target.value)}
            >
              {meses.map(mes => (
                <option key={mes.value} value={mes.value}>{mes.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted mb-1">
              <i className="bi bi-filter me-1"></i>
              Estado
            </label>
            <select
              className="form-select"
              value={filtros.estado}
              onChange={(e) => handleFiltroChange('estado', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobadas</option>
              <option value="rechazado">Rechazadas</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">
              <i className="bi bi-tag me-1"></i>
              Tipo
            </label>
            <select
              className="form-select"
              value={filtros.tipo}
              onChange={(e) => handleFiltroChange('tipo', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="permiso">Permisos</option>
              <option value="justificante">Justificantes</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="incapacidad">Incapacidades</option>
              <option value="viaje_negocios">Viaje de Negocios</option>
              <option value="retardo_justificado">Retardo Justificado</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted mb-1">
              <i className="bi bi-search me-1"></i>
              Buscar usuario
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Nombre o email..."
              value={filtros.busqueda}
              onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabla de Ausencias */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="table-responsive rounded-3 shadow-sm">
          <table className="table table-hover align-middle">
            <thead className="table-success">
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Fecha(s)</th>
                <th className="text-center">Días</th>
                <th className="text-center">Anticipación</th>
                <th className="text-center">Estado</th>
                <th>Solicitado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ausenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    <i className="bi bi-inbox display-4"></i>
                    <p className="mt-2">No hay ausencias registradas</p>
                  </td>
                </tr>
              ) : (
                ausenciasFiltradas.map((ausencia, index) => (
                  <tr key={index} className={ausencia.esEmergencia ? 'table-danger' : ausencia.requiereRevisionUrgente ? 'table-warning' : ''}>
                    <td>
                      <i className="bi bi-person-circle me-2"></i>
                      {ausencia.nombreUsuario || ausencia.email}
                    </td>
                    <td>
                      <i className={`bi ${obtenerIconoTipo(ausencia.tipo)} me-2`}></i>
                      {ausencia.tipo}
                    </td>
                    <td>
                      {ausencia.fechaInicio}
                      {ausencia.fechaFin && ausencia.fechaFin !== ausencia.fechaInicio && (
                        <> - {ausencia.fechaFin}</>
                      )}
                    </td>
                    <td className="text-center">{ausencia.diasJustificados || 1}</td>
                    <td className="text-center">
                      {ausencia.diasAnticipacion !== undefined ? (
                        <span className={`badge ${ausencia.diasAnticipacion < 15 ? 'bg-warning text-dark' : 'bg-light text-dark'}`}>
                          {ausencia.diasAnticipacion} días
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-center">
                      <div className="d-flex flex-column align-items-center gap-1">
                        {ausencia.esEmergencia && (
                          <span className="badge bg-danger" title={ausencia.motivoEmergencia || 'Emergencia'}>
                            <i className="bi bi-lightning-fill me-1"></i>
                            Emergencia
                          </span>
                        )}
                        {!ausencia.esEmergencia && ausencia.requiereRevisionUrgente && (
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-clock me-1"></i>
                            Sin anticipación
                          </span>
                        )}
                        <span className={`badge ${obtenerBadgeEstado(ausencia.estado)}`}>
                          {obtenerTextoEstado(ausencia.estado)}
                        </span>
                      </div>
                    </td>
                    <td>{formatFecha(ausencia.fechaCreacion) !== 'N/A' ? formatFecha(ausencia.fechaCreacion) : '-'}</td>
                    <td>
                      <div className="ausencia-acciones">
                        {ausencia.estado === 'pendiente' && (
                          <div className="acciones-principales">
                            <button
                              className="btn-accion btn-aprobar"
                              onClick={() => cambiarEstado(ausencia.id, 'aprobado')}
                              title="Aprobar solicitud"
                            >
                              <i className="bi bi-check-circle-fill"></i>
                              Aprobar
                            </button>
                            <button
                              className="btn-accion btn-rechazar"
                              onClick={() => cambiarEstado(ausencia.id, 'rechazado')}
                              title="Rechazar solicitud"
                            >
                              <i className="bi bi-x-circle-fill"></i>
                              Rechazar
                            </button>
                          </div>
                        )}
                        <div className="acciones-secundarias">
                          <button
                            className="btn-accion-sm btn-ver"
                            onClick={() => abrirModalDetalles(ausencia)}
                            title="Ver detalles"
                          >
                            <i className="bi bi-eye-fill"></i>
                          </button>
                          <button
                            className="btn-accion-sm btn-editar"
                            onClick={() => abrirModalEditar(ausencia)}
                            title="Editar"
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            className="btn-accion-sm btn-eliminar"
                            onClick={() => eliminarAusencia(ausencia.id)}
                            title="Eliminar"
                          >
                            <i className="bi bi-trash-fill"></i>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nueva/Editar Ausencia - Diseño Mejorado */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom modal-ausencia-mejorado" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div className="modal-icon-header">
                <i className="bi bi-calendar-plus-fill"></i>
              </div>
              <div className="modal-title-group">
                <h4 className="modal-title-main">{modoEdicion ? 'Editar Ausencia' : 'Nueva Ausencia'}</h4>
                <p className="modal-subtitle">Complete los datos de la solicitud</p>
              </div>
              <button className="btn-close-custom" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body-custom">
              {/* Selector de Usuario */}
              {!modoEdicion && (
                <div className="form-group-custom mb-4">
                  <label className="form-label-custom">
                    <i className="bi bi-person-fill me-2"></i>
                    Empleado
                  </label>
                  <select
                    className="form-control-custom"
                    value={formData.userId}
                    onChange={(e) => handleFormChange('userId', e.target.value)}
                    required
                  >
                    <option value="">Seleccione un empleado...</option>
                    {usuarios.map(user => (
                      <option key={user.uid} value={user.uid}>
                        {user.nombre} - {user.correo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tipo de Ausencia con Iconos */}
              <div className="form-group-custom mb-4">
                <label className="form-label-custom">
                  <i className="bi bi-bookmark-fill me-2"></i>
                  Tipo de Ausencia
                </label>
                <select
                  className="form-control-custom"
                  value={formData.tipo}
                  onChange={(e) => handleFormChange('tipo', e.target.value)}
                >
                  <option value="permiso">📋 Permiso</option>
                  <option value="justificante">📄 Justificante</option>
                  <option value="vacaciones">🏖️ Vacaciones</option>
                  <option value="incapacidad">🏥 Incapacidad</option>
                  <option value="viaje_negocios">✈️ Viaje de Negocios</option>
                  <option value="retardo_justificado">⏰ Retardo Justificado</option>
                </select>
                <small className="form-text-helper">Seleccione el tipo de ausencia que mejor describe la solicitud</small>
              </div>

              {/* Fechas */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="form-group-custom">
                    <label className="form-label-custom">
                      <i className="bi bi-calendar-event me-2"></i>
                      Fecha de Inicio
                    </label>
                    <input
                      type="date"
                      className="form-control-custom"
                      value={formData.fechaInicio}
                      onChange={(e) => handleFormChange('fechaInicio', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group-custom">
                    <label className="form-label-custom">
                      <i className="bi bi-calendar-check me-2"></i>
                      Fecha de Fin
                    </label>
                    <input
                      type="date"
                      className="form-control-custom"
                      value={formData.fechaFin}
                      onChange={(e) => handleFormChange('fechaFin', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Motivo */}
              <div className="form-group-custom mb-4">
                <label className="form-label-custom">
                  <i className="bi bi-chat-left-text-fill me-2"></i>
                  Motivo de la Ausencia
                </label>
                <textarea
                  className="form-control-custom"
                  rows="4"
                  placeholder="Describa brevemente el motivo de la ausencia..."
                  value={formData.motivo}
                  onChange={(e) => handleFormChange('motivo', e.target.value)}
                  required
                ></textarea>
              </div>

              {/* Observaciones */}
              <div className="form-group-custom">
                <label className="form-label-custom">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Observaciones (Opcional)
                </label>
                <textarea
                  className="form-control-custom"
                  rows="3"
                  placeholder="Información adicional o comentarios..."
                  value={formData.observaciones}
                  onChange={(e) => handleFormChange('observaciones', e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="modal-footer-custom">
              <button className="btn-cancel-custom" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-circle me-2"></i>
                Cancelar
              </button>
              <button className="btn-save-custom" onClick={guardarAusencia}>
                <i className="bi bi-check-circle-fill me-2"></i>
                Guardar Ausencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalles - Diseño Bonito */}
      {showDetallesModal && ausenciaSeleccionada && (
        <div className="modal-overlay" onClick={() => setShowDetallesModal(false)}>
          <div className="modal-content-custom modal-detalles-ausencia" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom bg-gradient-info">
              <div className="modal-icon-header">
                <i className="bi bi-file-text-fill"></i>
              </div>
              <div className="modal-title-group">
                <h4 className="modal-title-main">Detalles de la Ausencia</h4>
                <p className="modal-subtitle">Información completa del registro</p>
              </div>
              <button className="btn-close-custom" onClick={() => setShowDetallesModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body-custom modal-detalles-body">
              {/* Sección: Información del Usuario */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-person-circle me-2"></i>
                  <h5>Información del Empleado</h5>
                </div>
                <div className="detalle-grid">
                  <div className="detalle-item">
                    <span className="detalle-label">Nombre:</span>
                    <span className="detalle-value">{ausenciaSeleccionada.nombreUsuario || 'N/A'}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Email:</span>
                    <span className="detalle-value">{ausenciaSeleccionada.emailUsuario || ausenciaSeleccionada.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Sección: Información de la Ausencia */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className={`bi ${obtenerIconoTipo(ausenciaSeleccionada.tipo)} me-2`}></i>
                  <h5>Información de la Ausencia</h5>
                </div>
                <div className="detalle-grid">
                  <div className="detalle-item">
                    <span className="detalle-label">Tipo:</span>
                    <span className="detalle-value detalle-tipo">
                      <i className={`bi ${obtenerIconoTipo(ausenciaSeleccionada.tipo)} me-2`}></i>
                      {ausenciaSeleccionada.tipo}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Estado:</span>
                    <span className={`badge ${obtenerBadgeEstado(ausenciaSeleccionada.estado)} detalle-badge`}>
                      {obtenerTextoEstado(ausenciaSeleccionada.estado)}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Fecha de Inicio:</span>
                    <span className="detalle-value">{ausenciaSeleccionada.fechaInicio}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Fecha de Fin:</span>
                    <span className="detalle-value">{ausenciaSeleccionada.fechaFin || ausenciaSeleccionada.fechaInicio}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Días Justificados:</span>
                    <span className="detalle-value detalle-dias">{ausenciaSeleccionada.diasJustificados || 1} día(s)</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Fecha de Solicitud:</span>
                    <span className="detalle-value">{formatFecha(ausenciaSeleccionada.fechaCreacion, { conHora: true })}</span>
                  </div>
                </div>
              </div>

              {/* Sección: Motivo */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-chat-left-text me-2"></i>
                  <h5>Motivo</h5>
                </div>
                <div className="detalle-description">
                  {ausenciaSeleccionada.motivo || 'No especificado'}
                </div>
              </div>

              {/* Sección: Observaciones (si existen) */}
              {ausenciaSeleccionada.observaciones && (
                <div className="detalle-section">
                  <div className="detalle-section-header">
                    <i className="bi bi-info-circle me-2"></i>
                    <h5>Observaciones</h5>
                  </div>
                  <div className="detalle-description">
                    {ausenciaSeleccionada.observaciones}
                  </div>
                </div>
              )}

              {/* Sección: Comentarios del Admin (si existen) */}
              {ausenciaSeleccionada.comentariosAdmin && (
                <div className="detalle-section">
                  <div className="detalle-section-header">
                    <i className="bi bi-shield-check me-2"></i>
                    <h5>Comentarios del Administrador</h5>
                  </div>
                  <div className="detalle-description detalle-admin-comment">
                    {ausenciaSeleccionada.comentariosAdmin}
                  </div>
                </div>
              )}

              {/* Sección: Información de Quincena */}
              {ausenciaSeleccionada.quincena && (
                <div className="detalle-section">
                  <div className="detalle-section-header">
                    <i className="bi bi-calendar2-week me-2"></i>
                    <h5>Información de Nómina</h5>
                  </div>
                  <div className="detalle-grid">
                    <div className="detalle-item">
                      <span className="detalle-label">Quincena:</span>
                      <span className="detalle-value">
                        {ausenciaSeleccionada.quincena.periodo} - {ausenciaSeleccionada.quincena.mes}/{ausenciaSeleccionada.quincena.anio}
                      </span>
                    </div>
                    <div className="detalle-item">
                      <span className="detalle-label">Aplicada en Nómina:</span>
                      <span className={`badge ${ausenciaSeleccionada.aplicadaEnNomina ? 'bg-success' : 'bg-secondary'}`}>
                        {ausenciaSeleccionada.aplicadaEnNomina ? 'Sí' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección: Información de Aprobación/Rechazo */}
              {(ausenciaSeleccionada.estado === 'aprobada' || ausenciaSeleccionada.estado === 'aprobado') && ausenciaSeleccionada.aprobadoPor && (
                <div className="detalle-section detalle-section-aprobado">
                  <div className="detalle-section-header">
                    <i className="bi bi-check-circle me-2"></i>
                    <h5>Información de Aprobación</h5>
                  </div>
                  <div className="detalle-grid">
                    <div className="detalle-item">
                      <span className="detalle-label">Aprobado por:</span>
                      <span className="detalle-value">{ausenciaSeleccionada.aprobadoPor}</span>
                    </div>
                    <div className="detalle-item">
                      <span className="detalle-label">Fecha de Aprobación:</span>
                      <span className="detalle-value">{formatFecha(ausenciaSeleccionada.fechaAprobacion, { conHora: true })}</span>
                    </div>
                  </div>
                </div>
              )}

              {(ausenciaSeleccionada.estado === 'rechazada' || ausenciaSeleccionada.estado === 'rechazado') && ausenciaSeleccionada.rechazadoPor && (
                <div className="detalle-section detalle-section-rechazado">
                  <div className="detalle-section-header">
                    <i className="bi bi-x-circle me-2"></i>
                    <h5>Información de Rechazo</h5>
                  </div>
                  <div className="detalle-grid">
                    <div className="detalle-item">
                      <span className="detalle-label">Rechazado por:</span>
                      <span className="detalle-value">{ausenciaSeleccionada.rechazadoPor}</span>
                    </div>
                    <div className="detalle-item">
                      <span className="detalle-label">Fecha de Rechazo:</span>
                      <span className="detalle-value">{formatFecha(ausenciaSeleccionada.fechaRechazo, { conHora: true })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-custom">
              <button className="btn-close-custom-footer" onClick={() => setShowDetallesModal(false)}>
                <i className="bi bi-x-circle me-2"></i>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export default Ausencias;
