import { useState } from 'react';

function FotoUploader({ uid, currentFotoUrl, onUploadSuccess, onUploadError }) {
  const [preview] = useState(currentFotoUrl);

  // Storage deshabilitado temporalmente
  const STORAGE_ENABLED = false;

  const handleClick = () => {
    if (!STORAGE_ENABLED) {
      onUploadError('Subida de fotos no disponible por el momento');
      return;
    }
  };

  return (
    <div className="foto-uploader">
      <div className="foto-preview" onClick={handleClick} title={STORAGE_ENABLED ? "Click para cambiar foto" : "Proximamente"}>
        {preview ? (
          <img src={preview} alt="Foto de perfil" />
        ) : (
          <div className="foto-placeholder">
            <i className="bi bi-person-fill"></i>
          </div>
        )}
        {STORAGE_ENABLED && (
          <div className="foto-overlay">
            <i className="bi bi-camera"></i>
          </div>
        )}
      </div>

      <small className="text-muted mt-2 d-block text-center">
        {STORAGE_ENABLED ? 'Click para cambiar foto' : 'Foto de perfil (proximamente)'}
      </small>
    </div>
  );
}

export default FotoUploader;
