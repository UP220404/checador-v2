import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function OrganigramaTab({ userData }) {
  const [usuarios, setUsuarios]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [viewMode, setViewMode]               = useState('tree');
  const [searchTerm, setSearchTerm]           = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('');

  useEffect(() => { cargarUsuarios(); }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      if (response.data.success) {
        setUsuarios((response.data.data || []).filter(u => u.activo !== false));
      }
    } catch (err) {
      console.error('Error cargando organigrama:', err);
    } finally {
      setLoading(false);
    }
  };

  const departamentos = [...new Set(usuarios.map(u => u.departamento).filter(Boolean))].sort();

  const getInitials = (nombre) => {
    if (!nombre) return '?';
    const w = nombre.trim().split(/\s+/);
    return w.length === 1
      ? w[0][0].toUpperCase()
      : (w[0][0] + w[w.length - 1][0]).toUpperCase();
  };

  const getRoleColor = (role) => ({
    admin_rh:   '#dc3545',
    admin_area: '#0d6efd',
    empleado:   '#198754',
  }[role] || '#198754');

  const getDeptColor = (dept) => {
    const palette = ['#6f42c1','#fd7e14','#20c997','#0dcaf0','#d63384',
                     '#6610f2','#ffc107','#198754','#0d6efd','#dc3545'];
    return palette[departamentos.indexOf(dept) % palette.length] || '#6c757d';
  };

  const filtrados = usuarios.filter(u => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || u.nombre?.toLowerCase().includes(q) || u.puesto?.toLowerCase().includes(q);
    const matchDept   = !filterDepartamento || u.departamento === filterDepartamento;
    return matchSearch && matchDept;
  });

  // ── Misma jerarquía que el organigrama de RH ──────────────────────────────
  const getJerarquia = () => {
    const ceo = filtrados.filter(u =>
      u.departamento?.toUpperCase() === 'CEO' ||
      u.puesto?.toUpperCase().includes('CEO') ||
      u.puesto?.toUpperCase().includes('DIRECTOR GENERAL')
    );
    const direccion = filtrados.filter(u =>
      !ceo.includes(u) && (
        u.departamento?.toLowerCase().includes('direcci') ||
        u.puesto?.toLowerCase().includes('director') ||
        u.departamento === 'Dirección General' ||
        u.departamento === 'Direccion General'
      )
    );
    const rh = filtrados.filter(u =>
      u.role === 'admin_rh' && !ceo.includes(u) && !direccion.includes(u)
    );
    const adminsArea = filtrados.filter(u =>
      u.role === 'admin_area' && !ceo.includes(u) && !direccion.includes(u)
    );
    const empleados = filtrados.filter(u =>
      (u.role === 'empleado' || !u.role) &&
      !ceo.includes(u) && !direccion.includes(u)
    );
    const porDepto = {};
    empleados.forEach(e => {
      const d = e.departamento || 'Sin Departamento';
      if (!porDepto[d]) porDepto[d] = [];
      porDepto[d].push(e);
    });
    return { ceo, direccion, rh, adminsArea, porDepto };
  };

  // ── Tarjeta — solo nombre, puesto y área ─────────────────────────────────
  const Tarjeta = ({ persona, size = 'normal' }) => {
    const sm = size === 'small';
    const color = getRoleColor(persona.role);
    return (
      <div className={`org-card ${sm ? 'org-card-sm' : ''}`}>
        <div
          className="org-avatar-circle"
          style={{ backgroundColor: color, width: sm ? 36 : 52, height: sm ? 36 : 52, fontSize: sm ? 13 : 18 }}
        >
          {getInitials(persona.nombre)}
        </div>
        <div className="org-card-info">
          <div className="org-card-nombre" style={{ fontSize: sm ? 11 : 13 }}>
            {persona.nombre || 'Sin nombre'}
          </div>
          <div className="org-card-puesto" style={{ fontSize: sm ? 10 : 11 }}>
            {persona.puesto || '—'}
          </div>
          {!sm && persona.departamento && (
            <span
              className="badge mt-1"
              style={{ backgroundColor: getDeptColor(persona.departamento), fontSize: 10 }}
            >
              {persona.departamento}
            </span>
          )}
        </div>
      </div>
    );
  };

  const { ceo, direccion, rh, adminsArea, porDepto } = getJerarquia();

  // ── Grid por departamento ─────────────────────────────────────────────────
  const porDeptoGrid = {};
  filtrados.forEach(u => {
    const d = u.departamento || 'Sin Departamento';
    if (!porDeptoGrid[d]) porDeptoGrid[d] = [];
    porDeptoGrid[d].push(u);
  });
  Object.values(porDeptoGrid).forEach(arr =>
    arr.sort((a, b) => {
      const o = { admin_rh: 0, admin_area: 1, empleado: 2 };
      return (o[a.role] || 2) - (o[b.role] || 2);
    })
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <p className="mt-3 text-muted">Cargando organigrama...</p>
      </div>
    );
  }

  return (
    <div className="organigrama-tab">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <div>
          <h5 className="mb-1">
            <i className="bi bi-diagram-3 text-success me-2"></i>
            Organigrama de la Empresa
          </h5>
          <p className="text-muted small mb-0">{filtrados.length} personas · {departamentos.length} departamentos</p>
        </div>
        <div className="btn-group">
          <button
            className={`btn btn-sm ${viewMode === 'tree' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setViewMode('tree')}
          >
            <i className="bi bi-diagram-3 me-1"></i>Árbol
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setViewMode('grid')}
          >
            <i className="bi bi-grid-3x3-gap me-1"></i>Tarjetas
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="row g-2 mb-4">
        <div className="col-md-7">
          <div className="input-group">
            <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre o puesto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-5">
          <select
            className="form-select"
            value={filterDepartamento}
            onChange={e => setFilterDepartamento(e.target.value)}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── ÁRBOL ── */}
      {viewMode === 'tree' && (
        <div className="org-tree-wrap">
          <div className="org-tree">

            {/* CEO */}
            {ceo.length > 0 && (
              <div className="org-nivel">
                <div className="org-nivel-label">
                  <span className="badge px-3 py-2" style={{ backgroundColor: '#ffc107', color: '#000' }}>
                    <i className="bi bi-star-fill me-1"></i>CEO
                  </span>
                </div>
                <div className="org-fila">
                  {ceo.map(p => <Tarjeta key={p.uid || p.id} persona={p} />)}
                </div>
                <div className="org-linea-v"></div>
              </div>
            )}

            {/* Dirección General */}
            {direccion.length > 0 && (
              <div className="org-nivel">
                <div className="org-nivel-label">
                  <span className="badge px-3 py-2" style={{ backgroundColor: '#6f42c1' }}>
                    <i className="bi bi-briefcase-fill me-1"></i>Dirección General
                  </span>
                </div>
                <div className="org-fila">
                  {direccion.map(p => <Tarjeta key={p.uid || p.id} persona={p} />)}
                </div>
                <div className="org-linea-v"></div>
              </div>
            )}

            {/* Recursos Humanos */}
            {rh.length > 0 && (
              <div className="org-nivel">
                <div className="org-nivel-label">
                  <span className="badge bg-danger px-3 py-2">
                    <i className="bi bi-building me-1"></i>Recursos Humanos
                  </span>
                </div>
                <div className="org-fila">
                  {rh.map(p => <Tarjeta key={p.uid || p.id} persona={p} />)}
                </div>
                {(adminsArea.length > 0 || Object.keys(porDepto).length > 0) && (
                  <div className="org-linea-v"></div>
                )}
              </div>
            )}

            {/* Jefes de Área */}
            {adminsArea.length > 0 && (
              <div className="org-nivel">
                <div className="org-nivel-label">
                  <span className="badge bg-primary px-3 py-2">
                    <i className="bi bi-person-badge me-1"></i>Jefes de Área
                  </span>
                </div>
                <div className="org-fila">
                  {adminsArea.map(p => <Tarjeta key={p.uid || p.id} persona={p} />)}
                </div>
                {Object.keys(porDepto).length > 0 && <div className="org-linea-v"></div>}
              </div>
            )}

            {/* Empleados por departamento */}
            {Object.keys(porDepto).length > 0 && (
              <div className="org-nivel">
                <div className="org-nivel-label">
                  <span className="badge bg-success px-3 py-2">
                    <i className="bi bi-people me-1"></i>Empleados por Departamento
                  </span>
                </div>
                <div className="org-deptos-grid">
                  {Object.entries(porDepto).map(([depto, emps]) => (
                    <div key={depto} className="org-depto-box">
                      <div className="org-depto-header" style={{ backgroundColor: getDeptColor(depto) }}>
                        <i className="bi bi-building me-2"></i>
                        {depto}
                        <span className="badge bg-white text-dark ms-2">{emps.length}</span>
                      </div>
                      <div className="org-depto-miembros">
                        {emps.map(e => <Tarjeta key={e.uid || e.id} persona={e} size="small" />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtrados.length === 0 && (
              <div className="text-center py-5">
                <i className="bi bi-people display-4 text-muted"></i>
                <h6 className="text-muted mt-3">No se encontraron personas</h6>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TARJETAS ── */}
      {viewMode === 'grid' && (
        Object.keys(porDeptoGrid).length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-people display-4 text-muted"></i>
            <h6 className="text-muted mt-3">No se encontraron personas</h6>
          </div>
        ) : (
          <div className="row g-3">
            {Object.entries(porDeptoGrid).map(([depto, personas]) => (
              <div key={depto} className="col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header text-white py-2" style={{ backgroundColor: getDeptColor(depto) }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold small">
                        <i className="bi bi-building me-2"></i>{depto}
                      </span>
                      <span className="badge bg-white text-dark">{personas.length}</span>
                    </div>
                  </div>
                  <ul className="list-group list-group-flush">
                    {personas.map(p => {
                      const isJefe = p.role === 'admin_rh' || p.role === 'admin_area';
                      return (
                        <li key={p.uid || p.id} className={`list-group-item d-flex align-items-center gap-2 py-2 ${isJefe ? 'bg-light' : ''}`}>
                          <div
                            style={{
                              width: 36, height: 36, borderRadius: '50%',
                              backgroundColor: getRoleColor(p.role),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0
                            }}
                          >
                            {getInitials(p.nombre)}
                          </div>
                          <div className="min-width-0">
                            <div className="fw-medium small text-truncate">
                              {p.nombre || 'Sin nombre'}
                              {isJefe && <i className="bi bi-star-fill text-warning ms-1" style={{ fontSize: 9 }}></i>}
                            </div>
                            <div className="text-muted" style={{ fontSize: 11 }}>{p.puesto || '—'}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Leyenda */}
      <div className="mt-4 d-flex justify-content-center gap-3 flex-wrap">
        <small className="text-muted"><span className="badge me-1" style={{ backgroundColor: '#ffc107', color: '#000' }}>★</span>CEO</small>
        <small className="text-muted"><span className="badge bg-danger me-1">●</span>Recursos Humanos</small>
        <small className="text-muted"><span className="badge bg-primary me-1">●</span>Jefe de Área</small>
        <small className="text-muted"><span className="badge bg-success me-1">●</span>Empleado</small>
      </div>

      <style>{`
        .org-tree-wrap { overflow-x: auto; padding-bottom: 1rem; }
        .org-tree { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 1rem; min-width: 320px; }
        .org-nivel { display: flex; flex-direction: column; align-items: center; width: 100%; }
        .org-nivel-label { margin-bottom: 12px; }
        .org-fila { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
        .org-linea-v { width: 2px; height: 28px; background: linear-gradient(to bottom, #dee2e6, #adb5bd); margin: 8px 0; }
        .org-card {
          background: white; border-radius: 10px; padding: 12px;
          text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.1);
          min-width: 130px; max-width: 170px;
        }
        .org-card-sm { padding: 8px; min-width: 110px; max-width: 140px; }
        .org-avatar-circle {
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; margin: 0 auto 8px;
        }
        .org-card-nombre { font-weight: 600; color: #333; line-height: 1.2; }
        .org-card-puesto { color: #6c757d; margin-top: 2px; }
        .org-deptos-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; width: 100%; }
        .org-depto-box { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); min-width: 240px; max-width: 310px; }
        .org-depto-header { padding: 10px 14px; color: white; font-weight: 600; font-size: 13px; display: flex; align-items: center; }
        .org-depto-miembros { padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-height: 280px; overflow-y: auto; }
      `}</style>
    </div>
  );
}

export default OrganigramaTab;
