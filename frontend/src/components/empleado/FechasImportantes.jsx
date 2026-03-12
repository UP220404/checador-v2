import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function FechasImportantes({ uid, mostrarMensaje }) {
  const [fechas, setFechas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'cumpleanos',
    fecha: '',
    descripcion: '',
    notificar: true
  });

  useEffect(() => {
    if (uid) {
      cargarFechas();
    }
  }, [uid]);

  const cargarFechas = async () => {
    try {
      setLoading(true);
      const response = await api.getFechasImportantes(uid);
      if (response.data.success) {
        setFechas(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando fechas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fecha) {
      mostrarMensaje('warning', 'Selecciona una fecha');
      return;
    }

    try {
      setSaving(true);

      // Convertir fecha a formato MM-DD
      const dateObj = new Date(formData.fecha + 'T00:00:00');
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dia = String(dateObj.getDate()).padStart(2, '0');
      const fechaFormateada = `${mes}-${dia}`;

      const response = await api.addFechaImportante(uid, {
        ...formData,
        fecha: fechaFormateada
      });

      if (response.data.success) {
        mostrarMensaje('success', 'Fecha agregada correctamente');
        setFormData({
          tipo: 'cumpleanos',
          fecha: '',
          descripcion: '',
          notificar: true
        });
        setShowForm(false);
        cargarFechas();
      }
    } catch (error) {
      console.error('Error agregando fecha:', error);
      mostrarMensaje('error', error.response?.data?.message || 'Error al agregar fecha');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fechaId) => {
    if (!confirm('¿Deseas eliminar esta fecha?')) return;

    try {
      const response = await api.deleteFechaImportante(uid, fechaId);
      if (response.data.success) {
        mostrarMensaje('success', 'Fecha eliminada');
        cargarFechas();
      }
    } catch (error) {
      console.error('Error eliminando fecha:', error);
      mostrarMensaje('error', 'Error al eliminar fecha');
    }
  };

  const getTipoIcon = (tipo) => {
    const iconos = {
      cumpleanos: 'bi-gift',
      aniversario: 'bi-award',
      personal: 'bi-star'
    };
    return iconos[tipo] || 'bi-calendar-event';
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      cumpleanos: 'Cumpleanos',
      aniversario: 'Aniversario',
      personal: 'Personal'
    };
    return labels[tipo] || tipo;
  };

  const formatFecha = (fechaStr) => {
    const [mes, dia] = fechaStr.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dia} de ${meses[parseInt(mes) - 1]}`;
  };

  if (loading) {
    return (
      <div className="perfil-card">
        <div className="card-header">
          <h5>
            <i className="bi bi-calendar-event me-2"></i>
            Fechas Importantes
          </h5>
        </div>
        <div className="card-body text-center py-4">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-card fechas-importantes">
      <div className="card-header">
        <h5>
          <i className="bi bi-calendar-event me-2"></i>
          Fechas Importantes
        </h5>
        {!showForm && (
          <button className="btn-add" onClick={() => setShowForm(true)}>
            <i className="bi bi-plus-circle"></i>
            Agregar
          </button>
        )}
      </div>

      <div className="card-body">
        {/* Formulario para agregar */}
        {showForm && (
          <form className="fecha-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select
                  name="tipo"
                  className="form-control-portal"
                  value={formData.tipo}
                  onChange={handleInputChange}
                >
                  <option value="cumpleanos">Cumpleanos</option>
                  <option value="aniversario">Aniversario de trabajo</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input
                  type="date"
                  name="fecha"
                  className="form-control-portal"
                  value={formData.fecha}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descripcion (opcional)</label>
              <input
                type="text"
                name="descripcion"
                className="form-control-portal"
                placeholder="Ej: Mi cumpleanos"
                value={formData.descripcion}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-check">
              <input
                type="checkbox"
                name="notificar"
                className="form-check-input"
                id="notificarCheck"
                checked={formData.notificar}
                onChange={handleInputChange}
              />
              <label className="form-check-label" htmlFor="notificarCheck">
                Recibir notificacion
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-portal btn-portal-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-portal btn-portal-primary"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de fechas */}
        {fechas.length === 0 && !showForm ? (
          <div className="empty-state-small">
            <i className="bi bi-calendar-x"></i>
            <p>No tienes fechas importantes registradas</p>
            <button className="btn-portal btn-portal-primary" onClick={() => setShowForm(true)}>
              <i className="bi bi-plus-circle me-2"></i>
              Agregar fecha
            </button>
          </div>
        ) : (
          <div className="fechas-lista">
            {fechas.map((fecha) => (
              <div key={fecha.id} className="fecha-item">
                <div className="fecha-icon">
                  <i className={`bi ${getTipoIcon(fecha.tipo)}`}></i>
                </div>
                <div className="fecha-info">
                  <span className="fecha-desc">
                    {fecha.descripcion || getTipoLabel(fecha.tipo)}
                  </span>
                  <span className="fecha-date">{formatFecha(fecha.fecha)}</span>
                </div>
                <div className="fecha-actions">
                  {fecha.notificar && (
                    <span className="badge-notif" title="Notificaciones activas">
                      <i className="bi bi-bell"></i>
                    </span>
                  )}
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(fecha.id)}
                    title="Eliminar"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FechasImportantes;
