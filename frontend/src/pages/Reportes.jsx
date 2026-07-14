import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'sonner';
import { api } from '../services/api';
import '../styles/Reportes.css';

function Reportes() {
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estado para el modal personalizado
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [formato, setFormato] = useState('pdf');

  // Estado para el modal de reporte por usuario
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [fechaInicioUsuario, setFechaInicioUsuario] = useState('');
  const [fechaFinUsuario, setFechaFinUsuario] = useState('');
  const [formatoUsuario, setFormatoUsuario] = useState('pdf');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [reporteUsuario, setReporteUsuario] = useState(null);

  // Cargar lista de usuarios
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const response = await api.getUsers();
        if (response.data?.success) {
          const usuariosActivos = (response.data.data || []).filter(u => u.activo !== false);
          setUsuarios(usuariosActivos);
        }
      } catch (error) {
        console.error('Error cargando usuarios:', error);
      }
    };
    cargarUsuarios();
  }, []);

  // Filtrar usuarios por búsqueda
  const usuariosFiltrados = usuarios.filter(u => {
    const busqueda = busquedaUsuario.toLowerCase();
    const email = u.correo || u.email || '';
    return (
      u.nombre?.toLowerCase().includes(busqueda) ||
      email.toLowerCase().includes(busqueda) ||
      u.departamento?.toLowerCase().includes(busqueda)
    );
  });

  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  // Generar reporte diario PDF
  const generarReporteDiario = async () => {
    try {
      setLoading(true);

      const hoy = new Date().toISOString().split('T')[0];

      const response = await api.exportAttendancePDF({
        startDate: hoy,
        endDate: hoy
      });

      descargarArchivo(response.data, `reporte_diario_${hoy}.pdf`, 'application/pdf');
      showToast('Reporte diario generado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando reporte diario:', error);
      showToast('Error al generar el reporte diario', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generar reporte semanal Excel
  const generarReporteSemanal = async () => {
    try {
      setLoading(true);

      // Calcular inicio y fin de la semana actual
      const hoy = new Date();
      const diaSemana = hoy.getDay();
      const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana; // Lunes como inicio

      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() + diferencia);

      const finSemana = new Date(inicioSemana);
      finSemana.setDate(inicioSemana.getDate() + 6);

      const fechaInicio = inicioSemana.toISOString().split('T')[0];
      const fechaFin = finSemana.toISOString().split('T')[0];

      const response = await api.exportAttendanceExcel({
        startDate: fechaInicio,
        endDate: fechaFin
      });

      descargarArchivo(response.data, `reporte_semanal_${fechaInicio}_${fechaFin}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      showToast('Reporte semanal generado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando reporte semanal:', error);
      showToast('Error al generar el reporte semanal', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generar reporte personalizado
  const generarReportePersonalizado = async () => {
    if (!fechaInicio || !fechaFin) {
      showToast('Por favor selecciona el rango de fechas', 'warning');
      return;
    }

    if (new Date(fechaInicio) > new Date(fechaFin)) {
      showToast('La fecha de inicio debe ser anterior a la fecha fin', 'warning');
      return;
    }

    try {
      setLoading(true);

      const params = {
        startDate: fechaInicio,
        endDate: fechaFin
      };

      // Agregar filtro de tipo si está seleccionado
      if (tipoUsuario) {
        params.tipo = tipoUsuario;
      }

      let response;
      let filename;
      let mimeType;

      if (formato === 'pdf') {
        response = await api.exportAttendancePDF(params);
        filename = `reporte_personalizado_${fechaInicio}_${fechaFin}.pdf`;
        mimeType = 'application/pdf';
      } else if (formato === 'excel') {
        response = await api.exportAttendanceExcel(params);
        filename = `reporte_personalizado_${fechaInicio}_${fechaFin}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (formato === 'csv') {
        // Obtener los datos y generar CSV
        const dataResponse = await api.getAttendanceRecords({
          fechaInicio,
          fechaFin,
          tipo: tipoUsuario || undefined
        });

        if (dataResponse.data?.success) {
          exportarCSV(dataResponse.data.data?.registros || [], fechaInicio, fechaFin);
        }

        setShowModal(false);
        setLoading(false);
        showToast('Reporte CSV generado exitosamente', 'success');
        return;
      }

      descargarArchivo(response.data, filename, mimeType);
      setShowModal(false);
      showToast('Reporte personalizado generado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando reporte personalizado:', error);
      showToast('Error al generar el reporte personalizado', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generar reporte de asistencia por usuario
  const generarReporteUsuario = async () => {
    if (!usuarioSeleccionado) {
      showToast('Por favor selecciona un usuario', 'warning');
      return;
    }
    if (!fechaInicioUsuario || !fechaFinUsuario) {
      showToast('Por favor selecciona el rango de fechas', 'warning');
      return;
    }
    if (new Date(fechaInicioUsuario) > new Date(fechaFinUsuario)) {
      showToast('La fecha de inicio debe ser anterior a la fecha fin', 'warning');
      return;
    }

    try {
      setLoading(true);

      const params = {
        uid: usuarioSeleccionado,
        fechaInicio: fechaInicioUsuario,
        fechaFin: fechaFinUsuario
      };

      if (formatoUsuario === 'pdf') {
        const response = await api.exportUserAttendancePDF(params);
        const usuario = usuarios.find(u => u.uid === usuarioSeleccionado);
        const nombreArchivo = `asistencia_${usuario?.nombre?.replace(/\s+/g, '_') || 'usuario'}_${fechaInicioUsuario}_${fechaFinUsuario}.pdf`;
        descargarArchivo(response.data, nombreArchivo, 'application/pdf');
      } else if (formatoUsuario === 'excel') {
        const response = await api.exportUserAttendanceExcel(params);
        const usuario = usuarios.find(u => u.uid === usuarioSeleccionado);
        const nombreArchivo = `asistencia_${usuario?.nombre?.replace(/\s+/g, '_') || 'usuario'}_${fechaInicioUsuario}_${fechaFinUsuario}.xlsx`;
        descargarArchivo(response.data, nombreArchivo, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (formatoUsuario === 'ver') {
        const response = await api.getUserAttendanceReport(params);
        if (response.data?.success) {
          setReporteUsuario(response.data.data);
        }
        setLoading(false);
        return;
      }

      setShowUserModal(false);
      showToast('Reporte de usuario generado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando reporte de usuario:', error);
      showToast('Error al generar el reporte del usuario', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = (registros, inicio, fin) => {
    if (!registros || registros.length === 0) {
      showToast('No hay registros para exportar', 'warning');
      return;
    }

    const headers = ['Nombre', 'Email', 'Fecha', 'Hora', 'Tipo', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...registros.map(reg => [
        reg.nombre || '',
        reg.email || '',
        reg.fecha || '',
        reg.hora || '',
        reg.tipoEvento || reg.tipo || '',
        reg.estado || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_personalizado_${inicio}_${fin}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const descargarArchivo = (data, filename, mimeType) => {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="section-header">
        <h2><i className="bi bi-file-earmark-bar-graph me-2"></i>Generar Reportes</h2>
      </div>

      <div className="row">
        {/* Reporte Diario */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body text-center">
              <div className="icon-wrapper-lg mb-3">
                <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h4>Reporte Diario</h4>
              <p className="text-muted">Genera un reporte PDF con el resumen de actividades del día.</p>
              <button
                className="btn btn-danger"
                onClick={generarReporteDiario}
                disabled={loading}
              >
                <i className="bi bi-download me-2"></i>Generar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Reporte Semanal */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body text-center">
              <div className="icon-wrapper-lg mb-3">
                <i className="bi bi-file-earmark-excel text-success" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h4>Reporte Semanal</h4>
              <p className="text-muted">Exporta a Excel todos los registros de la semana actual.</p>
              <button
                className="btn btn-success"
                onClick={generarReporteSemanal}
                disabled={loading}
              >
                <i className="bi bi-download me-2"></i>Generar Excel
              </button>
            </div>
          </div>
        </div>

        {/* Reporte Personalizado */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body text-center">
              <div className="icon-wrapper-lg mb-3">
                <i className="bi bi-file-earmark-text text-primary" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h4>Reporte Personalizado</h4>
              <p className="text-muted">Crea un reporte con filtros específicos de fecha y tipo.</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
              >
                <i className="bi bi-gear me-2"></i>Personalizar
              </button>
            </div>
          </div>
        </div>

        {/* Reporte por Usuario */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body text-center">
              <div className="icon-wrapper-lg mb-3">
                <i className="bi bi-person-badge text-info" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h4>Reporte por Usuario</h4>
              <p className="text-muted">Genera un reporte detallado de asistencia de un empleado específico.</p>
              <button
                className="btn btn-info text-white"
                onClick={() => { setShowUserModal(true); setReporteUsuario(null); }}
              >
                <i className="bi bi-person me-2"></i>Seleccionar Empleado
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para reporte personalizado */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">Reporte Personalizado</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label className="form-label">Rango de fechas</label>
                  <div className="input-group">
                    <input
                      type="date"
                      className="form-control"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                    />
                    <span className="input-group-text">a</span>
                    <input
                      type="date"
                      className="form-control"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Tipo de usuario</label>
                  <select
                    className="form-select"
                    value={tipoUsuario}
                    onChange={(e) => setTipoUsuario(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="becario">Becarios</option>
                    <option value="tiempo_completo">Tiempo completo</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Formato</label>
                  <select
                    className="form-select"
                    value={formato}
                    onChange={(e) => setFormato(e.target.value)}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={generarReportePersonalizado}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Generando...
                  </>
                ) : (
                  'Generar Reporte'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reporte por usuario */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content-custom modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-person-badge me-2"></i>
                Reporte de Asistencia por Usuario
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowUserModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              {!reporteUsuario ? (
                <form>
                  <div className="mb-3">
                    <label className="form-label">Buscar empleado</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre, email o departamento..."
                      value={busquedaUsuario}
                      onChange={(e) => setBusquedaUsuario(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Seleccionar empleado *</label>
                    <select
                      className="form-select"
                      value={usuarioSeleccionado}
                      onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                    >
                      <option value="">-- Selecciona un empleado --</option>
                      {usuariosFiltrados.map(u => (
                        <option key={u.uid} value={u.uid}>
                          {u.nombre} - {u.departamento || 'Sin depto.'} ({u.tipo})
                        </option>
                      ))}
                    </select>
                    <small className="text-muted">
                      {usuariosFiltrados.length} de {usuarios.length} empleados
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rango de fechas *</label>
                    <div className="input-group">
                      <input
                        type="date"
                        className="form-control"
                        value={fechaInicioUsuario}
                        onChange={(e) => setFechaInicioUsuario(e.target.value)}
                      />
                      <span className="input-group-text">a</span>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaFinUsuario}
                        onChange={(e) => setFechaFinUsuario(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Formato de salida</label>
                    <select
                      className="form-select"
                      value={formatoUsuario}
                      onChange={(e) => setFormatoUsuario(e.target.value)}
                    >
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel</option>
                      <option value="ver">Ver en pantalla</option>
                    </select>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">
                      <strong>{reporteUsuario.usuario.nombre}</strong> - {reporteUsuario.usuario.departamento}
                    </h6>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setReporteUsuario(null)}>
                      <i className="bi bi-arrow-left me-1"></i>Volver
                    </button>
                  </div>
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <div className="card text-center p-2">
                        <div className="text-success fw-bold">{reporteUsuario.estadisticas.diasAsistidos}</div>
                        <small className="text-muted">Días Asistidos</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center p-2">
                        <div className="text-primary fw-bold">{reporteUsuario.estadisticas.porcentajeAsistencia}%</div>
                        <small className="text-muted">Asistencia</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center p-2">
                        <div className="text-warning fw-bold">{reporteUsuario.estadisticas.retardos}</div>
                        <small className="text-muted">Retardos</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center p-2">
                        <div className="text-info fw-bold">{reporteUsuario.estadisticas.porcentajePuntualidad}%</div>
                        <small className="text-muted">Puntualidad</small>
                      </div>
                    </div>
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table table-sm table-striped">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Tipo</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporteUsuario.registros.map((r, idx) => (
                          <tr key={idx}>
                            <td>{r.fecha}</td>
                            <td>{r.hora === '-' ? '-' : r.hora}</td>
                            <td>
                              {r.tipoEvento === 'entrada' ? 'Entrada' :
                               r.tipoEvento === 'salida' ? 'Salida' : 'Justificado'}
                            </td>
                            <td>
                              <span className={`badge ${
                                r.estado === 'puntual' ? 'bg-success' :
                                r.estado === 'retardo' ? 'bg-warning text-dark' :
                                r.tipoEvento === 'ausencia' ? 'bg-info' :
                                'bg-secondary'
                              }`}>
                                {r.tipoEvento === 'ausencia' ? (r.tipoAusencia || 'Justificado') :
                                 r.estado === 'puntual' ? 'Puntual' :
                                 r.estado === 'retardo' ? 'Retardo' : r.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowUserModal(false); setReporteUsuario(null); }}
              >
                Cerrar
              </button>
              {!reporteUsuario && (
                <button
                  type="button"
                  className="btn btn-info text-white"
                  onClick={generarReporteUsuario}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-download me-2"></i>Generar Reporte
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export default Reportes;
