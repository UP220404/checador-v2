import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { api } from '../services/api';
import CustomNotification from '../components/CustomNotification';
import EmailModal from '../components/nomina/EmailModal';
import FestivosModal from '../components/nomina/FestivosModal';
import '../styles/Nomina.css';

function Nomina() {
  const [accesoValidado, setAccesoValidado] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSalaryManager, setShowSalaryManager] = useState(false);
  const [accessError, setAccessError] = useState(false);

  // Estados para gestión de salarios
  const [empleados, setEmpleados] = useState([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');
  const [datosEmpleado, setDatosEmpleado] = useState(null);
  const [editandoEmpleado, setEditandoEmpleado] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState({});

  // Estados para cálculo de nómina
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState('primera');
  const [tipoNomina, setTipoNomina] = useState('quincenal');
  const [nominasCalculadas, setNominasCalculadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vistaActual, setVistaActual] = useState('compacta');

  // Estados para festivos
  const [showFestivosModal, setShowFestivosModal] = useState(false);
  const [festivos, setFestivos] = useState([]);
  const [nuevoFestivo, setNuevoFestivo] = useState({
    fecha: '',
    nombre: '',
    tipo: 'federal'
  });
  const [loadingFestivos, setLoadingFestivos] = useState(false);
  const [vistaTabla, setVistaTabla] = useState(false); // false = tarjetas, true = tabla

  // Estados para modal de envío de emails
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Sistema de notificaciones
  const [notification, setNotification] = useState(null);

  // Resumen
  const [resumen, setResumen] = useState({
    totalEmpleados: 0,
    totalRetardos: 0,
    empleadosConDescuento: 0,
    totalPagar: 0
  });

  // Función de notificaciones
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  useEffect(() => {
    if (accesoValidado) {
      cargarEmpleados();
    }
  }, [accesoValidado]);

  useEffect(() => {
    // Configurar fecha actual por defecto
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setMesSeleccionado(mesActual);
  }, []);

  // Cargar festivos cuando se abra el modal y haya un mes seleccionado
  useEffect(() => {
    if (showFestivosModal && mesSeleccionado) {
      cargarFestivos();
    }
  }, [showFestivosModal, mesSeleccionado]);

  const validarAcceso = async () => {
    try {
      const response = await api.validatePayrollPassword(password);
      if (response.data.success) {
        setAccesoValidado(true);
        setAccessError(false);
        showNotification('Acceso autorizado correctamente', 'success');
      } else {
        setAccessError(true);
        setPassword('');
        setTimeout(() => setAccessError(false), 500);
        showNotification('Contraseña incorrecta', 'error');
      }
    } catch (error) {
      console.error('Error validando contraseña:', error);
      setAccessError(true);
      setTimeout(() => setAccessError(false), 500);

      const status = error.response?.status;
      if (status === 403) {
        showNotification('No tienes permisos de administrador (admin_rh) para acceder a este modulo.', 'error');
      } else if (status === 401) {
        showNotification('Sesion expirada. Inicia sesion nuevamente.', 'error');
      } else {
        showNotification('Error al validar. Verifica tu conexion.', 'error');
      }
    }
  };

  const cargarEmpleados = async () => {
    try {
      const response = await api.getUsers();
      if (response.data.success) {
        setEmpleados(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando empleados:', error);
    }
  };

  const cargarDatosEmpleado = async () => {
    if (!empleadoSeleccionado) {
      showNotification('Selecciona un empleado', 'warning');
      return;
    }

    try {
      // Cargar datos del empleado (incluye toda la configuración de nómina)
      const userResponse = await api.getUserById(empleadoSeleccionado);
      if (userResponse.data.success) {
        const userData = userResponse.data.data;

        console.log('[Nómina] Datos del empleado:', userData);

        setDatosEmpleado(userData);
        setDatosEdicion(userData);
        setEditandoEmpleado(false);
        showNotification('Datos cargados correctamente', 'success');
      }
    } catch (error) {
      console.error('Error cargando datos del empleado:', error);
      showNotification('Error al cargar datos del empleado', 'error');
    }
  };

  const iniciarEdicion = () => {
    setEditandoEmpleado(true);
    setDatosEdicion({ ...datosEmpleado });
  };

  const cancelarEdicion = () => {
    setEditandoEmpleado(false);
    setDatosEdicion({ ...datosEmpleado });
  };

  const guardarCambiosEmpleado = async () => {
    if (!datosEdicion.salarioQuincenal || datosEdicion.salarioQuincenal <= 0) {
      showNotification('El salario quincenal debe ser mayor a 0', 'warning');
      return;
    }

    if (!datosEdicion.horasQuincenal || datosEdicion.horasQuincenal <= 0) {
      showNotification('Las horas quincenales deben ser mayor a 0', 'warning');
      return;
    }

    if (datosEdicion.tieneCajaAhorro && (!datosEdicion.montoCajaAhorro || datosEdicion.montoCajaAhorro <= 0)) {
      showNotification('Si tiene caja de ahorro, debe especificar el monto', 'warning');
      return;
    }

    try {
      // Calcular pago por día
      const pagoPorDia = datosEdicion.tipoNomina === 'semanal'
        ? parseFloat((datosEdicion.salarioQuincenal / 5).toFixed(2))
        : parseFloat((datosEdicion.salarioQuincenal / 10).toFixed(2));

      const pagoPorHora = parseFloat((datosEdicion.salarioQuincenal / (datosEdicion.horasQuincenal || 1)).toFixed(2));

      const dataToUpdate = {
        salarioQuincenal: parseFloat(datosEdicion.salarioQuincenal),
        horasQuincenal: parseInt(datosEdicion.horasQuincenal),
        tipoNomina: datosEdicion.tipoNomina,
        tieneIMSS: datosEdicion.tieneIMSS,
        tieneCajaAhorro: datosEdicion.tieneCajaAhorro,
        montoCajaAhorro: datosEdicion.tieneCajaAhorro ? parseFloat(datosEdicion.montoCajaAhorro || 0) : 0,
        cuentaBancaria: datosEdicion.cuentaBancaria || '',
        nombreBanco: datosEdicion.nombreBanco || '',
        pagoPorDia,
        pagoPorHora
      };

      console.log('[Nómina] Actualizando empleado:', empleadoSeleccionado, dataToUpdate);

      const response = await api.updateUser(empleadoSeleccionado, dataToUpdate);

      if (response.data.success) {
        showNotification('Datos actualizados correctamente', 'success');
        setDatosEmpleado(response.data.data);
        setEditandoEmpleado(false);
        await cargarEmpleados(); // Recargar lista de empleados
      }
    } catch (error) {
      console.error('Error actualizando empleado:', error);
      showNotification('Error al actualizar los datos', 'error');
    }
  };

  // ========== FUNCIONES PARA GESTIONAR FESTIVOS ==========

  const cargarFestivos = async () => {
    if (!mesSeleccionado) return;

    try {
      setLoadingFestivos(true);
      const [anio] = mesSeleccionado.split('-');
      const response = await api.getHolidays(anio);

      if (response.data.success) {
        setFestivos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando festivos:', error);
      showNotification('Error al cargar días festivos', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  const agregarFestivo = async () => {
    if (!nuevoFestivo.fecha || !nuevoFestivo.nombre) {
      showNotification('Completa todos los campos', 'warning');
      return;
    }

    try {
      setLoadingFestivos(true);
      const response = await api.createHoliday(nuevoFestivo);

      if (response.data.success) {
        showNotification('Día festivo agregado correctamente', 'success');
        setNuevoFestivo({ fecha: '', nombre: '', tipo: 'federal' });
        await cargarFestivos();
      }
    } catch (error) {
      console.error('Error agregando festivo:', error);
      showNotification(error.response?.data?.message || 'Error al agregar festivo', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  const eliminarFestivo = async (festivoId) => {
    const result = await Swal.fire({
      title: '¿Eliminar festivo?',
      text: '¿Estás seguro de eliminar este día festivo?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      setLoadingFestivos(true);
      const response = await api.deleteHoliday(festivoId);

      if (response.data.success) {
        showNotification('Día festivo eliminado correctamente', 'success');
        await cargarFestivos();
      }
    } catch (error) {
      console.error('Error eliminando festivo:', error);
      showNotification('Error al eliminar festivo', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  // ========== FIN FUNCIONES FESTIVOS ==========

  const calcularNomina = async () => {
    if (!mesSeleccionado) {
      showNotification('Selecciona un mes', 'warning');
      return;
    }

    try {
      setLoading(true);

      const [anio, mes] = mesSeleccionado.split('-');

      console.log(`[Nómina] Calculando nómina: ${tipoNomina} - ${mes}/${anio} - ${quincenaSeleccionada}`);

      // Llamar al endpoint de cálculo y guardado automático
      const response = await api.calculateAndSavePayroll({
        mes: parseInt(mes),
        anio: parseInt(anio),
        periodo: quincenaSeleccionada,
        tipoNomina
      });

      console.log('[Nómina] Respuesta recibida:', response.data);

      if (response.data.success) {
        const empleados = response.data.data.empleados || [];
        const resumenData = response.data.data.resumen || {};

        setNominasCalculadas(empleados);
        setResumen({
          totalEmpleados: resumenData.totalEmpleados || empleados.length,
          totalRetardos: resumenData.totalRetardos || 0,
          empleadosConDescuento: resumenData.empleadosConDescuento || 0,
          totalPagar: resumenData.totalNominaFinal || resumenData.totalPagar || 0
        });

        showNotification(`Nómina calculada y guardada: ${empleados.length} empleados`, 'success');
      } else {
        showNotification('Error al calcular la nómina: ' + (response.data.message || 'Error desconocido'), 'error');
      }
    } catch (error) {
      console.error('[Nómina] Error calculando nómina:', error);
      showNotification('Error al calcular la nómina: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const guardarNomina = async () => {
    if (nominasCalculadas.length === 0) {
      showNotification('No hay nóminas para guardar', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: '¿Guardar Nómina?',
      text: '¿Deseas guardar esta nómina? Esto creará un registro permanente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      const [anio, mes] = mesSeleccionado.split('-');

      const response = await api.savePayroll({
        mes: parseInt(mes),
        anio: parseInt(anio),
        periodo: quincenaSeleccionada,
        tipoNomina,
        resultados: nominasCalculadas,
        resumen
      });

      if (response.data.success) {
        showNotification('Nómina guardada exitosamente', 'success');
        console.log('[Nómina] ID guardado:', response.data.data.id);
      } else {
        showNotification('Error al guardar la nómina: ' + (response.data.message || 'Error desconocido'), 'error');
      }
    } catch (error) {
      console.error('[Nómina] Error guardando:', error);
      showNotification('Error al guardar: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  const exportarExcel = async () => {
    if (nominasCalculadas.length === 0) {
      showNotification('No hay nóminas para exportar', 'warning');
      return;
    }

    try {
      // Crear CSV manualmente con todos los detalles
      const headers = [
        'Empleado',
        'Email',
        'Tipo',
        'Banco',
        'Cuenta',
        'Días Esperados',
        'Días Trabajados',
        'Retardos',
        'Faltas',
        'Días Efectivos',
        'Salario Base',
        'Pago por Día',
        'Pago Total',
        'Descuento IMSS',
        'Descuento Caja',
        'Total Descuentos',
        'Total a Pagar',
        'Status'
      ];

      const rows = nominasCalculadas.map(nomina => {
        const empleadoInfo = nomina.empleado || {};
        const nombre = empleadoInfo.nombre || nomina.nombre || empleadoInfo.email || nomina.email || 'Sin nombre';

        return [
          nombre,
          empleadoInfo.email || '',
          empleadoInfo.tipo || '',
          empleadoInfo.nombreBanco || '',
          empleadoInfo.cuentaBancaria || '',
          nomina.diasLaboralesEsperados || 0,
          nomina.diasTrabajados || 0,
          nomina.retardos || 0,
          nomina.diasFaltantes || 0,
          nomina.diasEfectivos || 0,
          nomina.salarioQuincenal || 0,
          nomina.pagoPorDia || 0,
          nomina.pagoTotal || 0,
          nomina.descuentoIMSS || 0,
          nomina.descuentoCaja || 0,
          nomina.totalDescuentos || 0,
          nomina.pagoFinal || 0,
          nomina.status || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Agregar BOM para UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nomina_${mesSeleccionado}_${quincenaSeleccionada}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('Archivo CSV exportado exitosamente', 'success');
    } catch (error) {
      console.error('[Nómina] Error exportando:', error);
      showNotification('Error al exportar: ' + error.message, 'error');
    }
  };

  // Funciones para modal de envío de emails
  // Abrir modal
  const abrirModalEnvioEmail = () => {
    if (nominasCalculadas.length === 0) {
      showNotification('No hay nóminas calculadas para enviar', 'warning');
      return;
    }
    setShowEmailModal(true);
  };



  // Modal de validación de acceso
  if (!accesoValidado) {
    return (
      <div className="nomina-page">
        <div className="modal-overlay">
          <div className="modal-dialog-centered">
            <div className={`security-modal ${accessError ? 'acceso-denegado' : ''}`}>
              {/* Icono de seguridad grande */}
              <div className="security-icon-container">
                <div className="security-icon-wrapper">
                  <i className="bi bi-shield-lock-fill"></i>
                </div>
              </div>

              {/* Contenido */}
              <div className="security-content">
                <h2 className="security-title">Acceso Restringido</h2>
                <p className="security-subtitle">Sistema de Nómina - Cielito Home</p>

                <div className="security-warning">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Esta área contiene información financiera confidencial</span>
                </div>

                <div className="security-form-group">
                  <label className="security-label">Contraseña de Autorización</label>
                  <div className="security-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="passwordNomina"
                      className="security-input"
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && validarAcceso()}
                      maxLength={20}
                      autoComplete="off"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="security-input-icon"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                    </button>
                  </div>
                </div>

                <div className="security-buttons">
                  <button className="security-btn security-btn-primary" onClick={validarAcceso}>
                    <i className="bi bi-unlock-fill me-2"></i>
                    Validar Acceso
                  </button>
                  <a href="/admin/dashboard" className="security-btn security-btn-secondary">
                    <i className="bi bi-arrow-left me-2"></i>
                    Regresar al Dashboard
                  </a>
                </div>

                <div className="security-footer">
                  <i className="bi bi-info-circle"></i>
                  <span>Solo personal autorizado de RH y Dirección</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        {notification && (
          <CustomNotification
            message={notification.message}
            type={notification.type}
            onClose={closeNotification}
          />
        )}
      </div>
    );
  }

  // Vista principal de nómina
  return (
    <div className="nomina-page">
      {/* Navbar */}
      <nav className="nomina-navbar">
        <div className="nomina-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <div className="brand-icon">
                <i className="bi bi-calculator-fill"></i>
              </div>
              <div style={{ marginLeft: '0.5rem' }}>
                <div className="brand-title">Sistema de Nómina</div>
                <div className="brand-subtitle">Cielito Home</div>
              </div>
            </a>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-nav"
                onClick={() => setShowSalaryManager(!showSalaryManager)}
              >
                <i className="bi bi-person-gear me-2"></i>
                <span>Gestionar Salarios</span>
              </button>
              <a href="/admin/dashboard" className="btn-nav">
                <i className="bi bi-arrow-left me-2"></i>
                <span>Panel Admin</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="nomina-container">
        {/* Gestión de Salarios */}
        {showSalaryManager && (
          <div className="period-selector">
            <h4><i className="bi bi-person-gear me-2"></i>Gestión de Salarios Individuales</h4>
            <div className="period-row">
              <div>
                <label className="form-label">Seleccionar Empleado</label>
                <select
                  className="form-select"
                  value={empleadoSeleccionado}
                  onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar empleado...</option>
                  {empleados.map((emp, idx) => (
                    <option key={emp.id || emp.uid || idx} value={emp.id || emp.uid}>
                      {emp.nombre || emp.correo || emp.email || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">&nbsp;</label>
                <button className="btn btn-success w-100" onClick={cargarDatosEmpleado} style={{ width: '100%' }}>
                  <i className="bi bi-person-check me-2"></i>
                  Cargar Datos
                </button>
              </div>
            </div>

{datosEmpleado && (
              <div style={{
                marginTop: '1rem',
                padding: '1.5rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h6 style={{ margin: 0 }}><i className="bi bi-person-badge me-2"></i>Información del Empleado</h6>
                  {!editandoEmpleado && (
                    <button className="btn btn-success" onClick={iniciarEdicion} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      <i className="bi bi-pencil-square me-1"></i>
                      Editar
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Nombre Completo</label>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>{datosEmpleado.nombre || 'Sin nombre'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Correo Electrónico</label>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>{datosEmpleado.correo || datosEmpleado.email || 'Sin correo'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Tipo de Usuario</label>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>{datosEmpleado.tipo || 'empleado'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Estado</label>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        background: datosEmpleado.activo !== false ? '#d1fae5' : '#fee2e2',
                        color: datosEmpleado.activo !== false ? '#065f46' : '#991b1b'
                      }}>
                        {datosEmpleado.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                  <h6 style={{ marginBottom: '1rem' }}><i className="bi bi-cash-coin me-2"></i>Configuración de Nómina</h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Salario Quincenal</label>
                      {editandoEmpleado ? (
                        <input
                          type="number"
                          className="form-control"
                          value={datosEdicion.salarioQuincenal || ''}
                          onChange={(e) => setDatosEdicion({ ...datosEdicion, salarioQuincenal: e.target.value })}
                          placeholder="0"
                        />
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem', color: '#059669' }}>
                          ${(datosEmpleado.salarioQuincenal || 0).toLocaleString('es-MX')}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Horas Quincenales</label>
                      {editandoEmpleado ? (
                        <input
                          type="number"
                          className="form-control"
                          value={datosEdicion.horasQuincenal || ''}
                          onChange={(e) => setDatosEdicion({ ...datosEdicion, horasQuincenal: e.target.value })}
                          placeholder="0"
                        />
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.horasQuincenal || 0} hrs
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Tipo de Nómina</label>
                      {editandoEmpleado ? (
                        <select
                          className="form-select"
                          value={datosEdicion.tipoNomina || 'quincenal'}
                          onChange={(e) => setDatosEdicion({ ...datosEdicion, tipoNomina: e.target.value })}
                        >
                          <option value="quincenal">Quincenal</option>
                          <option value="semanal">Semanal</option>
                        </select>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.tipoNomina || 'quincenal'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>IMSS</label>
                      {editandoEmpleado ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="editIMSS"
                            checked={datosEdicion.tieneIMSS || false}
                            onChange={(e) => setDatosEdicion({ ...datosEdicion, tieneIMSS: e.target.checked })}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <label htmlFor="editIMSS" style={{ fontSize: '14px', cursor: 'pointer' }}>Tiene IMSS</label>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.tieneIMSS ? '✓ Sí' : '✗ No'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Caja de Ahorro</label>
                      {editandoEmpleado ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="editCajaAhorro"
                            checked={datosEdicion.tieneCajaAhorro || false}
                            onChange={(e) => setDatosEdicion({ ...datosEdicion, tieneCajaAhorro: e.target.checked })}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <label htmlFor="editCajaAhorro" style={{ fontSize: '14px', cursor: 'pointer' }}>Participa en caja de ahorro</label>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.tieneCajaAhorro
                            ? `✓ Sí - $${(datosEmpleado.montoCajaAhorro || 0).toLocaleString('es-MX')}`
                            : '✗ No'}
                        </div>
                      )}
                    </div>
                    {(editandoEmpleado ? datosEdicion.tieneCajaAhorro : datosEmpleado.tieneCajaAhorro) && (
                      <div>
                        <label className="form-label" style={{ fontSize: '12px' }}>Monto Caja de Ahorro</label>
                        {editandoEmpleado ? (
                          <input
                            type="number"
                            className="form-control"
                            value={datosEdicion.montoCajaAhorro || ''}
                            onChange={(e) => setDatosEdicion({ ...datosEdicion, montoCajaAhorro: e.target.value })}
                            placeholder="0"
                          />
                        ) : (
                          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                            ${(datosEmpleado.montoCajaAhorro || 0).toLocaleString('es-MX')}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Banco</label>
                      {editandoEmpleado ? (
                        <select
                          className="form-select"
                          value={datosEdicion.nombreBanco || ''}
                          onChange={(e) => setDatosEdicion({ ...datosEdicion, nombreBanco: e.target.value })}
                        >
                          <option value="">Seleccionar banco...</option>
                          <option value="BBVA">BBVA</option>
                          <option value="Santander">Santander</option>
                          <option value="Banamex">Banamex</option>
                          <option value="Banorte">Banorte</option>
                          <option value="HSBC">HSBC</option>
                          <option value="Scotiabank">Scotiabank</option>
                          <option value="Inbursa">Inbursa</option>
                          <option value="Azteca">Azteca</option>
                          <option value="Afirme">Afirme</option>
                          <option value="BanBajio">BanBajio</option>
                          <option value="Otro">Otro</option>
                        </select>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.nombreBanco || 'No especificado'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '12px' }}>Cuenta Bancaria</label>
                      {editandoEmpleado ? (
                        <input
                          type="text"
                          className="form-control"
                          value={datosEdicion.cuentaBancaria || ''}
                          onChange={(e) => setDatosEdicion({ ...datosEdicion, cuentaBancaria: e.target.value })}
                          placeholder="Número de cuenta"
                        />
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '0.25rem' }}>
                          {datosEmpleado.cuentaBancaria || 'No especificada'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {editandoEmpleado && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={cancelarEdicion}>
                      <i className="bi bi-x-circle me-2"></i>
                      Cancelar
                    </button>
                    <button className="btn btn-success" onClick={guardarCambiosEmpleado}>
                      <i className="bi bi-check-circle me-2"></i>
                      Guardar Cambios
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selector de Período */}
        <div className="period-selector">
          <h4><i className="bi bi-calendar3 me-2"></i>Configuración de Nómina</h4>
          <div className="period-row">
            <div>
              <label className="form-label">Mes y Año</label>
              <input
                type="month"
                className="form-control"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Tipo de Nómina</label>
              <select
                className="form-select"
                value={tipoNomina}
                onChange={(e) => setTipoNomina(e.target.value)}
              >
                <option value="quincenal">📅 Nómina Quincenal</option>
                <option value="semanal">📆 Nómina Semanal</option>
              </select>
            </div>
            {tipoNomina === 'quincenal' && (
              <div>
                <label className="form-label">Quincena</label>
                <select
                  className="form-select"
                  value={quincenaSeleccionada}
                  onChange={(e) => setQuincenaSeleccionada(e.target.value)}
                >
                  <option value="primera">Primera Quincena (1-15)</option>
                  <option value="segunda">Segunda Quincena (16-fin de mes)</option>
                </select>
              </div>
            )}
            <div>
              <label className="form-label">&nbsp;</label>
              <button
                className="btn btn-success"
                onClick={calcularNomina}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                    Calculando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-calculator me-2"></i>
                    Calcular Nómina
                  </>
                )}
              </button>
            </div>
            <div>
              <label className="form-label">&nbsp;</label>
              <button
                className="btn btn-outline-primary"
                onClick={() => setShowFestivosModal(true)}
                style={{ width: '100%' }}
              >
                <i className="bi bi-calendar-event me-1"></i>
                Días Festivos
              </button>
            </div>
          </div>
        </div>

        {/* Resumen */}
        {nominasCalculadas.length > 0 && (
          <div className="summary-card">
            <div className="summary-stats">
              <div className="summary-stat">
                <h4 className="mb-0"><i className="bi bi-graph-up me-2"></i>Resumen General</h4>
              </div>
              <div className="summary-stat">
                <span className="summary-number">{resumen.totalEmpleados}</span>
                <div className="summary-label">Empleados</div>
              </div>
              <div className="summary-stat">
                <span className="summary-number">{resumen.totalRetardos}</span>
                <div className="summary-label">Retardos Totales</div>
              </div>
              <div className="summary-stat">
                <span className="summary-number">{resumen.empleadosConDescuento}</span>
                <div className="summary-label">Con Descuento</div>
              </div>
              <div className="summary-stat">
                <span className="summary-number">${resumen.totalPagar.toLocaleString('es-MX')}</span>
                <div className="summary-label">Total a Pagar</div>
              </div>
            </div>
          </div>
        )}

        {/* Botón para cambiar vista */}
        {nominasCalculadas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => setVistaTabla(!vistaTabla)}
              className="btn btn-outline-success"
              style={{ borderRadius: '8px' }}
            >
              <i className={`bi ${vistaTabla ? 'bi-grid-3x3-gap' : 'bi-table'} me-2`}></i>
              {vistaTabla ? 'Ver Tarjetas' : 'Ver Tabla'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-spinner">
            <div className="spinner-border"></div>
            <span>Calculando nómina...</span>
          </div>
        )}

        {/* Resultados - Vista Tarjetas */}
        {!loading && nominasCalculadas.length > 0 && !vistaTabla && (
          <div className="employee-grid-compact">
            {nominasCalculadas.map((nomina, index) => {
              const empleadoInfo = nomina.empleado || {};
              const nombre = empleadoInfo.nombre || nomina.nombre || empleadoInfo.email || nomina.email || 'Sin nombre';
              const uid = empleadoInfo.uid || nomina.uid || nomina.id || index;
              const diasDescuento = nomina.diasDescuento || 0;

              const formatearNumero = (num) => {
                return Math.round(num || 0).toLocaleString('es-MX');
              };

              const formatearTipoEmpleado = (tipo) => {
                const tipos = {
                  'tiempo_completo': 'T.C.',
                  'becario': 'Becario',
                  'horario_especial': 'H.Esp.',
                  'empleado': 'Emp.'
                };
                return tipos[tipo] || tipo || 'Emp.';
              };

              const formatearTipoNomina = (tipo) => {
                return tipo === 'semanal' ? 'Sem.' : 'Quin.';
              };

              return (
                <div key={uid} className="employee-card-compact">
                  {/* Header compact */}
                  <div className="compact-header">
                    <div className="compact-name">
                      <strong>{nombre}</strong>
                      <span className="badge bg-secondary ms-1" style={{ fontSize: '0.7rem' }}>
                        {formatearTipoEmpleado(empleadoInfo.tipo)}
                      </span>
                      <span className={`badge ${empleadoInfo.tipoNomina === 'semanal' ? 'bg-info' : 'bg-success'} ms-1`} style={{ fontSize: '0.7rem' }}>
                        {formatearTipoNomina(empleadoInfo.tipoNomina)}
                      </span>
                    </div>
                  </div>

                  {/* Compact stats - 4 columnas */}
                  <div className="compact-stats">
                    <div className="compact-stat">
                      <span className={`stat-value ${nomina.diasTrabajados < nomina.diasLaboralesEsperados ? 'text-warning' : 'text-success'}`}>
                        {nomina.diasTrabajados || 0}
                      </span>
                      <small>Días</small>
                    </div>
                    <div className="compact-stat">
                      <span className={`stat-value ${nomina.retardos > 0 ? 'text-warning' : 'text-success'}`}>
                        {nomina.retardos || 0}
                      </span>
                      <small>Retardos</small>
                    </div>
                    <div className="compact-stat">
                      <span className={`stat-value ${nomina.diasFaltantes > 0 ? 'text-danger' : 'text-success'}`}>
                        {nomina.diasFaltantes || 0}
                      </span>
                      <small>Faltas</small>
                    </div>
                    <div className="compact-stat highlight">
                      <span className="stat-value text-success">${formatearNumero(nomina.pagoFinal)}</span>
                      <small>Final</small>
                    </div>
                  </div>

                  {/* Descuento badge si hay descuento por retardos */}
                  {diasDescuento > 0 && (
                    <div className="descuento-badge">
                      <div className="alert alert-warning">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        <strong>Descuento: {diasDescuento} día{diasDescuento > 1 ? 's' : ''}</strong>
                        <small>Por {nomina.retardos} retardos (4 retardos = 1 día)</small>
                      </div>
                    </div>
                  )}

                  {/* Compact details - desglose financiero */}
                  <div className="compact-details">
                    <div className="compact-detail-row">
                      <span className="detail-label">Subtotal:</span>
                      <span className="detail-value">${formatearNumero(nomina.pagoTotal)}</span>
                    </div>

                    {nomina.descuentoIMSS > 0 && (
                      <div className="compact-detail-row discount">
                        <span className="detail-label">IMSS:</span>
                        <span className="detail-value text-danger">-${nomina.descuentoIMSS}</span>
                      </div>
                    )}

                    {nomina.descuentoCaja > 0 && (
                      <div className="compact-detail-row discount">
                        <span className="detail-label">Caja de ahorro:</span>
                        <span className="detail-value text-danger">-${formatearNumero(nomina.descuentoCaja)}</span>
                      </div>
                    )}

                    <div className="compact-detail-row final">
                      <span className="detail-label"><strong>PAGO FINAL:</strong></span>
                      <span className="detail-value text-success"><strong>${formatearNumero(nomina.pagoFinal)}</strong></span>
                    </div>
                  </div>

                  {/* Compact status */}
                  <div className={`compact-status ${nomina.statusClass || 'status-ok'}`}>
                    {nomina.status || 'OK'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resultados - Vista Tabla */}
        {!loading && nominasCalculadas.length > 0 && vistaTabla && (
          <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
            <table className="table table-striped table-hover">
              <thead className="table-success">
                <tr>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th>Días</th>
                  <th>Retardos</th>
                  <th>Faltas</th>
                  <th>Días Efectivos</th>
                  <th>Salario Base</th>
                  <th>Pago por Día</th>
                  <th>Subtotal</th>
                  <th>Desc. IMSS</th>
                  <th>Desc. Caja</th>
                  <th className="fw-bold">Total a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {nominasCalculadas.map((nomina, index) => {
                  const empleadoInfo = nomina.empleado || {};
                  const nombre = empleadoInfo.nombre || nomina.nombre || empleadoInfo.email || nomina.email || 'Sin nombre';
                  const uid = empleadoInfo.uid || nomina.uid || nomina.id || index;

                  const formatearNumero = (num) => {
                    return Math.round(num || 0).toLocaleString('es-MX');
                  };

                  return (
                    <tr key={uid}>
                      <td className="fw-bold">{nombre}</td>
                      <td>
                        <span className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                          {empleadoInfo.tipo === 'tiempo_completo' ? 'T.C.' : empleadoInfo.tipo || 'Emp.'}
                        </span>
                      </td>
                      <td>
                        <span className={nomina.diasTrabajados < nomina.diasLaboralesEsperados ? 'text-warning fw-bold' : 'text-success fw-bold'}>
                          {nomina.diasTrabajados || 0}
                        </span>
                      </td>
                      <td>
                        <span className={nomina.retardos > 0 ? 'text-warning fw-bold' : ''}>
                          {nomina.retardos || 0}
                        </span>
                      </td>
                      <td>
                        <span className={nomina.diasFaltantes > 0 ? 'text-danger fw-bold' : ''}>
                          {nomina.diasFaltantes || 0}
                        </span>
                      </td>
                      <td>{nomina.diasEfectivos || 0}</td>
                      <td>${formatearNumero(nomina.salarioQuincenal)}</td>
                      <td>${formatearNumero(nomina.pagoPorDia)}</td>
                      <td>${formatearNumero(nomina.pagoTotal)}</td>
                      <td className="text-danger">
                        {nomina.descuentoIMSS > 0 ? `-$${nomina.descuentoIMSS}` : '-'}
                      </td>
                      <td className="text-danger">
                        {nomina.descuentoCaja > 0 ? `-$${formatearNumero(nomina.descuentoCaja)}` : '-'}
                      </td>
                      <td className="fw-bold text-success">${formatearNumero(nomina.pagoFinal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td colSpan="11" className="text-end fw-bold">TOTAL GENERAL:</td>
                  <td className="fw-bold text-success fs-5">${resumen.totalPagar.toLocaleString('es-MX')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Botones de Acción */}
        {nominasCalculadas.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-success" onClick={guardarNomina}>
              <i className="bi bi-floppy me-2"></i>
              Guardar Nómina
            </button>
            <button className="btn btn-success" onClick={exportarExcel} style={{ background: '#2563eb' }}>
              <i className="bi bi-file-earmark-spreadsheet me-2"></i>
              Exportar Excel
            </button>
            <button className="btn btn-success" onClick={abrirModalEnvioEmail} style={{ background: '#8b5cf6' }}>
              <i className="bi bi-envelope me-2"></i>
              Enviar por Correo
            </button>
          </div>
        )}

        {/* Mensaje si no hay datos */}
        {!loading && nominasCalculadas.length === 0 && mesSeleccionado && (
          <div className="loading-spinner">
            <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#9ca3af' }}></i>
            <span>Selecciona un período y haz clic en "Calcular Nómina"</span>
          </div>
        )}
      </div>

      {/* Modal de Envío de Emails Modularizado */}
      <EmailModal
        show={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        nominasCalculadas={nominasCalculadas}
        mesSeleccionado={mesSeleccionado}
        quincenaSeleccionada={quincenaSeleccionada}
        showNotification={showNotification}
      />

      {/* Modal de Días Festivos Modularizado */}
      <FestivosModal
        show={showFestivosModal}
        onClose={() => setShowFestivosModal(false)}
        mesSeleccionado={mesSeleccionado}
        festivos={festivos}
        nuevoFestivo={nuevoFestivo}
        setNuevoFestivo={setNuevoFestivo}
        loadingFestivos={loadingFestivos}
        agregarFestivo={agregarFestivo}
        eliminarFestivo={eliminarFestivo}
      />

      {/* Notificaciones */}
      {notification && (
        <CustomNotification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}
    </div>
  );
}

export default Nomina;
