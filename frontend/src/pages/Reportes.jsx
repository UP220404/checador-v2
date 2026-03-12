import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'sonner';
import { api } from '../services/api';
import '../styles/Reportes.css';

function Reportes() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estado para el modal personalizado
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [formato, setFormato] = useState('pdf');

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

    </AdminLayout>
  );
}

export default Reportes;
