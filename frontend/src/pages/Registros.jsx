import { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import '../styles/Registros.css';

function Registros() {
  // El backend filtra por departamento, el frontend solo gestiona filtros de UI


  // Eliminar filteredRegistros como estado para evitar bucles infinitos
  // const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  // Un solo estado: el día seleccionado (por defecto hoy)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(today);
  const [filters, setFilters] = useState({
    busqueda: '',
    tipo: '',
    evento: ''
  });

  // Estados para Registro Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({
    uid: '',
    fecha: today,
    tipoEvento: 'entrada',
    hora: '',
    estado: 'puntual',
    observaciones: ''
  });

  // Obtener lista de usuarios para el dropdown de registro manual
  const { data: usersData = [] } = useQuery({
    queryKey: ['usersList'],
    queryFn: async () => {
      const response = await api.getUsers();
      return response.data?.data || [];
    }
  });

  // Filtrar y ordenar usuarios activos
  const activeUsers = useMemo(() => {
    return [...usersData]
      .filter(u => u.activo !== false)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [usersData]);

  const handleManualFormChange = (field, value) => {
    setManualForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'tipoEvento') {
        if (value === 'salida') {
          updated.estado = 'salida';
        } else if (prev.tipoEvento === 'salida' && value === 'entrada') {
          updated.estado = 'puntual';
        }
      }
      return updated;
    });
  };

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!manualForm.uid || !manualForm.fecha || !manualForm.tipoEvento || !manualForm.hora || !manualForm.estado || !manualForm.observaciones.trim()) {
      toast.warning('Por favor complete todos los campos obligatorios y proporcione una observaciones.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.registerManualAttendance({
        uid: manualForm.uid,
        fecha: manualForm.fecha,
        tipoEvento: manualForm.tipoEvento,
        hora: manualForm.hora,
        estado: manualForm.estado,
        observaciones: manualForm.observaciones.trim()
      });

      if (response.data?.success) {
        toast.success(response.data.message || 'Registro de asistencia creado con éxito.');
        setShowManualModal(false);
        // Reset form
        setManualForm({
          uid: '',
          fecha: today,
          tipoEvento: 'entrada',
          hora: '',
          estado: 'puntual',
          observaciones: ''
        });
        // Refetch registros
        refetchRegistros();
      } else {
        toast.error(response.data?.message || 'Error al crear el registro manual');
      }
    } catch (error) {
      console.error('Error al registrar asistencia manual:', error);
      const errorMessage = error.response?.data?.message || 'Error del servidor al crear el registro manual';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { 
    data: allRegistros = [], 
    isLoading: loading, 
    refetch: refetchRegistros 
  } = useQuery({
    // Re-fetcha cuando cambia el día
    queryKey: ['attendanceRegistros', fechaSeleccionada],
    queryFn: async () => {
      if (fechaSeleccionada === today) {
        // Para hoy, usar el endpoint directo
        const response = await api.getTodayAttendance();
        return response.data?.data || [];
      } else {
        // Para otros días, usar el reporte con misma fecha de inicio y fin
        const response = await api.getWeeklyReport(fechaSeleccionada, fechaSeleccionada);
        const data = response.data?.data;
        const rawRegistros = Array.isArray(data) ? data : (data?.registros || []);
        return rawRegistros.map(r => ({ ...r, email: r.email }));
      }
    }
  });

  // El backend ya filtra por departamento para admin_area.
  // Aqui solo se retornan los registros tal cual vienen del servidor.
  const registros = useMemo(() => allRegistros, [allRegistros]);

  // Se deriva filteredRegistros directamente desde registros y filters usando useMemo
  const filteredRegistros = useMemo(() => {
    let filtered = [...registros];

    if (filters.busqueda) {
      filtered = filtered.filter(reg =>
        reg.nombre?.toLowerCase().includes(filters.busqueda.toLowerCase())
      );
    }

    if (filters.tipo) {
      filtered = filtered.filter(reg => reg.tipo === filters.tipo);
    }

    if (filters.evento) {
      filtered = filtered.filter(reg => reg.tipoEvento === filters.evento);
    }

    return filtered;
  }, [registros, filters]);

  // Se eliminó el useEffect que llamaba a aplicarFiltros para evitar el bucle infinito

  const cargarRegistros = () => refetchRegistros();

  // Función aplicarFiltros eliminada ya que ahora usamos useMemo para filteredRegistros

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const limpiarFiltros = () => {
    setFechaSeleccionada(today);
    setFilters({
      busqueda: '',
      tipo: '',
      evento: ''
    });
  };


  const verDetalles = (registro) => {
    setRegistroSeleccionado(registro);
    setShowModal(true);
  };

  const eliminarRegistro = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;

    try {
      await api.deleteAttendanceRecord(id);
      alert('Registro eliminado correctamente');
      cargarRegistros();
    } catch (error) {
      console.error('Error eliminando registro:', error);
      alert('Error al eliminar el registro');
    }
  };

  const exportarCSV = () => {
    const headers = ['Nombre', 'Tipo', 'Fecha', 'Hora', 'Evento', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...filteredRegistros.map(reg => [
        reg.nombre || '',
        reg.tipo || '',
        reg.fecha || '',
        reg.hora || '',
        reg.tipoEvento || '',
        reg.tipoEvento === 'entrada' ? (reg.estado === 'puntual' ? 'Puntual' : 'Retardo') : '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const descargarJSON = () => {
    const jsonContent = JSON.stringify(filteredRegistros, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="registros-container">
      <div className="section-header">
        <h2>
          <i className="bi bi-table me-2"></i>
          Registros de Acceso
        </h2>
        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-success" onClick={() => setShowManualModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>
            Registro Manual
          </button>
          <div className="btn-group">
            <button className="btn btn-outline-success" onClick={exportarCSV}>
              <i className="bi bi-file-earmark-excel me-2"></i>
              Exportar CSV
            </button>
            <button className="btn btn-outline-primary" onClick={descargarJSON}>
              <i className="bi bi-file-earmark-code me-2"></i>
              Exportar JSON
            </button>
          </div>
        </div>
      </div>

      {/* Banner de departamento para admin_area */}
      <DepartmentBanner />

      {/* Filtros */}
      <div className="filter-bar mb-3 p-3 rounded-3 shadow-sm">
        <div className="row g-2 mb-2">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre..."
              value={filters.busqueda}
              onChange={(e) => handleFilterChange('busqueda', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              max={today}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={filters.tipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              <option value="">Todos los tipos</option>
              <option value="becario">Becario</option>
              <option value="tiempo_completo">Tiempo completo</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={filters.evento}
              onChange={(e) => handleFilterChange('evento', e.target.value)}
            >
              <option value="">Todos los eventos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </div>
          <div className="col-md-1">
            <button className="btn btn-outline-secondary w-100" onClick={limpiarFiltros} title="Limpiar filtros y volver a hoy">
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
        <div className="text-muted small">
          <i className="bi bi-info-circle me-1"></i>
          {fechaSeleccionada === today ? 'Hoy' : fechaSeleccionada} — {filteredRegistros.length} de {registros.length} registros
        </div>
      </div>


      {/* Tabla */}
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
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th className="text-center">Evento</th>
                <th className="text-center">Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    <i className="bi bi-inbox display-4"></i>
                    <p className="mt-2">No hay registros disponibles</p>
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((reg, index) => (
                  <tr key={index}>
                    <td>{reg.nombre || 'Usuario'}</td>
                    <td>
                      <span className={`badge bg-${reg.tipo === 'becario' ? 'info' : 'primary'}`}>
                        {reg.tipo || 'N/A'}
                      </span>
                    </td>
                    <td>{reg.fecha || '--'}</td>
                    <td>{reg.hora || '--:--'}</td>
                    <td className="text-center">
                      <span className={`badge bg-${reg.tipoEvento === 'entrada' ? 'success' : 'secondary'}`}>
                        {reg.tipoEvento || 'N/A'}
                      </span>
                    </td>
                    <td className="text-center">
                      {reg.tipoEvento === 'entrada' ? (
                        <span className={`badge bg-${reg.estado === 'puntual' ? 'success' : 'warning'}`}>
                          {reg.estado === 'puntual' ? 'Puntual' : 'Retardo'}
                        </span>
                      ) : (
                        <span className="badge bg-secondary">-</span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => verDetalles(reg)}
                        title="Ver detalles"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarRegistro(reg.id)}
                        title="Eliminar"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detalles - Diseño Bonito */}
      {showModal && registroSeleccionado && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom modal-detalles-registro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom bg-gradient-registro">
              <div className="modal-icon-header">
                <i className="bi bi-file-earmark-text-fill"></i>
              </div>
              <div className="modal-title-group">
                <h4 className="modal-title-main">Detalles del Registro</h4>
                <p className="modal-subtitle">Información completa del acceso</p>
              </div>
              <button className="btn-close-custom" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body-custom modal-detalles-body">
              {/* Sección: Información del Usuario */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-person-circle me-2"></i>
                  <h5>Información del Usuario</h5>
                </div>
                <div className="detalle-grid">
                  <div className="detalle-item">
                    <span className="detalle-label">Nombre:</span>
                    <span className="detalle-value">{registroSeleccionado.nombre || 'N/A'}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Email:</span>
                    <span className="detalle-value">{registroSeleccionado.email || 'N/A'}</span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Tipo de Usuario:</span>
                    <span className={`badge ${registroSeleccionado.tipo === 'becario' ? 'bg-info' : 'bg-primary'} detalle-badge`}>
                      {registroSeleccionado.tipo || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección: Detalles del Registro */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-clock-history me-2"></i>
                  <h5>Detalles del Acceso</h5>
                </div>
                <div className="detalle-grid">
                  <div className="detalle-item">
                    <span className="detalle-label">Tipo de Evento:</span>
                    <span className={`badge ${registroSeleccionado.tipoEvento === 'entrada' ? 'bg-success' : 'bg-secondary'} detalle-badge`}>
                      <i className={`bi bi-${registroSeleccionado.tipoEvento === 'entrada' ? 'box-arrow-in-right' : 'box-arrow-right'} me-2`}></i>
                      {registroSeleccionado.tipoEvento || 'N/A'}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Estado:</span>
                    {registroSeleccionado.tipoEvento === 'entrada' ? (
                      <span className={`badge ${registroSeleccionado.estado === 'puntual' ? 'bg-success' : 'bg-warning'} detalle-badge`}>
                        <i className={`bi bi-${registroSeleccionado.estado === 'puntual' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
                        {registroSeleccionado.estado === 'puntual' ? 'Puntual' : 'Retardo'}
                      </span>
                    ) : (
                      <span className="badge bg-secondary detalle-badge">-</span>
                    )}
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Fecha:</span>
                    <span className="detalle-value detalle-fecha">
                      <i className="bi bi-calendar3 me-2"></i>
                      {registroSeleccionado.fecha || 'N/A'}
                    </span>
                  </div>
                  <div className="detalle-item">
                    <span className="detalle-label">Hora:</span>
                    <span className="detalle-value detalle-hora">
                      <i className="bi bi-clock me-2"></i>
                      <strong>{registroSeleccionado.hora || 'N/A'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección: Ubicación */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-geo-alt me-2"></i>
                  <h5>Ubicación</h5>
                </div>
                <div className="detalle-ubicacion">
                  <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                  {registroSeleccionado.ubicacion ? (
                    typeof registroSeleccionado.ubicacion === 'object' ? (
                      <>
                        <strong>Coordenadas:</strong> Lat: {registroSeleccionado.ubicacion.lat?.toFixed(6)},
                        Lng: {registroSeleccionado.ubicacion.lng?.toFixed(6)}
                        {registroSeleccionado.ubicacion.lat && registroSeleccionado.ubicacion.lng && (
                          <div className="mt-2">
                            <a
                              href={`https://www.google.com/maps?q=${registroSeleccionado.ubicacion.lat},${registroSeleccionado.ubicacion.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-primary"
                            >
                              <i className="bi bi-map me-2"></i>
                              Ver en Google Maps
                            </a>
                          </div>
                        )}
                      </>
                    ) : (
                      registroSeleccionado.ubicacion
                    )
                  ) : (
                    <span className="text-muted">No disponible</span>
                  )}
                </div>
              </div>

              {/* Sección: Información Técnica */}
              <div className="detalle-section">
                <div className="detalle-section-header">
                  <i className="bi bi-code-square me-2"></i>
                  <h5>Información Técnica</h5>
                </div>
                <div className="detalle-item">
                  <span className="detalle-label">ID de Registro:</span>
                  <code className="detalle-code">{registroSeleccionado.id || 'N/A'}</code>
                </div>
                {registroSeleccionado.deviceId && (
                  <div className="detalle-item mt-2">
                    <span className="detalle-label">Device ID:</span>
                    <code className="detalle-code">{registroSeleccionado.deviceId}</code>
                  </div>
                )}
                {registroSeleccionado.timestamp && (
                  <div className="detalle-item mt-2">
                    <span className="detalle-label">Timestamp:</span>
                    <code className="detalle-code">{new Date(registroSeleccionado.timestamp).toLocaleString('es-MX')}</code>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-custom">
              <button className="btn-close-custom-footer" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-circle me-2"></i>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registro Manual - Diseño Premium */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-content-custom modal-manual-asistencia" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom bg-gradient-manual">
              <div className="modal-icon-header">
                <i className="bi bi-person-plus-fill"></i>
              </div>
              <div className="modal-title-group">
                <h4 className="modal-title-main">Registrar Asistencia Manual</h4>
                <p className="modal-subtitle">Agregar entrada o salida para un empleado</p>
              </div>
              <button className="btn-close-custom" onClick={() => setShowManualModal(false)} disabled={isSubmitting}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body-custom modal-manual-body">
              <form onSubmit={handleManualSubmit}>
                <div className="form-group-custom mb-3">
                  <label className="form-label-custom">
                    <i className="bi bi-person-fill text-success"></i> Empleado *
                  </label>
                  <select
                    className="form-select-custom"
                    value={manualForm.uid}
                    onChange={(e) => handleManualFormChange('uid', e.target.value)}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Seleccione un empleado...</option>
                    {activeUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.nombre} ({user.correo || user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="form-group-custom">
                      <label className="form-label-custom">
                        <i className="bi bi-calendar-event text-success"></i> Fecha *
                      </label>
                      <input
                        type="date"
                        className="form-control-custom"
                        value={manualForm.fecha}
                        onChange={(e) => handleManualFormChange('fecha', e.target.value)}
                        max={today}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group-custom">
                      <label className="form-label-custom">
                        <i className="bi bi-clock text-success"></i> Hora *
                      </label>
                      <input
                        type="time"
                        className="form-control-custom"
                        value={manualForm.hora}
                        onChange={(e) => handleManualFormChange('hora', e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="form-group-custom">
                      <label className="form-label-custom">
                        <i className="bi bi-arrow-left-right text-success"></i> Tipo de Evento *
                      </label>
                      <select
                        className="form-select-custom"
                        value={manualForm.tipoEvento}
                        onChange={(e) => handleManualFormChange('tipoEvento', e.target.value)}
                        required
                        disabled={isSubmitting}
                      >
                        <option value="entrada">Entrada</option>
                        <option value="salida">Salida</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group-custom">
                      <label className="form-label-custom">
                        <i className="bi bi-question-circle text-success"></i> Estado *
                      </label>
                      <select
                        className="form-select-custom"
                        value={manualForm.estado}
                        onChange={(e) => handleManualFormChange('estado', e.target.value)}
                        disabled={manualForm.tipoEvento === 'salida' || isSubmitting}
                        required
                      >
                        {manualForm.tipoEvento === 'salida' ? (
                          <option value="salida">Salida</option>
                        ) : (
                          <>
                            <option value="puntual">Puntual</option>
                            <option value="retardo">Retardo</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group-custom mb-3">
                  <label className="form-label-custom">
                    <i className="bi bi-chat-left-text text-success"></i> Observaciones / Justificación *
                  </label>
                  <textarea
                    className="form-textarea-custom"
                    value={manualForm.observaciones}
                    onChange={(e) => handleManualFormChange('observaciones', e.target.value)}
                    placeholder="Escriba aquí el motivo o justificación del registro manual..."
                    rows="3"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </form>
            </div>

            <div className="modal-footer-custom">
              <button
                type="button"
                className="btn-close-custom-footer"
                onClick={() => setShowManualModal(false)}
                disabled={isSubmitting}
              >
                <i className="bi bi-x-circle me-2"></i>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-submit-custom"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Registrando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-2"></i>
                    Guardar Registro
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

export default Registros;
