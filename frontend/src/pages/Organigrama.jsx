import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { api } from '../services/api';

function Organigrama() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('tree');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('');
  const [exporting, setExporting] = useState(false);
  const orgRef = useRef(null);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      if (response.data.success) {
        const activos = (response.data.data || []).filter(u => u.activo !== false);
        setUsuarios(activos);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError('Error al cargar el organigrama');
    } finally {
      setLoading(false);
    }
  };

  const departamentos = [...new Set(usuarios.map(u => u.departamento).filter(Boolean))].sort();

  const getInitials = (nombre) => {
    if (!nombre) return '?';
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].charAt(0).toUpperCase();
    return (palabras[0].charAt(0) + palabras[palabras.length - 1].charAt(0)).toUpperCase();
  };

  const getRoleColor = (role) => {
    const colors = {
      admin_rh: { bg: '#dc3545', text: 'white', label: 'Recursos Humanos' },
      admin_area: { bg: '#0d6efd', text: 'white', label: 'Admin de Area' },
      empleado: { bg: '#198754', text: 'white', label: 'Empleado' }
    };
    return colors[role] || colors.empleado;
  };

  const getDeptColor = (dept) => {
    const colors = [
      '#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#d63384',
      '#6610f2', '#ffc107', '#198754', '#0d6efd', '#dc3545'
    ];
    const index = departamentos.indexOf(dept);
    return colors[index % colors.length] || '#6c757d';
  };

  const filteredUsuarios = usuarios.filter(u => {
    const matchSearch = !searchTerm ||
      u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.puesto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !filterDepartamento || u.departamento === filterDepartamento;
    return matchSearch && matchDept;
  });

  const getJerarquia = () => {
    // Departamentos especiales de alto nivel
    const deptosAltoNivel = ['CEO', 'Dirección General', 'Direccion General', 'Director General'];

    // CEO y Dirección General - por departamento
    const ceo = filteredUsuarios.filter(u =>
      u.departamento?.toUpperCase() === 'CEO' ||
      u.puesto?.toUpperCase()?.includes('CEO') ||
      u.puesto?.toUpperCase()?.includes('DIRECTOR GENERAL')
    );

    const direccionGeneral = filteredUsuarios.filter(u =>
      !ceo.includes(u) && (
        u.departamento?.toLowerCase()?.includes('direcci') ||
        u.puesto?.toLowerCase()?.includes('director') ||
        u.departamento === 'Dirección General' ||
        u.departamento === 'Direccion General'
      )
    );

    const rh = filteredUsuarios.filter(u =>
      u.role === 'admin_rh' &&
      !ceo.includes(u) &&
      !direccionGeneral.includes(u)
    );

    const adminsArea = filteredUsuarios.filter(u =>
      u.role === 'admin_area' &&
      !ceo.includes(u) &&
      !direccionGeneral.includes(u)
    );

    const empleados = filteredUsuarios.filter(u =>
      (u.role === 'empleado' || !u.role) &&
      !ceo.includes(u) &&
      !direccionGeneral.includes(u) &&
      !deptosAltoNivel.some(d => u.departamento?.toLowerCase() === d.toLowerCase())
    );

    const empleadosPorDepto = {};
    empleados.forEach(emp => {
      const depto = emp.departamento || 'Sin Departamento';
      if (!empleadosPorDepto[depto]) empleadosPorDepto[depto] = [];
      empleadosPorDepto[depto].push(emp);
    });

    return { ceo, direccionGeneral, rh, adminsArea, empleadosPorDepto };
  };

  const exportAsImage = async (format = 'png') => {
    if (!orgRef.current || exporting) return;
    setExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(orgRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `organigrama-cielito-home.${format}`;
      link.href = canvas.toDataURL(`image/${format}`);
      link.click();
    } catch (err) {
      console.error('Error exportando:', err);
      setError('Error al exportar. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!orgRef.current || exporting) return;
    setExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(orgRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('organigrama-cielito-home.pdf');
    } catch (err) {
      console.error('Error exportando PDF:', err);
      setError('Error al exportar PDF.');
    } finally {
      setExporting(false);
    }
  };

  const { ceo, direccionGeneral, rh, adminsArea, empleadosPorDepto } = getJerarquia();

  // Tarjeta de persona con TODOS los detalles (para RH)
  const PersonCard = ({ persona, size = 'normal' }) => {
    const roleColor = getRoleColor(persona.role);
    const isSmall = size === 'small';

    return (
      <div
        className={`person-card ${isSmall ? 'person-card-sm' : ''}`}
        onClick={() => setSelectedPerson(persona)}
      >
        <div
          className="person-avatar"
          style={{
            backgroundColor: roleColor.bg,
            width: isSmall ? '40px' : '60px',
            height: isSmall ? '40px' : '60px',
            fontSize: isSmall ? '14px' : '20px'
          }}
        >
          {persona.fotoUrl ? (
            <img src={persona.fotoUrl} alt={persona.nombre} />
          ) : (
            getInitials(persona.nombre)
          )}
        </div>
        <div className="person-info">
          <div className={`person-name ${isSmall ? 'small' : ''}`}>
            {persona.nombre || 'Sin nombre'}
          </div>
          <div className={`person-puesto ${isSmall ? 'small' : ''}`}>
            {persona.puesto || roleColor.label}
          </div>
          {!isSmall && (
            <>
              {persona.departamento && (
                <span
                  className="badge mt-1"
                  style={{ backgroundColor: getDeptColor(persona.departamento), fontSize: '10px' }}
                >
                  {persona.departamento}
                </span>
              )}
              <div className="person-contact mt-1">
                <small className="text-muted d-block">{persona.email}</small>
                {persona.telefono && (
                  <small className="text-muted">{persona.telefono}</small>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-muted">Cargando organigrama...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="organigrama-page">
        {/* Header */}
        <div className="page-header mb-4">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h2 className="mb-1">
                <i className="bi bi-diagram-3-fill text-primary me-2"></i>
                Organigrama
              </h2>
              <p className="text-muted mb-0">Estructura organizacional de la empresa</p>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="dropdown d-inline-block">
                <button
                  className="btn btn-primary dropdown-toggle"
                  data-bs-toggle="dropdown"
                  disabled={exporting}
                >
                  {exporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Exportando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-download me-2"></i>
                      Exportar
                    </>
                  )}
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button className="dropdown-item" onClick={() => exportAsImage('png')}>
                      <i className="bi bi-file-image me-2"></i>
                      Exportar como PNG
                    </button>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={exportAsPDF}>
                      <i className="bi bi-file-pdf me-2"></i>
                      Exportar como PDF
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-warning alert-dismissible fade show">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {/* Controles */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por nombre, puesto o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={filterDepartamento}
                  onChange={(e) => setFilterDepartamento(e.target.value)}
                >
                  <option value="">Todos los departamentos</option>
                  {departamentos.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <div className="btn-group w-100">
                  <button
                    className={`btn ${viewMode === 'tree' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('tree')}
                  >
                    <i className="bi bi-diagram-3 me-1"></i>
                    Arbol
                  </button>
                  <button
                    className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <i className="bi bi-grid-3x3-gap me-1"></i>
                    Grid
                  </button>
                  <button
                    className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <i className="bi bi-list-ul me-1"></i>
                    Lista
                  </button>
                </div>
              </div>
              <div className="col-md-2 text-end">
                <span className="badge bg-secondary">{filteredUsuarios.length} personas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <div className="display-6 fw-bold text-primary">{usuarios.length}</div>
                <small className="text-muted">Total Empleados</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <div className="display-6 fw-bold text-success">{departamentos.length}</div>
                <small className="text-muted">Departamentos</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <div className="display-6 fw-bold text-danger">{rh.length}</div>
                <small className="text-muted">Admin RH</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <div className="display-6 fw-bold text-info">{adminsArea.length}</div>
                <small className="text-muted">Admin Area</small>
              </div>
            </div>
          </div>
        </div>

        {/* Organigrama */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4" ref={orgRef} style={{ backgroundColor: '#f8f9fa', minHeight: '500px' }}>
            {viewMode === 'tree' && (
              <div className="org-tree">
                {/* Nivel 1: CEO */}
                {ceo.length > 0 && (
                  <div className="org-level">
                    <div className="level-label">
                      <span className="badge px-3 py-2" style={{ backgroundColor: '#ffc107', color: '#000' }}>
                        <i className="bi bi-star-fill me-1"></i>
                        CEO
                      </span>
                    </div>
                    <div className="org-nodes">
                      {ceo.map(persona => (
                        <PersonCard key={persona.uid || persona.id} persona={persona} />
                      ))}
                    </div>
                    {(direccionGeneral.length > 0 || rh.length > 0 || adminsArea.length > 0 || Object.keys(empleadosPorDepto).length > 0) && (
                      <div className="org-connector"></div>
                    )}
                  </div>
                )}

                {/* Nivel 2: Dirección General */}
                {direccionGeneral.length > 0 && (
                  <div className="org-level">
                    <div className="level-label">
                      <span className="badge px-3 py-2" style={{ backgroundColor: '#6f42c1' }}>
                        <i className="bi bi-briefcase-fill me-1"></i>
                        Direccion General
                      </span>
                    </div>
                    <div className="org-nodes">
                      {direccionGeneral.map(persona => (
                        <PersonCard key={persona.uid || persona.id} persona={persona} />
                      ))}
                    </div>
                    {(rh.length > 0 || adminsArea.length > 0 || Object.keys(empleadosPorDepto).length > 0) && (
                      <div className="org-connector"></div>
                    )}
                  </div>
                )}

                {/* Nivel 3: Recursos Humanos */}
                {rh.length > 0 && (
                  <div className="org-level">
                    <div className="level-label">
                      <span className="badge bg-danger px-3 py-2">
                        <i className="bi bi-building me-1"></i>
                        Recursos Humanos
                      </span>
                    </div>
                    <div className="org-nodes">
                      {rh.map(persona => (
                        <PersonCard key={persona.uid || persona.id} persona={persona} />
                      ))}
                    </div>
                    {(adminsArea.length > 0 || Object.keys(empleadosPorDepto).length > 0) && (
                      <div className="org-connector"></div>
                    )}
                  </div>
                )}

                {/* Nivel 4: Administradores de Área */}
                {adminsArea.length > 0 && (
                  <div className="org-level">
                    <div className="level-label">
                      <span className="badge bg-primary px-3 py-2">
                        <i className="bi bi-person-badge me-1"></i>
                        Jefes de Area
                      </span>
                    </div>
                    <div className="org-nodes">
                      {adminsArea.map(persona => (
                        <PersonCard key={persona.uid || persona.id} persona={persona} />
                      ))}
                    </div>
                    {Object.keys(empleadosPorDepto).length > 0 && (
                      <div className="org-connector"></div>
                    )}
                  </div>
                )}

                {Object.keys(empleadosPorDepto).length > 0 && (
                  <div className="org-level">
                    <div className="level-label">
                      <span className="badge bg-success px-3 py-2">
                        <i className="bi bi-people me-1"></i>
                        Empleados por Departamento
                      </span>
                    </div>
                    <div className="departments-grid">
                      {Object.entries(empleadosPorDepto).map(([depto, empleados]) => (
                        <div key={depto} className="department-box">
                          <div
                            className="department-header"
                            style={{ backgroundColor: getDeptColor(depto) }}
                          >
                            <i className="bi bi-building me-2"></i>
                            {depto}
                            <span className="badge bg-white text-dark ms-2">{empleados.length}</span>
                          </div>
                          <div className="department-members">
                            {empleados.map(emp => (
                              <PersonCard key={emp.uid || emp.id} persona={emp} size="small" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="org-grid">
                {filteredUsuarios.map(persona => (
                  <PersonCard key={persona.uid || persona.id} persona={persona} />
                ))}
              </div>
            )}

            {viewMode === 'list' && (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Empleado</th>
                      <th>Puesto</th>
                      <th>Departamento</th>
                      <th>Rol</th>
                      <th>Email</th>
                      <th>Telefono</th>
                      <th>Fecha Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsuarios.map(persona => {
                      const roleColor = getRoleColor(persona.role);
                      return (
                        <tr
                          key={persona.uid || persona.id}
                          onClick={() => setSelectedPerson(persona)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <div
                                className="avatar-sm me-2"
                                style={{
                                  backgroundColor: roleColor.bg,
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  fontSize: '14px'
                                }}
                              >
                                {getInitials(persona.nombre)}
                              </div>
                              <span className="fw-medium">{persona.nombre}</span>
                            </div>
                          </td>
                          <td>{persona.puesto || '-'}</td>
                          <td>
                            {persona.departamento && (
                              <span
                                className="badge"
                                style={{ backgroundColor: getDeptColor(persona.departamento) }}
                              >
                                {persona.departamento}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="badge" style={{ backgroundColor: roleColor.bg }}>
                              {roleColor.label}
                            </span>
                          </td>
                          <td><small>{persona.email}</small></td>
                          <td><small>{persona.telefono || '-'}</small></td>
                          <td><small>{persona.fechaIngreso || '-'}</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredUsuarios.length === 0 && (
              <div className="text-center py-5">
                <i className="bi bi-people display-1 text-muted"></i>
                <h5 className="text-muted mt-3">No se encontraron personas</h5>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Detalles */}
        {selectedPerson && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedPerson(null)}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow">
                <div
                  className="modal-header text-white"
                  style={{ backgroundColor: getRoleColor(selectedPerson.role).bg }}
                >
                  <h5 className="modal-title">
                    <i className="bi bi-person-badge me-2"></i>
                    Perfil Completo del Empleado
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedPerson(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-4 text-center border-end">
                      <div
                        className="mx-auto mb-3"
                        style={{
                          backgroundColor: getRoleColor(selectedPerson.role).bg,
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '40px',
                          overflow: 'hidden'
                        }}
                      >
                        {selectedPerson.fotoUrl ? (
                          <img src={selectedPerson.fotoUrl} alt={selectedPerson.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          getInitials(selectedPerson.nombre)
                        )}
                      </div>
                      <h5 className="mb-1">{selectedPerson.nombre}</h5>
                      <p className="text-muted mb-2">{selectedPerson.puesto || 'Sin puesto'}</p>
                      <div className="d-flex justify-content-center gap-2 flex-wrap">
                        <span className="badge" style={{ backgroundColor: getRoleColor(selectedPerson.role).bg }}>
                          {getRoleColor(selectedPerson.role).label}
                        </span>
                        {selectedPerson.departamento && (
                          <span className="badge" style={{ backgroundColor: getDeptColor(selectedPerson.departamento) }}>
                            {selectedPerson.departamento}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-md-8">
                      <h6 className="text-muted mb-3">
                        <i className="bi bi-info-circle me-2"></i>
                        Informacion de Contacto
                      </h6>
                      <div className="row g-3">
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Email</label>
                          <div className="fw-medium">{selectedPerson.email || '-'}</div>
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Telefono</label>
                          <div className="fw-medium">{selectedPerson.telefono || '-'}</div>
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Fecha de Ingreso</label>
                          <div className="fw-medium">{selectedPerson.fechaIngreso || '-'}</div>
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Fecha de Nacimiento</label>
                          <div className="fw-medium">{selectedPerson.fechaNacimiento || '-'}</div>
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Tipo de Empleado</label>
                          <div className="fw-medium text-capitalize">{selectedPerson.tipo || '-'}</div>
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted mb-0">Estado</label>
                          <div>
                            <span className={`badge ${selectedPerson.activo !== false ? 'bg-success' : 'bg-danger'}`}>
                              {selectedPerson.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                        {selectedPerson.direccion && (
                          <div className="col-12">
                            <label className="form-label small text-muted mb-0">Direccion</label>
                            <div className="fw-medium">{selectedPerson.direccion}</div>
                          </div>
                        )}
                        {selectedPerson.contactoEmergencia && (
                          <>
                            <div className="col-6">
                              <label className="form-label small text-muted mb-0">Contacto Emergencia</label>
                              <div className="fw-medium">{selectedPerson.contactoEmergencia}</div>
                            </div>
                            <div className="col-6">
                              <label className="form-label small text-muted mb-0">Tel. Emergencia</label>
                              <div className="fw-medium">{selectedPerson.contactoEmergenciaTelefono || '-'}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setSelectedPerson(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .org-tree {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 20px;
        }
        .org-level {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        .level-label { margin-bottom: 15px; }
        .org-nodes {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 15px;
        }
        .org-connector {
          width: 2px;
          height: 30px;
          background: linear-gradient(to bottom, #dee2e6, #adb5bd);
          margin: 10px 0;
        }
        .person-card {
          background: white;
          border-radius: 12px;
          padding: 15px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
          min-width: 180px;
          max-width: 220px;
          cursor: pointer;
        }
        .person-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }
        .person-card-sm {
          padding: 10px;
          min-width: 140px;
          max-width: 160px;
        }
        .person-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          margin: 0 auto 10px;
          overflow: hidden;
        }
        .person-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .person-name {
          font-weight: 600;
          font-size: 13px;
          color: #333;
        }
        .person-name.small { font-size: 11px; }
        .person-puesto {
          font-size: 11px;
          color: #6c757d;
        }
        .person-puesto.small { font-size: 10px; }
        .person-contact {
          font-size: 10px;
          line-height: 1.3;
        }
        .departments-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 20px;
          width: 100%;
        }
        .department-box {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          min-width: 280px;
          max-width: 350px;
        }
        .department-header {
          padding: 12px 15px;
          color: white;
          font-weight: 600;
          display: flex;
          align-items: center;
        }
        .department-members {
          padding: 15px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          max-height: 300px;
          overflow-y: auto;
        }
        .org-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 15px;
          padding: 20px;
        }
      `}</style>
    </AdminLayout>
  );
}

export default Organigrama;
