import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function ConfiguracionTab({ userData, mostrarMensaje, onUpdateUserData }) {
  const [preferencias, setPreferencias] = useState({
    alertaEntrada: true,
    alertaSalida: true,
    alertaCumpleanos: true,
    alertaAprobacionPermisos: true,
    canalPreferido: 'in_app'
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (userData?.preferenciasNotificaciones) {
      setPreferencias({
        alertaEntrada: userData.preferenciasNotificaciones.alertaEntrada ?? true,
        alertaSalida: userData.preferenciasNotificaciones.alertaSalida ?? true,
        alertaCumpleanos: userData.preferenciasNotificaciones.alertaCumpleanos ?? true,
        alertaAprobacionPermisos: userData.preferenciasNotificaciones.alertaAprobacionPermisos ?? true,
        canalPreferido: userData.preferenciasNotificaciones.canalPreferido || 'in_app'
      });
    }
  }, [userData]);

  const handleToggle = (campo) => {
    setPreferencias(prev => ({
      ...prev,
      [campo]: !prev[campo]
    }));
    setHasChanges(true);
  };

  const handleCanalChange = (e) => {
    setPreferencias(prev => ({
      ...prev,
      canalPreferido: e.target.value
    }));
    setHasChanges(true);
  };

  const handleGuardar = async () => {
    try {
      setSaving(true);
      const response = await api.updatePreferenciasNotificaciones(userData.uid, preferencias);

      if (response.data.success) {
        mostrarMensaje('success', 'Preferencias actualizadas');
        onUpdateUserData({ preferenciasNotificaciones: preferencias });
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      mostrarMensaje('error', 'Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="configuracion-tab">
      <h4 className="section-title">
        <i className="bi bi-gear me-2 text-success"></i>
        Configuracion
      </h4>

      {/* Preferencias de notificaciones */}
      <div className="config-section">
        <h5 className="config-section-title">
          <i className="bi bi-bell me-2"></i>
          Preferencias de Notificaciones
        </h5>

        <div className="config-card">
          <div className="config-item">
            <div className="config-info">
              <span className="config-label">Alertas de entrada</span>
              <span className="config-desc">Recibir notificacion al registrar entrada</span>
            </div>
            <div className="config-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferencias.alertaEntrada}
                  onChange={() => handleToggle('alertaEntrada')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="config-item">
            <div className="config-info">
              <span className="config-label">Alertas de salida</span>
              <span className="config-desc">Recibir notificacion al registrar salida</span>
            </div>
            <div className="config-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferencias.alertaSalida}
                  onChange={() => handleToggle('alertaSalida')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="config-item">
            <div className="config-info">
              <span className="config-label">Recordatorios de cumpleanos</span>
              <span className="config-desc">Recibir notificacion de cumpleanos de companeros</span>
            </div>
            <div className="config-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferencias.alertaCumpleanos}
                  onChange={() => handleToggle('alertaCumpleanos')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="config-item">
            <div className="config-info">
              <span className="config-label">Estado de solicitudes</span>
              <span className="config-desc">Recibir notificacion cuando se aprueben/rechacen solicitudes</span>
            </div>
            <div className="config-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferencias.alertaAprobacionPermisos}
                  onChange={() => handleToggle('alertaAprobacionPermisos')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="config-item">
            <div className="config-info">
              <span className="config-label">Canal de notificaciones</span>
              <span className="config-desc">Como deseas recibir las notificaciones</span>
            </div>
            <div className="config-select">
              <select
                className="form-control-portal"
                value={preferencias.canalPreferido}
                onChange={handleCanalChange}
              >
                <option value="in_app">Solo en la aplicacion</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="config-actions">
            <button
              className="btn-portal btn-portal-primary"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Informacion de la cuenta */}
      <div className="config-section">
        <h5 className="config-section-title">
          <i className="bi bi-person-badge me-2"></i>
          Informacion de la Cuenta
        </h5>

        <div className="config-card info-card">
          <div className="info-item">
            <span className="info-label">Correo electronico</span>
            <span className="info-value">{userData?.correo || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Tipo de cuenta</span>
            <span className="info-value">{userData?.tipo || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Departamento</span>
            <span className="info-value">{userData?.departamento || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Fecha de ingreso</span>
            <span className="info-value">
              {userData?.fechaIngreso
                ? (() => {
                    // Parsear fecha sin problemas de timezone
                    const parts = userData.fechaIngreso.split('-');
                    if (parts.length === 3) {
                      const fecha = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                    }
                    return userData.fechaIngreso;
                  })()
                : '-'
              }
            </span>
          </div>
        </div>

        <div className="config-aviso">
          <i className="bi bi-info-circle me-2"></i>
          Para cambiar informacion de tu cuenta, contacta al departamento de Recursos Humanos.
        </div>
      </div>

      {/* Version */}
      <div className="config-footer">
        <p className="text-muted">
          <i className="bi bi-code-slash me-2"></i>
          Portal Empleado v2.0
        </p>
      </div>
    </div>
  );
}

export default ConfiguracionTab;
