const fs = require('fs');
const path1 = 'c:\\\\Users\\\\lenin\\\\OneDrive\\\\Documentos\\\\Cielito Home\\\\Checador Version 2\\\\frontend\\\\src\\\\pages\\\\Configuracion.jsx';
let c1 = fs.readFileSync(path1, 'utf8');

c1 = c1.replace(/fecha: '',\\s*nombre: '',/g, 'fecha: \\'\\',\n    fechaFin: \\'\\',\n    nombre: \\'\\',');

c1 = c1.replace(/const agregarFestivo = async \\(\\) => \\{[\\s\\S]*?finally \\{\\s*setLoadingFestivos\\(false\\);\\s*\\}\\s*\\};/, 
`  const agregarFestivo = async () => {
    if (!nuevoFestivo.fecha || !nuevoFestivo.nombre) {
      showToast('Fecha Inicio y Nombre son requeridos', 'warning');
      return;
    }

    const fechasInsertar = [];
    const fromDate = new Date(nuevoFestivo.fecha + 'T00:00:00');
    
    // Si especificó rango, generar todas las fechas
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
        showToast(\`\${successCount} día(s) festivo(s) agregado(s)\`, 'success');
        setNuevoFestivo({ fecha: '', fechaFin: '', nombre: '', tipo: 'federal' });
        cargarFestivos();
      }
    } catch (error) {
      console.error('Error agregando festivo:', error);
      showToast(error.response?.data?.message || 'Error al agregar festivo(s)', 'error');
    } finally {
      setLoadingFestivos(false);
    }
  };`);

c1 = c1.replace(
  /<div className=\"col-md-3\">\s*<label className=\"cfg-form-label\">Fecha<\/label>\s*<input\s*type=\"date\"\s*className=\"form-control\"\s*value=\{nuevoFestivo\.fecha\}\s*onChange=\{\(e\) => setNuevoFestivo\(\{ \.\.\.nuevoFestivo, fecha: e\.target\.value \}\)\}\s*\/>\s*<\/div>/,
  `<div className="col-md-3">
    <label className="cfg-form-label">Fecha (Inicio)</label>
    <input type="date" className="form-control" value={nuevoFestivo.fecha} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fecha: e.target.value })} />
  </div>
  <div className="col-md-3">
    <label className="cfg-form-label">Fecha Fin (Opc.)</label>
    <input type="date" className="form-control" value={nuevoFestivo.fechaFin || ''} min={nuevoFestivo.fecha} onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fechaFin: e.target.value })} />
  </div>`
);

c1 = c1.replace(
  /<div className=\"col-md-5\">\s*<label className=\"cfg-form-label\">Nombre del Festivo<\/label>/,
  `<div className="col-md-3">
    <label className="cfg-form-label">Nombre</label>`
);

c1 = c1.replace(
  /<div className=\"col-md-2 d-flex align-items-end\">\s*<button\s*className=\"cfg-save-btn m-0 w-100\"/,
  `<div className="col-md-1 d-flex align-items-end">
    <button className="cfg-save-btn m-0 w-100"`
);

fs.writeFileSync(path1, c1, 'utf8');
console.log('listo');
