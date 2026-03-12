export default function FestivosModal({
  show,
  onClose,
  mesSeleccionado,
  festivos,
  nuevoFestivo,
  setNuevoFestivo,
  loadingFestivos,
  agregarFestivo,
  eliminarFestivo
}) {
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{
      backgroundColor: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)'
    }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '600px' }}>
        <div className="modal-content" style={{
          borderRadius: '20px',
          border: 'none',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          {/* Header Minimalista */}
          <div className="modal-header" style={{
            backgroundColor: '#fff',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            padding: '1.5rem 2rem'
          }}>
            <div>
              <h5 className="modal-title" style={{
                fontSize: '1.75rem',
                fontWeight: '600',
                color: '#1d1d1f',
                marginBottom: '0.25rem',
                letterSpacing: '-0.5px'
              }}>
                Días Festivos
              </h5>
              {mesSeleccionado && (
                <p style={{
                  fontSize: '0.95rem',
                  color: '#86868b',
                  margin: 0,
                  fontWeight: '400'
                }}>
                  Año {mesSeleccionado.split('-')[0]}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              style={{
                opacity: 0.4,
                fontSize: '0.9rem'
              }}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body" style={{
            padding: '2rem',
            backgroundColor: '#fbfbfd'
          }}>
            {/* Formulario Minimalista */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '1.75rem',
              marginBottom: '1.5rem',
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <h6 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1d1d1f',
                marginBottom: '1.25rem',
                letterSpacing: '-0.3px'
              }}>
                Agregar Nuevo Festivo
              </h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label" style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#1d1d1f',
                    marginBottom: '0.5rem'
                  }}>Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nuevoFestivo.fecha}
                    onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fecha: e.target.value })}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      padding: '0.65rem 1rem',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label" style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#1d1d1f',
                    marginBottom: '0.5rem'
                  }}>Nombre</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Navidad"
                    value={nuevoFestivo.nombre}
                    onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, nombre: e.target.value })}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      padding: '0.65rem 1rem',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#1d1d1f',
                    marginBottom: '0.5rem'
                  }}>Tipo</label>
                  <select
                    className="form-control"
                    value={nuevoFestivo.tipo}
                    onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, tipo: e.target.value })}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      padding: '0.65rem 1rem',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff'
                    }}
                  >
                    <option value="federal">Federal</option>
                    <option value="local">Local</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <button
                  className="btn w-100"
                  onClick={agregarFestivo}
                  disabled={loadingFestivos}
                  style={{
                    backgroundColor: '#059669',
                    border: 'none',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                    letterSpacing: '-0.2px'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#047857'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#059669'}
                >
                  {loadingFestivos ? 'Agregando...' : 'Agregar Festivo'}
                </button>
              </div>
            </div>

            {/* Lista Minimalista */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '1.75rem',
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <h6 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1d1d1f',
                marginBottom: '1.25rem',
                letterSpacing: '-0.3px'
              }}>
                Festivos Configurados
              </h6>
              {loadingFestivos ? (
                <div className="text-center py-5">
                  <div className="spinner-border" style={{
                    color: '#059669',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderWidth: '3px'
                  }} role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="mt-3" style={{ color: '#86868b', fontSize: '0.95rem' }}>Cargando festivos...</p>
                </div>
              ) : festivos.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-calendar-x" style={{ fontSize: '3.5rem', color: '#d2d2d7' }}></i>
                  <p className="mt-3" style={{ color: '#86868b', fontWeight: '500', fontSize: '0.95rem' }}>
                    No hay días festivos configurados
                  </p>
                  <small style={{ color: '#86868b', fontSize: '0.875rem' }}>
                    Agrega uno usando el formulario
                  </small>
                </div>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {festivos
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                    .map((festivo) => (
                      <div
                        key={festivo.id || festivo.fecha}
                        style={{
                          backgroundColor: '#fbfbfd',
                          borderRadius: '12px',
                          padding: '1rem 1.25rem',
                          marginBottom: '0.5rem',
                          border: '1px solid rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f5f5f7';
                          e.currentTarget.style.borderColor = 'rgba(5,150,105,0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fbfbfd';
                          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)';
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="flex-grow-1">
                            <div style={{
                              fontWeight: '600',
                              fontSize: '1rem',
                              marginBottom: '0.25rem',
                              color: '#1d1d1f',
                              letterSpacing: '-0.2px'
                            }}>
                              {festivo.nombre}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#86868b' }}>
                              {new Date(festivo.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: 'rgba(5,150,105,0.1)',
                                color: '#059669',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {festivo.tipo}
                            </span>
                            <button
                              className="btn btn-sm"
                              onClick={() => eliminarFestivo(festivo.id || festivo.fecha)}
                              disabled={loadingFestivos}
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#86868b',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                transition: 'all 0.2s ease',
                                width: '36px',
                                height: '36px'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(220,53,69,0.1)';
                                e.target.style.color = '#dc3545';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#86868b';
                              }}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Minimalista */}
          <div className="modal-footer" style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: '1.25rem 2rem',
            backgroundColor: '#fff'
          }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{
                backgroundColor: '#f5f5f7',
                border: 'none',
                color: '#1d1d1f',
                padding: '0.65rem 2rem',
                fontSize: '0.95rem',
                fontWeight: '500',
                borderRadius: '10px',
                transition: 'all 0.2s ease',
                letterSpacing: '-0.2px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e8e8ed'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f7'}
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
