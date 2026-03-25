import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';
import '../styles/MarketingCarousel.css';

function MarketingCarousel() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'indefinido',
    fechaExpiracion: '',
    foto: null
  });
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const resp = await api.getCarouselImages();
      if (resp.data?.success) {
        setImages(resp.data.data);
      }
    } catch (error) {
      console.error('Error loading carousel images:', error);
      Swal.fire('Error', 'No se pudieron cargar las imágenes del carrusel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.files?.[0] || e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, foto: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.foto && !editingId) {
      return Swal.fire('Error', 'Debes seleccionar una imagen', 'error');
    }

    setUploading(true);
    try {
      const toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

      let resp;
      if (editingId) {
        resp = await api.updateCarouselImage(editingId, formData);
      } else {
        resp = await api.uploadCarouselImage(formData);
      }

      if (resp.data?.success) {
        toast.fire({
          icon: 'success',
          title: editingId ? '¡Publicación actualizada!' : '¡Publicación enviada al carrusel!'
        });
        setShowModal(false);
        resetForm();
        loadImages();
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const msg = error.response?.data?.message || 'Error al procesar la solicitud';
      Swal.fire('Error', msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (img) => {
    setEditingId(img.id);
    setFormData({
      titulo: img.titulo || '',
      tipo: img.tipo || 'indefinido',
      fechaExpiracion: img.fechaExpiracion ? img.fechaExpiracion.split('T')[0] : '',
      foto: null // La foto es opcional al editar
    });
    setPreviewUrl(img.url);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Retirar imagen?',
      text: 'Se eliminará permanentemente del carrusel de la televisión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#fff',
      customClass: {
        popup: 'rounded-4 border-0'
      }
    });

    if (result.isConfirmed) {
      try {
        const resp = await api.deleteCarouselImage(id);
        if (resp.data?.success) {
          Swal.fire('Eliminado', 'La imagen ha sido retirada.', 'success');
          loadImages();
        }
      } catch (error) {
        console.error('Error deleting image:', error);
        Swal.fire('Error', 'No se pudo eliminar la imagen', 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      tipo: 'indefinido',
      fechaExpiracion: '',
      foto: null
    });
    setPreviewUrl(null);
    setEditingId(null);
  };

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    exp.setHours(23, 59, 59, 999);
    return new Date() > exp;
  };

  const nowTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <AdminLayout>
      <div className="marketing-carousel-container">
        
        <header className="marketing-header">
          <div className="marketing-header-content">
            <h1 className="fw-bold mb-3">Carrusel de Marketing</h1>
            <p className="lead opacity-75 mb-4">
              Control total sobre la experiencia visual de los colaboradores. 
              Tus publicaciones se verán en la TV principal automáticamente.
            </p>
            <div className="d-flex gap-3">
              <button 
                className="btn btn-primary btn-lg px-5 py-3 shadow-lg rounded-pill fw-bold"
                onClick={() => setShowModal(true)}
              >
                <i className="bi bi-cloud-arrow-up me-2"></i>
                Nueva Publicación
              </button>
            </div>
          </div>
        </header>

        {/* Stats Summary */}
        <div className="marketing-stats-row">
          <div className="stat-premium-card">
            <div className="stat-icon-wrapper" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <i className="bi bi-images"></i>
            </div>
            <div>
              <h4 className="mb-0 fw-bold">{images.length}</h4>
              <small className="text-muted">Imágenes Totales</small>
            </div>
          </div>
          <div className="stat-premium-card">
            <div className="stat-icon-wrapper" style={{ background: '#f0fdf4', color: '#22c55e' }}>
              <i className="bi bi-check-circle"></i>
            </div>
            <div>
              <h4 className="mb-0 fw-bold">{images.filter(i => !isExpired(i.fechaExpiracion)).length}</h4>
              <small className="text-muted">Activas Hoy</small>
            </div>
          </div>
          <div className="stat-premium-card">
            <div className="stat-icon-wrapper" style={{ background: '#fff7ed', color: '#f97316' }}>
              <i className="bi bi-clock-history"></i>
            </div>
            <div>
              <h4 className="mb-0 fw-bold">{images.filter(i => i.tipo === 'fecha_especifica').length}</h4>
              <small className="text-muted">Temporales</small>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="text-muted">Sincronizando con el servidor...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="file-drop-zone text-center" onClick={() => setShowModal(true)}>
             <i className="bi bi-cloud-plus display-1 text-primary mb-3"></i>
             <h3 className="fw-bold">El catálogo está vacío</h3>
             <p className="text-muted">Sé el primero en publicar una imagen para el carrusel de hoy.</p>
          </div>
        ) : (
          <div className="marketing-grid">
            {images.map((img, idx) => {
              const expired = isExpired(img.fechaExpiracion);
              return (
                <div key={img.id} className="marketing-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="marketing-card-img-wrapper">
                    <img src={img.url} alt={img.titulo} className="marketing-card-img" />
                    <div className="marketing-card-overlay">
                      <div className="d-flex gap-2">
                        <button className="btn btn-primary rounded-pill px-4" onClick={() => handleEdit(img)}>
                          <i className="bi bi-pencil-square me-2"></i> Editar
                        </button>
                        <button className="btn btn-danger rounded-pill px-4" onClick={() => handleDelete(img.id)}>
                          <i className="bi bi-trash-fill me-2"></i> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="marketing-card-content">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                       <h3 className="h5 fw-bold mb-0 text-truncate" style={{ maxWidth: '70%' }}>{img.titulo || 'Sin título'}</h3>
                       <span className={`status-pill ${expired ? 'status-pill-expired' : 'status-pill-active'}`}>
                         <i className={`bi bi-${expired ? 'x-circle' : 'check-circle'}`}></i>
                         {expired ? 'Expirada' : 'Activa'}
                       </span>
                    </div>
                    <div className="small text-muted mb-0">
                      <i className="bi bi-person me-1"></i> {img.subidoPorNombre}
                    </div>
                    <div className="small text-muted">
                      <i className="bi bi-calendar3 me-1"></i> {img.tipo === 'indefinido' ? 'Visibilidad Indefinida' : `Expira el ${img.fechaExpiracion}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Premium con TV Mockup Preview */}
        {showModal && (
          <div className="modal show d-block glass-modal" onDragEnter={handleDrag}>
            <div className="modal-dialog modal-dialog-centered modal-xl">
              <div className="modal-content glass-modal-content border-0">
                <div className="modal-header border-0 px-4 pt-4">
                  <h5 className="modal-title fw-bold fs-3">{editingId ? 'Editar publicación' : 'Configurar nueva publicación'}</h5>
                  <button type="button" className="btn-close" onClick={() => { setShowModal(false); resetForm(); }}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body p-4">
                    <div className="row">
                      <div className="col-lg-5">
                        <div className="mb-4">
                          <label className="form-label fw-bold small text-uppercase tracking-wider">Información</label>
                          <input 
                            type="text" 
                            className="form-control premium-input"
                            placeholder="Título representativo"
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            required
                          />
                        </div>

                        <div className="mb-4">
                          <label className="form-label fw-bold small text-uppercase tracking-wider">Duración</label>
                          <div className="form-toggle-group">
                            <button 
                              type="button" 
                              className={`form-toggle-btn ${formData.tipo === 'indefinido' ? 'active' : ''}`}
                              onClick={() => setFormData({ ...formData, tipo: 'indefinido' })}
                            >
                              Permanente
                            </button>
                            <button 
                              type="button" 
                              className={`form-toggle-btn ${formData.tipo === 'fecha_especifica' ? 'active' : ''}`}
                              onClick={() => setFormData({ ...formData, tipo: 'fecha_especifica' })}
                            >
                              Temporal
                            </button>
                          </div>
                        </div>

                        {formData.tipo === 'fecha_especifica' && (
                          <div className="mb-4 animate__animated animate__fadeIn">
                            <label className="form-label fw-bold small text-uppercase tracking-wider">Fecha de retiro</label>
                            <input 
                              type="date" 
                              className="form-control premium-input"
                              value={formData.fechaExpiracion}
                              onChange={(e) => setFormData({ ...formData, fechaExpiracion: e.target.value })}
                              min={new Date().toISOString().split('T')[0]}
                              required
                            />
                          </div>
                        )}

                        <div 
                          className={`file-drop-zone ${dragActive ? 'active' : ''} mb-4`}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('file-upload').click()}
                        >
                          <i className="bi bi-file-earmark-image fs-1 text-primary"></i>
                          <p className="mt-2 mb-0 fw-bold">Suelta tu imagen aquí</p>
                          <p className="small text-muted">o haz clic para explorar</p>
                          <input 
                            id="file-upload"
                            type="file" 
                            className="d-none" 
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>

                      <div className="col-lg-7 border-start ps-lg-5">
                         <h6 className="fw-bold small text-uppercase tracking-wider mb-3">Vista Previa Real (TV Office)</h6>
                         <div className="tv-mockup-wrapper">
                            <div className="tv-mockup-screen">
                               <div className="tv-mockup-left">
                                  {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="tv-mockup-img" />
                                  ) : (
                                    <div className="text-white-50 text-center small">
                                       <i className="bi bi-image fs-2 d-block mb-1"></i>
                                       Imagen
                                    </div>
                                  )}
                                  <div className="tv-overlay-info">
                                     <div className="badge bg-dark bg-opacity-50 border-0 rounded-pill small" style={{ fontSize: '0.6rem' }}>{nowTime}</div>
                                  </div>
                               </div>
                               <div className="tv-mockup-right">
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                     <div style={{ width: '40px', height: '8px', background: '#ccc', borderRadius: '4px' }}></div>
                                     <div style={{ width: '20px', height: '8px', background: '#eee', borderRadius: '4px' }}></div>
                                  </div>
                                  <div className="dummy-agenda-item"></div>
                                  <div className="dummy-agenda-item"></div>
                                  <div className="dummy-agenda-item"></div>
                               </div>
                            </div>
                         </div>

                         <div className="alert alert-warning border-0 rounded-4 p-3 d-flex align-items-center gap-3">
                            <i className="bi bi-exclamation-triangle-fill fs-4 text-warning"></i>
                            <div className="small">
                              <strong>¡Atención al tamaño!</strong> Debido a que la agenda ocupa la parte derecha de la TV, tu imagen se recortará para ajustarse al panel izquierdo. 
                              Usa imágenes con el <strong>sujeto centrado</strong> para mejores resultados.
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 p-4 pt-0">
                    <button type="button" className="btn btn-light px-4 py-2" onClick={() => { setShowModal(false); resetForm(); }}>Cerrar</button>
                    <button 
                      type="submit" 
                      className="btn btn-primary px-5 py-2 fw-bold shadow-lg rounded-pill"
                      disabled={uploading || (!formData.foto && !editingId)}
                    >
                      {uploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          {editingId ? 'Guardando...' : 'Subiendo...'}
                        </>
                      ) : (editingId ? 'Guardar Cambios' : 'Publicar Ahora')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default MarketingCarousel;
