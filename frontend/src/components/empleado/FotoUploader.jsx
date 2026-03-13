import { useState, useRef } from 'react';
import { api } from '../../services/api';

function FotoUploader({ uid, currentFotoUrl, onUploadSuccess, onUploadError }) {
  const [preview, setPreview] = useState(currentFotoUrl);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (!uploading && !deleting) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onUploadError('La imagen no puede superar 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      onUploadError('Solo se permiten archivos de imagen');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      setUploading(true);
      const response = await api.updateProfilePhoto(uid, file);

      if (response.data.success) {
        setPreview(response.data.data.fotoUrl);
        onUploadSuccess(response.data.data.fotoUrl);
      }
    } catch (error) {
      console.error('Error subiendo foto:', error);
      setPreview(currentFotoUrl);
      onUploadError('Error al subir la foto de perfil');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!preview || deleting || uploading) return;

    try {
      setDeleting(true);
      const response = await api.deleteProfilePhoto(uid);

      if (response.data.success) {
        setPreview('');
        onUploadSuccess('');
      }
    } catch (error) {
      console.error('Error eliminando foto:', error);
      onUploadError('Error al eliminar la foto');
    } finally {
      setDeleting(false);
    }
  };

  const busy = uploading || deleting;

  return (
    <div className="foto-uploader">
      <div className="foto-preview" onClick={handleClick} title="Click para cambiar foto" style={{ cursor: busy ? 'wait' : 'pointer' }}>
        {preview ? (
          <img src={preview} alt="Foto de perfil" style={{ opacity: busy ? 0.5 : 1 }} />
        ) : (
          <div className="foto-placeholder">
            <i className="bi bi-person-fill"></i>
          </div>
        )}
        <div className="foto-overlay" style={{ opacity: busy ? 1 : undefined }}>
          {busy ? (
            <span className="spinner-border spinner-border-sm text-white" role="status"></span>
          ) : (
            <i className="bi bi-camera"></i>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="foto-actions mt-2 text-center">
        {busy ? (
          <small className="text-muted">{uploading ? 'Subiendo...' : 'Eliminando...'}</small>
        ) : preview ? (
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={handleDelete}
            title="Eliminar foto"
          >
            <i className="bi bi-trash me-1"></i>
            Eliminar foto
          </button>
        ) : (
          <small className="text-muted">Click para subir foto</small>
        )}
      </div>
    </div>
  );
}

export default FotoUploader;
