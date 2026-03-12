import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import FotoUploader from './FotoUploader';
import FechasImportantes from './FechasImportantes';

function PerfilCompleto({ userData, mostrarMensaje, onUpdateUserData }) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    telefono: '',
    direccion: '',
    contactoEmergencia: '',
    contactoEmergenciaTelefono: '',
    fechaNacimiento: ''
  });

  // Función para convertir fecha a formato YYYY-MM-DD para inputs
  const formatDateForInput = (fecha) => {
    if (!fecha) return '';
    // Si ya es string en formato YYYY-MM-DD
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    // Si es Firestore Timestamp
    if (fecha.toDate) {
      const d = fecha.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    // Si es objeto con _seconds (serializado)
    if (fecha._seconds) {
      const d = new Date(fecha._seconds * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  };

  useEffect(() => {
    if (userData) {
      setFormData({
        telefono: userData.telefono || '',
        direccion: userData.direccion || '',
        contactoEmergencia: userData.contactoEmergencia || '',
        contactoEmergenciaTelefono: userData.contactoEmergenciaTelefono || '',
        fechaNacimiento: formatDateForInput(userData.fechaNacimiento)
      });
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      const response = await api.updateProfileExtended(userData.uid, formData);

      if (response.data.success) {
        mostrarMensaje('success', 'Perfil actualizado correctamente');
        onUpdateUserData(formData);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      mostrarMensaje('error', error.response?.data?.message || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleFotoSuccess = (fotoUrl) => {
    onUpdateUserData({ fotoUrl });
    mostrarMensaje('success', 'Foto de perfil actualizada');
  };

  const handleFotoError = (error) => {
    mostrarMensaje('error', error);
  };

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    try {
      // Si es string YYYY-MM-DD, evitar conversión a Date para evitar timezone issues
      if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        const [year, month, day] = fechaStr.split('-');
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${parseInt(day)} de ${meses[parseInt(month) - 1]} de ${year}`;
      }
      // Si es Firestore Timestamp
      if (fechaStr.toDate) {
        const d = fechaStr.toDate();
        return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      // Fallback
      return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  };

  return (
    <div className="perfil-completo">
      <h4 className="section-title">
        <i className="bi bi-person me-2 text-success"></i>
        Mi Perfil
      </h4>

      <div className="perfil-grid">
        {/* Columna izquierda - Foto y datos basicos */}
        <div className="perfil-sidebar">
          <FotoUploader
            uid={userData?.uid}
            currentFotoUrl={userData?.fotoUrl}
            onUploadSuccess={handleFotoSuccess}
            onUploadError={handleFotoError}
          />

          <div className="perfil-basico">
            <h5>{userData?.nombre || '-'}</h5>
            <p className="text-muted">{userData?.correo || userData?.email || '-'}</p>

            <div className="info-badges">
              {userData?.puesto && (
                <span className="badge bg-primary">{userData.puesto}</span>
              )}
              {userData?.departamento && (
                <span className="badge bg-secondary">{userData.departamento}</span>
              )}
              {userData?.tipo && (
                <span className="badge bg-info">{userData.tipo}</span>
              )}
            </div>
          </div>

          <div className="perfil-fechas-info">
            <div className="fecha-item">
              <span className="label">Fecha de ingreso</span>
              <span className="value">{formatFecha(userData?.fechaIngreso)}</span>
            </div>
            {userData?.fechaNacimiento && (
              <div className="fecha-item">
                <span className="label">Fecha de nacimiento</span>
                <span className="value">{formatFecha(userData?.fechaNacimiento)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha - Formulario editable */}
        <div className="perfil-content">
          <div className="perfil-card">
            <div className="card-header">
              <h5>
                <i className="bi bi-pencil-square me-2"></i>
                Informacion de Contacto
              </h5>
              {!editMode && (
                <button className="btn-edit" onClick={() => setEditMode(true)}>
                  <i className="bi bi-pencil"></i>
                  Editar
                </button>
              )}
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-telephone"></i>
                    Telefono
                  </label>
                  {editMode ? (
                    <input
                      type="tel"
                      name="telefono"
                      className="form-control-portal"
                      placeholder="Tu numero de telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span className="form-value">{formData.telefono || '-'}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-cake2"></i>
                    Fecha de nacimiento
                  </label>
                  {editMode ? (
                    <input
                      type="date"
                      name="fechaNacimiento"
                      className="form-control-portal"
                      value={formData.fechaNacimiento}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span className="form-value">{formatFecha(formData.fechaNacimiento)}</span>
                  )}
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    <i className="bi bi-geo-alt"></i>
                    Direccion
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="direccion"
                      className="form-control-portal"
                      placeholder="Tu direccion"
                      value={formData.direccion}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span className="form-value">{formData.direccion || '-'}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-person-lines-fill"></i>
                    Contacto de emergencia
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="contactoEmergencia"
                      className="form-control-portal"
                      placeholder="Nombre del contacto"
                      value={formData.contactoEmergencia}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span className="form-value">{formData.contactoEmergencia || '-'}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-telephone-plus"></i>
                    Telefono de emergencia
                  </label>
                  {editMode ? (
                    <input
                      type="tel"
                      name="contactoEmergenciaTelefono"
                      className="form-control-portal"
                      placeholder="Telefono del contacto"
                      value={formData.contactoEmergenciaTelefono}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span className="form-value">{formData.contactoEmergenciaTelefono || '-'}</span>
                  )}
                </div>
              </div>

              {editMode && (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-portal btn-portal-secondary"
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-portal btn-portal-primary"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
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
            </form>
          </div>

          {/* Fechas importantes */}
          <FechasImportantes
            uid={userData?.uid}
            mostrarMensaje={mostrarMensaje}
          />
        </div>
      </div>
    </div>
  );
}

export default PerfilCompleto;
