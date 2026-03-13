import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import DepartmentBanner, { useRoleData } from '../components/DepartmentBanner';
import { api } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import '../styles/Registros.css';

function Registros() {
  const { departmentFilter } = useRoleData();

  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);

  const [filters, setFilters] = useState({
    busqueda: '',
    fechaInicio: '',
    fechaFin: '',
    tipo: '',
    evento: ''
  });

  const { 
    data: allRegistros = [], 
    isLoading: loading, 
    refetch: refetchRegistros 
  } = useQuery({
    queryKey: ['todayAttendance'],
    queryFn: async () => {
      const response = await api.getTodayAttendance();
      return response.data?.data || [];
    }
  });

  const registros = departmentFilter 
    ? allRegistros.filter(r => r.departamento === departmentFilter) 
    : allRegistros;

  useEffect(() => {
    aplicarFiltros();
  }, [filters, registros]);

  const cargarRegistros = () => refetchRegistros();

  const aplicarFiltros = () => {
    let filtered = [...registros];

    if (filters.busqueda) {
      filtered = filtered.filter(reg =>
        reg.nombre?.toLowerCase().includes(filters.busqueda.toLowerCase())
      );
    }

    if (filters.fechaInicio) {
      filtered = filtered.filter(reg => reg.fecha >= filters.fechaInicio);
    }

    if (filters.fechaFin) {
      filtered = filtered.filter(reg => reg.fecha <= filters.fechaFin);
    }

    if (filters.tipo) {
      filtered = filtered.filter(reg => reg.tipo === filters.tipo);
    }

    if (filters.evento) {
      filtered = filtered.filter(reg => reg.tipoEvento === filters.evento);
    }

    setFilteredRegistros(filtered);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const limpiarFiltros = () => {
    setFilters({
      busqueda: '',
      fechaInicio: '',
      fechaFin: '',
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
              value={filters.fechaInicio}
              onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
              placeholder="Fecha inicio"
            />
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              value={filters.fechaFin}
              onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
              placeholder="Fecha fin"
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
            <button className="btn btn-secondary w-100" onClick={limpiarFiltros} title="Limpiar filtros">
              <i className="bi bi-x-circle"></i>
            </button>
          </div>
        </div>
        <div className="text-muted small">
          <i className="bi bi-info-circle me-1"></i>
          Mostrando {filteredRegistros.length} de {registros.length} registros
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
                    <span className="detalle-value">{registroSeleccionado.correo || registroSeleccionado.email || 'N/A'}</span>
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
      </div>
    </AdminLayout>
  );
}

export default Registros;
