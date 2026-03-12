import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import SaldoVacaciones from './SaldoVacaciones';

const tipoOpciones = [
  { value: 'permiso_con_goce', icon: 'bi-envelope-paper', label: 'Permiso con Goce', desc: 'Con goce de sueldo', color: '#198754' },
  { value: 'permiso_sin_goce', icon: 'bi-envelope', label: 'Permiso sin Goce', desc: 'Sin goce de sueldo', color: '#6c757d' },
  { value: 'vacaciones', icon: 'bi-calendar-heart', label: 'Vacaciones', desc: 'Dias de descanso', color: '#0d6efd' },
  { value: 'incapacidad', icon: 'bi-hospital', label: 'Incapacidad', desc: 'Por motivos de salud', color: '#dc3545' }
];

function SolicitudesTab({ userData, mostrarMensaje, saldoVacaciones }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'permiso_con_goce',
    fechaInicio: '',
    fechaFin: '',
    motivo: '',
    esEmergencia: false,
    motivoEmergencia: ''
  });
  const [alertaAnticipacion, setAlertaAnticipacion] = useState(null);

  useEffect(() => {
    if (userData) {
      cargarSolicitudes();
    }
  }, [userData]);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const response = await api.getMyAbsenceRequests();
      if (response.data.success) {
        setSolicitudes(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  const TIPOS_REQUIEREN_ANTICIPACION = ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce'];
  const DIAS_ANTICIPACION_REQUERIDOS = 15;

  const calcularDiasAnticipacion = (fechaInicio) => {
    if (!fechaInicio) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaInicio + 'T00:00:00');
    return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
  };

  const verificarAnticipacion = (fechaInicio, tipo) => {
    if (!fechaInicio || !TIPOS_REQUIEREN_ANTICIPACION.includes(tipo)) {
      setAlertaAnticipacion(null);
      return;
    }
    const dias = calcularDiasAnticipacion(fechaInicio);
    if (dias < DIAS_ANTICIPACION_REQUERIDOS) {
      setAlertaAnticipacion({
        dias,
        mensaje: `Esta solicitud tiene solo ${dias} dia(s) de anticipacion. Se requieren ${DIAS_ANTICIPACION_REQUERIDOS} dias. Debes marcarla como emergencia y proporcionar el motivo.`
      });
    } else {
      setAlertaAnticipacion(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));

    if (name === 'fechaInicio') {
      verificarAnticipacion(value, formData.tipo);
    } else if (name === 'tipo') {
      verificarAnticipacion(formData.fechaInicio, value);
    }

    if (name === 'esEmergencia' && !checked) {
      setFormData(prev => ({ ...prev, motivoEmergencia: '' }));
    }
  };

  const handleTipoSelect = (tipo) => {
    setFormData(prev => ({ ...prev, tipo }));
    verificarAnticipacion(formData.fechaInicio, tipo);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.tipo || !formData.fechaInicio || !formData.motivo) {
      mostrarMensaje('warning', 'Por favor complete todos los campos obligatorios');
      return;
    }

    if (alertaAnticipacion && !formData.esEmergencia) {
      mostrarMensaje('warning', 'Debe marcar la solicitud como emergencia o elegir una fecha con mas anticipacion');
      return;
    }

    if (formData.esEmergencia && (!formData.motivoEmergencia || formData.motivoEmergencia.trim().length < 10)) {
      mostrarMensaje('warning', 'Debe proporcionar un motivo detallado para la emergencia (minimo 10 caracteres)');
      return;
    }

    try {
      setSaving(true);
      const response = await api.createAbsenceRequest({
        ...formData,
        fechaFin: formData.fechaFin || formData.fechaInicio
      });

      if (response.data.success) {
        mostrarMensaje('success', response.data.message || 'Solicitud enviada correctamente');
        setFormData({
          tipo: 'permiso_con_goce',
          fechaInicio: '',
          fechaFin: '',
          motivo: '',
          esEmergencia: false,
          motivoEmergencia: ''
        });
        setAlertaAnticipacion(null);
        setShowForm(false);
        cargarSolicitudes();
      }
    } catch (error) {
      console.error('Error creando solicitud:', error);
      mostrarMensaje('error', error.response?.data?.message || 'Error al enviar solicitud');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async (id) => {
    if (!confirm('Deseas cancelar esta solicitud?')) return;

    try {
      const response = await api.cancelMyAbsenceRequest(id);
      if (response.data.success) {
        mostrarMensaje('success', 'Solicitud cancelada');
        cargarSolicitudes();
      }
    } catch (error) {
      console.error('Error cancelando solicitud:', error);
      mostrarMensaje('error', error.response?.data?.message || 'Error al cancelar solicitud');
    }
  };

  const obtenerIconoTipo = (tipo) => {
    const iconos = {
      permiso_con_goce: 'bi-envelope-paper',
      permiso_sin_goce: 'bi-envelope',
      vacaciones: 'bi-calendar-heart',
      incapacidad: 'bi-hospital'
    };
    return iconos[tipo] || 'bi-question-circle';
  };

  const obtenerNombreTipo = (tipo) => {
    const nombres = {
      permiso_con_goce: 'Permiso con Goce',
      permiso_sin_goce: 'Permiso sin Goce',
      vacaciones: 'Vacaciones',
      incapacidad: 'Incapacidad'
    };
    return nombres[tipo] || tipo;
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'aprobado':
      case 'aprobada':
        return 'bg-success';
      case 'rechazado':
      case 'rechazada':
        return 'bg-danger';
      default:
        return 'bg-warning';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'aprobado':
      case 'aprobada':
        return 'Aprobada';
      case 'rechazado':
      case 'rechazada':
        return 'Rechazada';
      default:
        return 'Pendiente';
    }
  };

  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');
  const solicitudesResueltas = solicitudes.filter(s => s.estado !== 'pendiente');

  const openPanel = () => {
    setFormData({
      tipo: 'permiso_con_goce',
      fechaInicio: '',
      fechaFin: '',
      motivo: '',
      esEmergencia: false,
      motivoEmergencia: ''
    });
    setAlertaAnticipacion(null);
    setShowForm(true);
  };

  return (
    <div className="solicitudes-tab">
      <div className="solicitudes-header">
        <h4 className="section-title">
          <i className="bi bi-envelope-paper me-2 text-success"></i>
          Mis Solicitudes
        </h4>
        <button
          className="btn-portal btn-portal-primary"
          onClick={openPanel}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Nueva Solicitud
        </button>
      </div>

      {saldoVacaciones && (
        <SaldoVacaciones saldo={saldoVacaciones} compact={true} />
      )}

      {/* Panel Slide-in */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="solicitud-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="solicitud-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              <div className="solicitud-panel-header">
                <div className="panel-header-icon">
                  <i className="bi bi-envelope-paper-fill"></i>
                </div>
                <div className="flex-grow-1">
                  <h4 className="mb-0 fw-bold">Nueva Solicitud</h4>
                  <p className="mb-0" style={{ opacity: 0.8, fontSize: '0.9rem' }}>Complete los datos de su solicitud</p>
                </div>
                <button className="btn-panel-close" onClick={() => setShowForm(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <form id="solicitud-form" onSubmit={handleSubmit} className="solicitud-panel-body">
                {/* Paso 1: Tipo */}
                <div className="form-step">
                  <div className="form-step-indicator">
                    <div className="step-number">1</div>
                    <div className="step-line"></div>
                  </div>
                  <div className="form-step-content">
                    <label className="form-step-label">Tipo de Solicitud</label>
                    <div className="tipo-selector-grid">
                      {tipoOpciones.map(tipo => (
                        <motion.div
                          key={tipo.value}
                          className={`tipo-option ${formData.tipo === tipo.value ? 'selected' : ''}`}
                          onClick={() => handleTipoSelect(tipo.value)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <i className={`bi ${tipo.icon}`} style={{ fontSize: '1.5rem', color: tipo.color }}></i>
                          <div className="tipo-option-label">{tipo.label}</div>
                          <div className="tipo-option-desc">{tipo.desc}</div>
                          {formData.tipo === tipo.value && (
                            <motion.div
                              className="tipo-check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <i className="bi bi-check-circle-fill"></i>
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Paso 2: Fechas */}
                <div className="form-step">
                  <div className="form-step-indicator">
                    <div className="step-number">2</div>
                    <div className="step-line"></div>
                  </div>
                  <div className="form-step-content">
                    <label className="form-step-label">Fechas</label>
                    <div className="dates-row">
                      <div className="date-field">
                        <label className="date-label">
                          <i className="bi bi-calendar-event me-1"></i>
                          Fecha Inicio *
                        </label>
                        <input
                          type="date"
                          name="fechaInicio"
                          className="form-control-panel"
                          value={formData.fechaInicio}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="date-field">
                        <label className="date-label">
                          <i className="bi bi-calendar-check me-1"></i>
                          Fecha Fin
                        </label>
                        <input
                          type="date"
                          name="fechaFin"
                          className="form-control-panel"
                          value={formData.fechaFin}
                          onChange={handleInputChange}
                        />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Dejar vacio si es un solo dia</small>
                      </div>
                    </div>

                    {/* Alerta de anticipacion */}
                    <AnimatePresence>
                      {alertaAnticipacion && (
                        <motion.div
                          className="anticipacion-alert"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="alert-content">
                            <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                            <span>{alertaAnticipacion.mensaje}</span>
                          </div>

                          <div className="emergency-toggle">
                            <label className="emergency-label">
                              <input
                                type="checkbox"
                                name="esEmergencia"
                                checked={formData.esEmergencia}
                                onChange={handleInputChange}
                                className="emergency-checkbox"
                              />
                              <span className="emergency-switch"></span>
                              <span className="emergency-text">
                                <i className="bi bi-lightning-fill text-danger me-1"></i>
                                Es una emergencia / imprevisto
                              </span>
                            </label>
                          </div>

                          <AnimatePresence>
                            {formData.esEmergencia && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <textarea
                                  name="motivoEmergencia"
                                  className="form-control-panel mt-2"
                                  placeholder="Explique detalladamente el motivo de la emergencia (minimo 10 caracteres)..."
                                  value={formData.motivoEmergencia}
                                  onChange={handleInputChange}
                                  rows="2"
                                  required
                                  style={{ borderColor: '#dc3545' }}
                                ></textarea>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Paso 3: Motivo */}
                <div className="form-step last">
                  <div className="form-step-indicator">
                    <div className="step-number">3</div>
                  </div>
                  <div className="form-step-content">
                    <label className="form-step-label">Motivo de la solicitud</label>
                    <textarea
                      name="motivo"
                      className="form-control-panel"
                      placeholder="Describa el motivo de su solicitud..."
                      value={formData.motivo}
                      onChange={handleInputChange}
                      rows="4"
                      required
                    ></textarea>
                  </div>
                </div>
              </form>

              <div className="solicitud-panel-footer">
                <button
                  type="button"
                  className="btn-panel-cancel"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="solicitud-form"
                  className="btn-panel-submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-2"></i>
                      Enviar Solicitud
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lista de solicitudes */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-envelope-open"></i>
          <h5>Sin solicitudes</h5>
          <p>No tienes solicitudes registradas</p>
        </div>
      ) : (
        <>
          {solicitudesPendientes.length > 0 && (
            <div className="solicitudes-seccion">
              <h5 className="seccion-titulo">
                <i className="bi bi-hourglass-split me-2"></i>
                Pendientes ({solicitudesPendientes.length})
              </h5>
              <div className="solicitudes-lista">
                {solicitudesPendientes.map((solicitud) => (
                  <div key={solicitud.id} className="solicitud-card pendiente">
                    <div className="solicitud-header">
                      <div className="solicitud-tipo">
                        <i className={`bi ${obtenerIconoTipo(solicitud.tipo)}`}></i>
                        {obtenerNombreTipo(solicitud.tipo)}
                      </div>
                      <div className="d-flex gap-1 align-items-center">
                        {solicitud.esEmergencia && (
                          <span className="badge bg-danger">
                            <i className="bi bi-lightning-fill me-1"></i>
                            Emergencia
                          </span>
                        )}
                        {!solicitud.esEmergencia && solicitud.requiereRevisionUrgente && (
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-clock me-1"></i>
                            Urgente
                          </span>
                        )}
                        <span className={`badge ${getEstadoBadgeClass(solicitud.estado)}`}>
                          {getEstadoLabel(solicitud.estado)}
                        </span>
                      </div>
                    </div>

                    <div className="solicitud-body">
                      <div className="solicitud-fechas">
                        <i className="bi bi-calendar3 me-2"></i>
                        {solicitud.fechaInicio}
                        {solicitud.fechaFin && solicitud.fechaFin !== solicitud.fechaInicio && (
                          <> - {solicitud.fechaFin}</>
                        )}
                        {solicitud.diasAnticipacion !== undefined && (
                          <small className="ms-2 text-muted">
                            ({solicitud.diasAnticipacion} dias de anticipacion)
                          </small>
                        )}
                      </div>
                      <div className="solicitud-motivo">
                        <strong>Motivo:</strong> {solicitud.motivo}
                      </div>
                      {solicitud.esEmergencia && solicitud.motivoEmergencia && (
                        <div className="solicitud-motivo text-danger">
                          <strong><i className="bi bi-lightning-fill"></i> Motivo Emergencia:</strong> {solicitud.motivoEmergencia}
                        </div>
                      )}
                    </div>

                    <div className="solicitud-footer">
                      <small className="text-muted">
                        Creada: {solicitud.fechaCreacion ?
                          (solicitud.fechaCreacion.toDate ?
                            solicitud.fechaCreacion.toDate().toLocaleDateString('es-MX') :
                            new Date(solicitud.fechaCreacion).toLocaleDateString('es-MX')) : '-'}
                      </small>
                      <button
                        className="btn-portal btn-portal-danger btn-sm"
                        onClick={() => handleCancelar(solicitud.id)}
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {solicitudesResueltas.length > 0 && (
            <div className="solicitudes-seccion historial">
              <h5 className="seccion-titulo">
                <i className="bi bi-check-circle me-2"></i>
                Historial ({solicitudesResueltas.length})
              </h5>
              <div className="solicitudes-lista">
                {solicitudesResueltas.map((solicitud) => (
                  <div key={solicitud.id} className={`solicitud-card ${solicitud.estado}`}>
                    <div className="solicitud-header">
                      <div className="solicitud-tipo">
                        <i className={`bi ${obtenerIconoTipo(solicitud.tipo)}`}></i>
                        {obtenerNombreTipo(solicitud.tipo)}
                      </div>
                      <span className={`badge ${getEstadoBadgeClass(solicitud.estado)}`}>
                        {getEstadoLabel(solicitud.estado)}
                      </span>
                    </div>

                    <div className="solicitud-body">
                      <div className="solicitud-fechas">
                        <i className="bi bi-calendar3 me-2"></i>
                        {solicitud.fechaInicio}
                        {solicitud.fechaFin && solicitud.fechaFin !== solicitud.fechaInicio && (
                          <> - {solicitud.fechaFin}</>
                        )}
                      </div>
                      <div className="solicitud-motivo">
                        <strong>Motivo:</strong> {solicitud.motivo}
                      </div>
                      {solicitud.comentariosAdmin && (
                        <div className="solicitud-comentario">
                          <i className="bi bi-chat-left-text me-2"></i>
                          <strong>Comentario RH:</strong> {solicitud.comentariosAdmin}
                        </div>
                      )}
                    </div>

                    <div className="solicitud-footer">
                      <small className="text-muted">
                        Creada: {solicitud.fechaCreacion ?
                          (solicitud.fechaCreacion.toDate ?
                            solicitud.fechaCreacion.toDate().toLocaleDateString('es-MX') :
                            new Date(solicitud.fechaCreacion).toLocaleDateString('es-MX')) : '-'}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SolicitudesTab;
