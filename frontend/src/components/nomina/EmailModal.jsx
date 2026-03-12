import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { api } from '../../services/api';

export default function EmailModal({
  show,
  onClose,
  nominasCalculadas,
  mesSeleccionado,
  quincenaSeleccionada,
  showNotification
}) {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [sendingEmails, setSendingEmails] = useState(false);

  // Initialize data when modal opens
  useEffect(() => {
    if (show && nominasCalculadas.length > 0) {
      const [anio, mes] = mesSeleccionado.split('-');
      const mesNombre = new Date(anio, mes - 1).toLocaleDateString('es-MX', { month: 'long' });
      const periodoTexto = quincenaSeleccionada === 'primera' ? 'Primera Quincena' : 'Segunda Quincena';
      setEmailSubject(`Nómina ${periodoTexto} - ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`);
      setEmailMessage('');

      // Seleccionar todos los empleados con email válido por defecto
      const empleadosConEmail = nominasCalculadas.filter(nomina => {
        const empleado = nomina.empleado || {};
        const email = empleado.email || empleado.correo;
        return email && email.includes('@');
      });
      setSelectedEmployees(empleadosConEmail.map(n => n.empleado.uid || n.uid));
    }
  }, [show, nominasCalculadas, mesSeleccionado, quincenaSeleccionada]);

  if (!show) return null;

  const seleccionarTodosEmpleados = (seleccionar) => {
    if (seleccionar) {
      const empleadosConEmail = nominasCalculadas
        .filter(nomina => {
          const empleado = nomina.empleado || {};
          const email = empleado.email || empleado.correo;
          return email && email.includes('@');
        })
        .map(n => n.empleado.uid || n.uid);
      setSelectedEmployees(empleadosConEmail);
    } else {
      setSelectedEmployees([]);
    }
  };

  const toggleEmpleadoSeleccionado = (uid) => {
    setSelectedEmployees(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      return [...prev, uid];
    });
  };

  const confirmarEnvioEmails = async () => {
    if (!emailSubject.trim()) {
      showNotification('Por favor ingresa un asunto para el email', 'warning');
      return;
    }

    if (selectedEmployees.length === 0) {
      showNotification('No has seleccionado ningún empleado', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: '¿Enviar correos?',
      text: `¿Enviar nóminas por email a ${selectedEmployees.length} empleado(s)?\n\nAsunto: ${emailSubject}\nMensaje personalizado: ${emailMessage ? 'Sí' : 'No'}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4361ee',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      setSendingEmails(true);
      showNotification('Enviando correos...', 'info');

      const [anio, mes] = mesSeleccionado.split('-');

      const nominasSeleccionadas = nominasCalculadas.filter(nomina => {
        const uid = nomina.empleado?.uid || nomina.uid;
        return selectedEmployees.includes(uid);
      });

      const resp = await api.sendPayrollEmails(nominasSeleccionadas, {
        mes: parseInt(mes),
        anio: parseInt(anio),
        quincena: quincenaSeleccionada
      });
      const resultados = resp.data?.data || { exitosos: [], fallidos: [] };

      showNotification(
        `✅ Correos enviados: ${resultados.exitosos.length} exitosos${resultados.fallidos.length > 0 ? `, ${resultados.fallidos.length} fallidos` : ''}`,
        'success'
      );

      if (resultados.fallidos.length > 0) {
        console.log('Correos fallidos:', resultados.fallidos);
        const fallidosMsg = resultados.fallidos.map(f => `- ${f.empleado}: ${f.razon}`).join('\n');
        alert(`Algunos correos no se pudieron enviar:\n\n${fallidosMsg}`);
      }

      onClose();
    } catch (error) {
      console.error('[Nómina] Error enviando correos:', error);
      showNotification('Error al enviar correos: ' + error.message, 'error');
    } finally {
      setSendingEmails(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
            <h5 className="modal-title">
              <i className="bi bi-envelope me-2"></i>Enviar Nóminas por Correo
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Información:</strong> Se enviarán los tickets de nómina usando EmailJS a los correos de cada empleado seleccionado.
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Asunto del correo:</label>
              <input
                type="text"
                className="form-control"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Asunto del correo"
                disabled={sendingEmails}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Mensaje personalizado (opcional):</label>
              <textarea
                className="form-control"
                rows="3"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Agregar mensaje personalizado para los empleados..."
                disabled={sendingEmails}
              ></textarea>
            </div>

            <div className="card">
              <div className="card-header bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">
                    Seleccionar destinatarios
                    <span className="badge bg-primary ms-2">{selectedEmployees.length}</span>
                  </h6>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => seleccionarTodosEmpleados(true)}
                      disabled={sendingEmails}
                    >
                      <i className="bi bi-check-all me-1"></i>Todos
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => seleccionarTodosEmpleados(false)}
                      disabled={sendingEmails}
                    >
                      <i className="bi bi-x-lg me-1"></i>Ninguno
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div className="list-group">
                  {nominasCalculadas.map((nomina, index) => {
                    const empleado = nomina.empleado || {};
                    const email = empleado.email || empleado.correo;
                    const uid = empleado.uid || nomina.uid || index;
                    const tieneEmail = email && email.includes('@');
                    const isSelected = selectedEmployees.includes(uid);

                    return (
                      <label
                        key={uid}
                        className={`list-group-item d-flex align-items-center gap-3 ${!tieneEmail ? 'disabled' : ''}`}
                        style={{ cursor: tieneEmail ? 'pointer' : 'not-allowed' }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input flex-shrink-0"
                          checked={isSelected}
                          disabled={!tieneEmail || sendingEmails}
                          onChange={() => toggleEmpleadoSeleccionado(uid)}
                          style={{ width: '1.2rem', height: '1.2rem' }}
                        />
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <strong className={!tieneEmail ? 'text-muted' : ''}>
                                {empleado.nombre || 'Sin nombre'}
                              </strong>
                              <br />
                              <small className="text-muted">
                                <i className="bi bi-envelope me-1"></i>
                                {email || 'Sin email registrado'}
                              </small>
                            </div>
                            <div className="text-end">
                              <span className={`badge ${tieneEmail ? 'bg-success' : 'bg-danger'} mb-1`}>
                                {tieneEmail ? '✓ Válido' : '✗ Sin email'}
                              </span>
                              <br />
                              <span className="badge bg-info">
                                <i className="bi bi-cash me-1"></i>
                                ${Math.round(nomina.pagoFinal || 0).toLocaleString('es-MX')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 p-2 bg-light rounded">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Solo los empleados con email válido pueden ser seleccionados.
                  </small>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={sendingEmails}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={confirmarEnvioEmails}
              disabled={selectedEmployees.length === 0 || sendingEmails}
            >
              {sendingEmails ? (
                <span><i className="spinner-border spinner-border-sm me-2"></i>Enviando...</span>
              ) : (
                <span><i className="bi bi-send me-2"></i>Enviar {selectedEmployees.length} Email{selectedEmployees.length !== 1 ? 's' : ''}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
