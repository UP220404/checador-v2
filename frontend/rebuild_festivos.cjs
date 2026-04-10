const fs = require('fs');
const filePath = 'c:\\\\Users\\\\lenin\\\\OneDrive\\\\Documentos\\\\Cielito Home\\\\Checador Version 2\\\\frontend\\\\src\\\\pages\\\\Configuracion.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inject states
if (!content.includes('const [festivos,')) {
  content = content.replace(
    'const [loading, setLoading] = useState(true);',
    \`const [loading, setLoading] = useState(true);
  const [festivos, setFestivos] = useState([]);
  const [nuevoFestivo, setNuevoFestivo] = useState({ fecha: '', fechaFin: '', nombre: '', tipo: 'federal' });
  const [loadingFestivos, setLoadingFestivos] = useState(false);
  const [anioFestivos, setAnioFestivos] = useState(new Date().getFullYear());\`
  );
}

// 2. Inject to useEffect
content = content.replace(
  'useEffect(() => {\\r\\n    cargarConfiguracion();\\r\\n  }, []);',
  \`useEffect(() => {
    cargarConfiguracion();
    cargarFestivos();
  }, [anioFestivos]);\`
);
// Fallback if formatting differs
content = content.replace(
  'useEffect(() => {\\n    cargarConfiguracion();\\n  }, []);',
  \`useEffect(() => {
    cargarConfiguracion();
    cargarFestivos();
  }, [anioFestivos]);\`
);
content = content.replace(
  'useEffect(() => {\\n    cargarConfiguracion();\\n  }, [anioFestivos]);',
  \`useEffect(() => {
    cargarConfiguracion();
    cargarFestivos();
  }, [anioFestivos]);\`
);


// 3. Inject Handlers
if (!content.includes('const cargarFestivos')) {
  // Find a good spot before NAV CONFIG
  content = content.replace(
    '  // ============ NAV CONFIG ============',
    \`  // ============ HANDLERS FESTIVOS ============
  const cargarFestivos = async () => {
    try {
      setLoadingFestivos(true);
      const response = await api.getHolidays(anioFestivos);
      if (response.data.success) {
        setFestivos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando festivos:', error);
      showToast('Error al cargar dias festivos', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  const agregarFestivo = async () => {
    if (!nuevoFestivo.fecha || !nuevoFestivo.nombre) {
      showToast('Fecha Inicio y Nombre son requeridos', 'warning');
      return;
    }

    const fechasInsertar = [];
    const fromDate = new Date(nuevoFestivo.fecha + 'T00:00:00');
    
    if (nuevoFestivo.fechaFin && nuevoFestivo.fechaFin > nuevoFestivo.fecha) {
      const toDate = new Date(nuevoFestivo.fechaFin + 'T00:00:00');
      let current = new Date(fromDate);
      while (current <= toDate) {
        fechasInsertar.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    } else {
      fechasInsertar.push(nuevoFestivo.fecha);
    }

    try {
      setLoadingFestivos(true);
      let successCount = 0;
      for (const f of fechasInsertar) {
        const payload = { ...nuevoFestivo, fecha: f };
        delete payload.fechaFin;
        const response = await api.createHoliday(payload);
        if (response.data.success) {
          successCount++;
        }
      }
      if (successCount > 0) {
        showToast(\\\`\\\${successCount} día(s) festivo(s) agregado(s)\\\`, 'success');
        setNuevoFestivo({ fecha: '', fechaFin: '', nombre: '', tipo: 'federal' });
        cargarFestivos();
      }
    } catch (error) {
      console.error('Error agregando festivos:', error);
      showToast('Error al agregar festivos', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  const eliminarFestivo = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este dia festivo?')) return;
    try {
      setLoadingFestivos(true);
      const response = await api.deleteHoliday(id);
      if (response.data.success) {
        showToast('Dia festivo eliminado', 'success');
        cargarFestivos();
      }
    } catch (error) {
      console.error('Error eliminando festivo:', error);
      showToast('Error al eliminar festivo', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };

  // ============ NAV CONFIG ============\`
  );
}

// 4. Inject NAV Button
if (!content.includes('id: \\'festivos\\'')) {
  // It shouldn't be matched like this, let's use the object
  content = content.replace(
    "{ id: 'nomina', icon: 'bi-cash-coin', label: 'Nomina', desc: 'Parametros de pago' },",
    "{ id: 'nomina', icon: 'bi-cash-coin', label: 'Nomina', desc: 'Parametros de pago' },\\n    { id: 'festivos', icon: 'bi-calendar-check', label: 'Festivos', desc: 'Dias no laborales' },"
  );
}

// 5. Inject JSX Block
if (!content.includes('activeSection === \\'festivos\\'')) {
  content = content.replace(
    "{/* ==================== SEGURIDAD ==================== */}",
    \`{/* ==================== FESTIVOS ==================== */}
            {activeSection === 'festivos' && (
              <div className="cfg-section-card">
                <div className="cfg-section-header">
                  <div className="cfg-section-header-left">
                     <div className="cfg-section-icon cfg-icon-horarios" style={{ background: 'linear-gradient(135deg, #0d6efd, #0dcaf0)' }}>
                       <i className="bi bi-calendar-check"></i>
                     </div>
                     <div>
                       <div className="cfg-section-title">Dias Festivos</div>
                       <div className="cfg-section-subtitle">Gestion de dias no laborales y festivos oficiales</div>
                     </div>
                  </div>
                  <div className="d-flex gap-2">
                     <select 
                       className="form-select form-select-sm" 
                       style={{ width: 'auto', borderRadius: '10px', fontWeight: 600 }}
                       value={anioFestivos}
                       onChange={(e) => setAnioFestivos(parseInt(e.target.value))}
                     >
                       {[2024, 2025, 2026, 2027].map(y => (
                         <option key={y} value={y}>{y}</option>
                       ))}
                     </select>
                  </div>
                </div>
                <div className="cfg-section-body">
                  <div className="cfg-form-group">
                     <div className="cfg-group-title">
                       <i className="bi bi-plus-circle"></i>
                       Agregar Nuevo Festivo (Rango Soportado)
                     </div>
                     <div className="row g-3">
                       <div className="col-md-3">
                         <label className="cfg-form-label">Fecha (Inicio)</label>
                         <input type="date" className="form-control" value={nuevoFestivo.fecha} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fecha: e.target.value })} />
                       </div>
                       <div className="col-md-3">
                         <label className="cfg-form-label">Fecha Fin (Opcional)</label>
                         <input type="date" className="form-control" value={nuevoFestivo.fechaFin || ''} min={nuevoFestivo.fecha} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fechaFin: e.target.value })} />
                       </div>
                       <div className="col-md-3">
                         <label className="cfg-form-label">Nombre</label>
                         <input type="text" className="form-control" placeholder="Ej: Semana Santa" value={nuevoFestivo.nombre} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, nombre: e.target.value })} />
                       </div>
                       <div className="col-md-2">
                         <label className="cfg-form-label">Tipo</label>
                         <select className="form-select" value={nuevoFestivo.tipo} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, tipo: e.target.value })}>
                           <option value="federal">Federal</option>
                           <option value="local">Local</option>
                           <option value="empresa">Empresa</option>
                         </select>
                       </div>
                       <div className="col-md-1 d-flex align-items-end">
                         <button className="cfg-save-btn m-0 w-100" onClick={agregarFestivo} disabled={loadingFestivos} style={{ background: 'linear-gradient(135deg, #0d6efd, #0dcaf0)', color: 'white', padding: '0.6rem' }}>
                           {loadingFestivos ? '...' : '+'}
                         </button>
                       </div>
                     </div>
                  </div>

                  <div className="cfg-form-group">
                     <div className="cfg-group-title">
                       <i className="bi bi-list-ul"></i>
                       Festivos Configurados ({anioFestivos})
                     </div>
                     {loadingFestivos ? (
                       <div className="text-center py-4">
                         <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                       </div>
                     ) : festivos.length === 0 ? (
                       <div className="cfg-empty-state" style={{ padding: '30px 20px' }}>
                         <i className="bi bi-calendar-x" style={{ fontSize: '2rem' }}></i>
                         <p className="mb-0">No hay festivos registrados para {anioFestivos}</p>
                       </div>
                     ) : (
                       <div className="cfg-absence-table">
                         {festivos
                           .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                           .map((festivo) => (
                           <div key={festivo.id || festivo.fecha} className="cfg-absence-row">
                             <div className="cfg-absence-color" style={{ backgroundColor: festivo.tipo === 'federal' ? '#0d6efd' : festivo.tipo === 'local' ? '#6f42c1' : '#198754' }}></div>
                             <div className="cfg-absence-info">
                               <div className="cfg-absence-name" style={{ fontWeight: 600 }}>{festivo.nombre}</div>
                               <div className="cfg-absence-id">
                                 {new Date(festivo.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                               </div>
                             </div>
                             <div className="cfg-absence-badges">
                               <span className={\`cfg-badge \${festivo.tipo === 'federal' ? 'cfg-badge-blue' : festivo.tipo === 'local' ? 'cfg-badge-amber' : 'cfg-badge-green'}\`}>
                                 {festivo.tipo}
                               </span>
                             </div>
                             <div className="d-flex gap-1">
                               <button className="btn btn-sm btn-link text-danger p-1" onClick={() => eliminarFestivo(festivo.id || festivo.fecha)} title="Eliminar">
                                 <i className="bi bi-trash" style={{ fontSize: '1.1rem' }}></i>
                               </button>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SEGURIDAD ==================== */}\`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Festivos reintectados exitosamente.');
