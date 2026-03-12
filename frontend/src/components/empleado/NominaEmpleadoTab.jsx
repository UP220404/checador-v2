import { useState, useEffect } from 'react';
import { api } from '../../services/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getTipoNombre(tipo) {
  switch (tipo) {
    case 'tiempo_completo': return 'T.Completo';
    case 'becario': return 'Becario';
    case 'horario_especial': return 'H.Especial';
    default: return tipo || 'Empleado';
  }
}

function formatearNumero(numero) {
  if (numero === null || numero === undefined) return '0';
  return Number(numero).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getPeriodoLabel(periodo) {
  if (periodo === 'primera') return '1ra Quincena';
  if (periodo === 'segunda') return '2da Quincena';
  if (periodo?.startsWith('semana_')) return `Semana ${periodo.split('_')[1]}`;
  return periodo;
}

function NominaEmpleadoTab({ userData, mostrarMensaje }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [nominaDetalle, setNominaDetalle] = useState(null);
  const [vista, setVista] = useState('lista');
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Proyeccion en tiempo real
  const [proyeccion, setProyeccion] = useState(null);
  const [loadingProyeccion, setLoadingProyeccion] = useState(true);

  useEffect(() => {
    cargarProyeccion();
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [anioSeleccionado, mesSeleccionado]);

  const cargarProyeccion = async () => {
    try {
      setLoadingProyeccion(true);
      const response = await api.getMyPayrollProjection();
      if (response.data.success && response.data.data) {
        setProyeccion(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando proyeccion:', error);
    } finally {
      setLoadingProyeccion(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const params = { anio: anioSeleccionado };
      if (mesSeleccionado) params.mes = mesSeleccionado;

      const response = await api.getMyPayrollHistory(params);
      if (response.data.success) {
        setHistorial(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial de nomina:', error);
      if (error.response?.status !== 401) {
        mostrarMensaje('error', 'Error al cargar historial de nomina');
      }
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = (nomina) => {
    setNominaDetalle(nomina);
    setVista('detalle');
  };

  const verDetalleProyeccion = () => {
    if (!proyeccion) return;
    setNominaDetalle({
      datos: proyeccion,
      periodo: proyeccion.periodo,
      esProyeccion: true
    });
    setVista('detalle');
  };

  const volverALista = () => {
    setNominaDetalle(null);
    setVista('lista');
  };

  // Calcular proyecciones anuales
  const calcularProyeccionesAnuales = () => {
    if (historial.length === 0) return null;

    const nominasPorMes = {};
    let totalPagado = 0;
    let totalDescuentos = 0;
    let totalRetardos = 0;
    let totalFaltas = 0;
    let totalDiasTrabajados = 0;

    historial.forEach(n => {
      const mes = n.periodo.mes;
      if (!nominasPorMes[mes]) {
        nominasPorMes[mes] = { pagos: 0, descuentos: 0, retardos: 0, faltas: 0, periodos: 0 };
      }
      nominasPorMes[mes].pagos += n.datos.pagoFinal || 0;
      nominasPorMes[mes].descuentos += n.datos.totalDescuentos || 0;
      nominasPorMes[mes].retardos += n.datos.retardos || 0;
      nominasPorMes[mes].faltas += n.datos.diasFaltantes || 0;
      nominasPorMes[mes].periodos += 1;

      totalPagado += n.datos.pagoFinal || 0;
      totalDescuentos += n.datos.totalDescuentos || 0;
      totalRetardos += n.datos.retardos || 0;
      totalFaltas += n.datos.diasFaltantes || 0;
      totalDiasTrabajados += n.datos.diasTrabajados || 0;
    });

    const mesesConDatos = Object.keys(nominasPorMes).length;
    const promedioMensual = mesesConDatos > 0 ? totalPagado / mesesConDatos : 0;
    const mesesRestantes = 12 - mesesConDatos;
    const proyeccionAnual = totalPagado + (promedioMensual * mesesRestantes);

    return {
      nominasPorMes, totalPagado, totalDescuentos, totalRetardos,
      totalFaltas, totalDiasTrabajados, mesesConDatos, promedioMensual,
      proyeccionAnual, totalNominas: historial.length
    };
  };

  // ===== GENERAR PDF =====
  const generarTicketPDF = async (nomina) => {
    if (!nomina) return;
    setGenerandoPDF(true);

    try {
      const ticketHTML = crearTicketHTML(nomina);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = ticketHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '794px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '0';
      tempDiv.style.margin = '0';
      document.body.appendChild(tempDiv);

      await new Promise(resolve => setTimeout(resolve, 200));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(tempDiv.firstElementChild, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: 794, windowWidth: 794, logging: false
      });

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const margin = 3;
      const availableWidth = 210 - (margin * 2);
      const availableHeight = 297 - (margin * 2);
      const imgHeight = (canvas.height * availableWidth) / canvas.width;

      let finalWidth, finalHeight;
      if (imgHeight <= availableHeight) {
        finalWidth = availableWidth;
        finalHeight = imgHeight;
      } else {
        finalHeight = availableHeight;
        finalWidth = (canvas.width * availableHeight) / canvas.height;
      }

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
      document.body.removeChild(tempDiv);

      const periodo = nomina.periodo;
      const nombre = nomina.datos?.empleado?.nombre || userData?.nombre || 'Empleado';
      const nombreArchivo = `Recibo_Nomina_${nombre.replace(/\s+/g, '_')}_${MESES[periodo.mes - 1]}_${periodo.anio}.pdf`;
      pdf.save(nombreArchivo);

      mostrarMensaje('success', 'Recibo PDF generado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      mostrarMensaje('error', 'Error al generar el recibo PDF');
    } finally {
      setGenerandoPDF(false);
    }
  };

  const crearTicketHTML = (nomina) => {
    const resultado = nomina.datos;
    const periodo = nomina.periodo;
    const fecha = new Date();
    const pagoFinal = resultado.pagoFinalConJustificaciones || resultado.pagoFinalAjustado || resultado.pagoFinal;
    const emailEmpleado = resultado.empleado?.email && resultado.empleado.email !== 'sin-email@cielitohome.com'
      ? resultado.empleado.email : '';

    const uid = resultado.empleado?.uid || userData?.uid || 'XXXX';
    const folio = `NOM-${periodo.anio}${String(periodo.mes).padStart(2, '0')}-${uid.slice(-4).toUpperCase()}`;
    const periodoLabel = getPeriodoLabel(periodo.periodo);
    const mesLabel = `${MESES[periodo.mes - 1]} ${periodo.anio}`;
    const esProyeccion = nomina.esProyeccion || resultado.esProyeccion;

    return `
      <div style="width:794px;background:white;padding:0;font-family:'Arial',sans-serif;color:#333;margin:0;">
        <div style="background:linear-gradient(135deg,#0f5132 0%,#198754 100%);padding:15px 25px;color:white;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;">
            <div style="width:50px;height:50px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:12px;box-shadow:0 3px 10px rgba(0,0,0,0.2);">
              <div style="width:38px;height:38px;background:#0f5132;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:15px;">CH</div>
            </div>
            <div>
              <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:1px;">CIELITO HOME</h1>
              <p style="margin:0;font-size:10px;opacity:0.9;font-weight:300;letter-spacing:0.5px;">EXPERIENCIAS A LA CARTA</p>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;opacity:0.9;margin-bottom:3px;font-weight:600;">FECHA</div>
            <div style="font-size:11px;font-weight:600;margin-bottom:8px;">${fecha.toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'numeric'})}</div>
            <div style="font-size:9px;opacity:0.9;margin-bottom:3px;font-weight:600;">FOLIO</div>
            <div style="font-size:11px;font-weight:700;padding:4px 10px;background:rgba(255,255,255,0.2);border-radius:4px;">${folio}</div>
          </div>
        </div>
        <div style="background:#f8f9fa;border-bottom:2px solid #0f5132;padding:8px 25px;text-align:center;">
          <h2 style="margin:0;font-size:15px;font-weight:700;color:#0f5132;letter-spacing:0.8px;">
            ${esProyeccion ? 'PROYECCION DE PAGO (ESTIMADO)' : 'RECIBO DE PAGO'}
          </h2>
        </div>
        <div style="padding:15px 25px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;">
          <div style="flex:1;margin-right:25px;">
            <h3 style="margin:0 0 8px 0;font-size:13px;color:#0f5132;border-bottom:2px solid #0f5132;padding-bottom:3px;display:inline-block;">DATOS DEL EMPLEADO</h3>
            <div style="margin-bottom:7px;">
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">NOMBRE:</span>
              <div style="font-size:12px;font-weight:600;color:#333;">${resultado.empleado?.nombre || userData?.nombre}</div>
            </div>
            ${emailEmpleado ? `<div style="margin-bottom:7px;"><span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">EMAIL:</span><div style="font-size:10px;color:#666;">${emailEmpleado}</div></div>` : ''}
            <div style="margin-bottom:7px;">
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">TIPO:</span>
              <div style="font-size:10px;color:#666;">${getTipoNombre(resultado.empleado?.tipo)}</div>
            </div>
            <div style="margin-bottom:7px;">
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">PERIODO:</span>
              <div style="font-size:10px;color:#666;">${periodoLabel} - ${mesLabel}</div>
            </div>
            ${resultado.empleado?.cuentaBancaria ? `<div><span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">BANCO:</span><div style="font-size:10px;color:#666;">${resultado.empleado.nombreBanco||''} - ${resultado.empleado.cuentaBancaria}</div></div>` : ''}
          </div>
          <div style="border-left:2px solid #0f5132;padding-left:15px;min-width:150px;">
            <div style="margin-bottom:7px;">
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">SALARIO BASE</span>
              <div style="font-size:15px;font-weight:700;color:#0f5132;">$${formatearNumero(resultado.salarioQuincenal)}</div>
            </div>
            <div style="margin-bottom:7px;">
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">PAGO/DIA</span>
              <div style="font-size:13px;color:#666;font-weight:600;">$${formatearNumero(resultado.pagoPorDia)}</div>
            </div>
            <div>
              <span style="font-weight:bold;color:#666;font-size:9px;display:block;margin-bottom:2px;">FOLIO</span>
              <div style="font-size:10px;color:#999;font-family:monospace;">${folio}</div>
            </div>
          </div>
        </div>
        <div style="padding:12px 25px;border-bottom:1px solid #e9ecef;">
          <h3 style="margin:0 0 10px 0;font-size:13px;color:#0f5132;border-bottom:2px solid #0f5132;padding-bottom:3px;display:inline-block;">ASISTENCIA</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
            <div style="text-align:center;padding:10px;background:#e8f5e8;border-radius:6px;">
              <div style="font-size:18px;font-weight:700;color:#0f5132;margin-bottom:3px;">${resultado.diasLaboralesEsperados||resultado.diasLaboralesReales||10}</div>
              <div style="font-size:8px;color:#666;font-weight:600;text-transform:uppercase;">ESPERADOS</div>
            </div>
            <div style="text-align:center;padding:10px;background:${resultado.diasTrabajados>=(resultado.diasLaboralesEsperados||10)?'#e8f5e8':'#fff3cd'};border-radius:6px;">
              <div style="font-size:18px;font-weight:700;color:${resultado.diasTrabajados>=(resultado.diasLaboralesEsperados||10)?'#0f5132':'#856404'};margin-bottom:3px;">${resultado.diasTrabajados}</div>
              <div style="font-size:8px;color:#666;font-weight:600;text-transform:uppercase;">TRABAJADOS</div>
            </div>
            <div style="text-align:center;padding:10px;background:${resultado.retardos>0?'#fff3cd':'#e8f5e8'};border-radius:6px;">
              <div style="font-size:18px;font-weight:700;color:${resultado.retardos>0?'#856404':'#0f5132'};margin-bottom:3px;">${resultado.retardos}</div>
              <div style="font-size:8px;color:#666;font-weight:600;text-transform:uppercase;">RETARDOS</div>
            </div>
            <div style="text-align:center;padding:10px;background:${resultado.diasFaltantes>0?'#f8d7da':'#e8f5e8'};border-radius:6px;">
              <div style="font-size:18px;font-weight:700;color:${resultado.diasFaltantes>0?'#721c24':'#0f5132'};margin-bottom:3px;">${resultado.diasFaltantes}</div>
              <div style="font-size:8px;color:#666;font-weight:600;text-transform:uppercase;">FALTAS</div>
            </div>
          </div>
        </div>
        <div style="padding:12px 25px;">
          <h3 style="margin:0 0 10px 0;font-size:13px;color:#0f5132;border-bottom:2px solid #0f5132;padding-bottom:3px;display:inline-block;">DESGLOSE</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;align-items:center;">
                <span style="font-size:10px;color:#666;">Dias efectivos:</span>
                <span style="font-weight:600;font-size:11px;">${resultado.diasEfectivos||resultado.diasTrabajados} dias</span>
              </div>
              ${resultado.diasDescuento>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;color:#dc3545;align-items:center;"><span style="font-size:10px;">Desc. retardos:</span><span style="font-weight:600;font-size:11px;">-${resultado.diasDescuento} dias</span></div>`:''}
              ${resultado.diasJustificados>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;color:#198754;align-items:center;"><span style="font-size:10px;">Dias justificados:</span><span style="font-weight:600;font-size:11px;">+${resultado.diasJustificados} dias</span></div>`:''}
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;align-items:center;">
                <span style="font-size:10px;color:#666;">Subtotal:</span>
                <span style="font-weight:600;font-size:11px;">$${formatearNumero(resultado.pagoTotal)}</span>
              </div>
            </div>
            <div>
              ${resultado.descuentoIMSS>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;color:#dc3545;align-items:center;"><span style="font-size:10px;">IMSS:</span><span style="font-weight:600;font-size:11px;">-$${formatearNumero(resultado.descuentoIMSS)}</span></div>`:''}
              ${resultado.descuentoCaja>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;color:#dc3545;align-items:center;"><span style="font-size:10px;">Caja ahorro:</span><span style="font-weight:600;font-size:11px;">-$${formatearNumero(resultado.descuentoCaja)}</span></div>`:''}
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:2px solid #0f5132;margin-top:6px;align-items:center;">
                <span style="font-size:11px;font-weight:600;color:#0f5132;">DESCUENTOS:</span>
                <span style="font-weight:700;color:#dc3545;font-size:11px;">-$${formatearNumero(resultado.totalDescuentos)}</span>
              </div>
            </div>
          </div>
          ${resultado.justificacionesDetalle&&resultado.justificacionesDetalle.length>0?`
            <div style="margin-top:12px;padding:10px;background:#f8f9fa;border-left:2px solid #17a2b8;border-radius:4px;">
              <div style="font-weight:600;color:#17a2b8;margin-bottom:5px;font-size:10px;">JUSTIFICACIONES:</div>
              ${resultado.justificacionesDetalle.map(j=>`<p style="margin:0 0 3px 0;color:#495057;font-size:9px;line-height:1.3;">- ${j.nombreTipo||j.tipo}: ${j.dias} dia(s) ${j.motivo?`(${j.motivo})`:''}</p>`).join('')}
            </div>
          `:''}
        </div>
        <div style="background:linear-gradient(135deg,#0f5132 0%,#198754 100%);color:white;padding:18px 25px;text-align:center;margin-top:10px;">
          <div style="margin-bottom:8px;">
            <span style="font-size:12px;opacity:0.9;font-weight:300;letter-spacing:1px;text-transform:uppercase;">${esProyeccion ? 'ESTIMADO A PAGAR' : 'TOTAL A PAGAR'}</span>
          </div>
          <div style="font-size:32px;font-weight:900;letter-spacing:1px;text-shadow:2px 2px 4px rgba(0,0,0,0.3);margin-bottom:8px;">$${formatearNumero(pagoFinal)}</div>
          <div style="font-size:10px;opacity:0.8;font-style:italic;">${periodoLabel.toLowerCase()} - ${mesLabel}</div>
        </div>
        <div style="background:#2c3e50;color:white;padding:12px 25px;text-align:center;font-size:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="opacity:0.7;"><strong>CIELITO HOME</strong><br>Experiencias a la Carta</div>
            <div style="opacity:0.7;">${fecha.toLocaleDateString('es-MX')} ${fecha.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:8px;opacity:0.6;">
            ${esProyeccion ? 'Estimacion - sujeta a cambios' : 'Comprobante oficial de pago'} - ${fecha.getFullYear()} Cielito Home
          </div>
        </div>
      </div>
    `;
  };

  // ===== RENDERIZADO =====

  // Tarjeta de proyeccion del periodo actual (siempre visible en la lista)
  const renderProyeccionActual = () => {
    if (loadingProyeccion) {
      return (
        <div className="card border-0 shadow-sm mb-4" style={{ borderLeft: '4px solid #198754' }}>
          <div className="card-body p-3 text-center">
            <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
            <span className="text-muted">Calculando proyeccion del periodo actual...</span>
          </div>
        </div>
      );
    }

    if (!proyeccion) {
      return (
        <div className="card border-0 shadow-sm mb-4" style={{ background: '#f8f9fa' }}>
          <div className="card-body p-3 text-center">
            <i className="bi bi-info-circle text-muted me-2"></i>
            <span className="text-muted small">No hay configuracion de nomina para tu perfil. Contacta a RH.</span>
          </div>
        </div>
      );
    }

    const p = proyeccion.periodo;
    const pagoFinal = proyeccion.pagoFinal;
    const pagoProyectado = proyeccion.pagoProyectado;
    const progreso = proyeccion.progresoPeriodo;

    return (
      <div className="card border-0 shadow mb-4" style={{ borderLeft: '4px solid #198754' }}>
        <div className="card-body p-0">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-3 pb-2">
            <div>
              <h6 className="mb-0 fw-bold">
                <i className="bi bi-lightning-charge text-warning me-1"></i>
                Periodo actual: {getPeriodoLabel(p.periodo)} - {MESES[p.mes - 1]} {p.anio}
              </h6>
              <small className="text-muted">
                Calculo en tiempo real basado en tu asistencia
              </small>
            </div>
            <span className="badge bg-warning text-dark">
              <i className="bi bi-clock me-1"></i>EN CURSO
            </span>
          </div>

          {/* Barra de progreso del periodo */}
          <div className="px-3 mb-2">
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>{proyeccion.diasTranscurridos} de {proyeccion.diasLaboralesReales} dias laborales transcurridos</span>
              <span>{progreso}%</span>
            </div>
            <div className="progress" style={{ height: '6px' }}>
              <div className="progress-bar bg-success" style={{ width: `${progreso}%` }}></div>
            </div>
          </div>

          {/* Stats */}
          <div className="row g-0 text-center border-top mx-0">
            <div className="col border-end p-2">
              <div className="fw-bold text-success">{proyeccion.diasTrabajados}</div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Trabajados</small>
            </div>
            <div className="col border-end p-2">
              <div className={`fw-bold ${proyeccion.retardos > 0 ? 'text-warning' : 'text-success'}`}>{proyeccion.retardos}</div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Retardos</small>
            </div>
            <div className="col border-end p-2">
              <div className={`fw-bold ${proyeccion.diasFaltantes > 0 ? 'text-danger' : 'text-success'}`}>{proyeccion.diasFaltantes}</div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Faltas</small>
            </div>
            <div className="col border-end p-2">
              <div className="fw-bold text-danger">${formatearNumero(proyeccion.totalDescuentos)}</div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Descuentos</small>
            </div>
            <div className="col p-2" style={{ background: 'linear-gradient(135deg, #e8f5e8, #d4edda)' }}>
              <div className="fw-bold text-success fs-6">${formatearNumero(pagoFinal)}</div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Pago actual</small>
            </div>
          </div>

          {/* Proyeccion si el periodo no ha terminado */}
          {proyeccion.diasRestantes > 0 && pagoProyectado !== pagoFinal && (
            <div className="px-3 py-2 small" style={{ background: '#fff3cd' }}>
              <i className="bi bi-graph-up-arrow me-1 text-warning"></i>
              <strong>Proyeccion si asistes todos los dias restantes ({proyeccion.diasRestantes}):</strong>
              <span className="fw-bold text-success ms-1">${formatearNumero(pagoProyectado)}</span>
            </div>
          )}

          {/* Boton ver detalle */}
          <div className="p-2 text-center border-top">
            <button className="btn btn-sm btn-outline-success me-2" onClick={verDetalleProyeccion}>
              <i className="bi bi-eye me-1"></i>Ver desglose completo
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => generarTicketPDF({ datos: proyeccion, periodo: p, esProyeccion: true })}
              disabled={generandoPDF}
            >
              <i className="bi bi-file-earmark-pdf me-1"></i>Descargar PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Vista de Proyecciones anuales
  const renderProyeccionesAnuales = () => {
    const proy = calcularProyeccionesAnuales();
    if (!proy) {
      return (
        <div className="text-center py-5">
          <i className="bi bi-graph-up text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">No hay datos suficientes para proyecciones anuales</p>
          <button className="btn btn-outline-success btn-sm" onClick={() => setVista('lista')}>
            <i className="bi bi-arrow-left me-1"></i>Volver
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">
            <i className="bi bi-graph-up-arrow me-2 text-success"></i>
            Proyecciones {anioSeleccionado}
          </h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setVista('lista')}>
            <i className="bi bi-arrow-left me-1"></i>Volver
          </button>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center p-3">
                <i className="bi bi-cash-stack text-success" style={{ fontSize: '1.5rem' }}></i>
                <div className="fw-bold fs-5 text-success mt-1">${formatearNumero(proy.totalPagado)}</div>
                <small className="text-muted">Total cobrado</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center p-3">
                <i className="bi bi-calculator text-primary" style={{ fontSize: '1.5rem' }}></i>
                <div className="fw-bold fs-5 text-primary mt-1">${formatearNumero(proy.promedioMensual)}</div>
                <small className="text-muted">Promedio mensual</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center p-3">
                <i className="bi bi-graph-up text-info" style={{ fontSize: '1.5rem' }}></i>
                <div className="fw-bold fs-5 text-info mt-1">${formatearNumero(proy.proyeccionAnual)}</div>
                <small className="text-muted">Proyeccion anual</small>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center p-3">
                <i className="bi bi-dash-circle text-danger" style={{ fontSize: '1.5rem' }}></i>
                <div className="fw-bold fs-5 text-danger mt-1">${formatearNumero(proy.totalDescuentos)}</div>
                <small className="text-muted">Total descuentos</small>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-3">
                <h6 className="text-muted mb-2"><i className="bi bi-calendar-check me-1"></i>Asistencia</h6>
                <div className="d-flex justify-content-between mb-1"><span>Dias trabajados:</span><strong>{proy.totalDiasTrabajados}</strong></div>
                <div className="d-flex justify-content-between mb-1"><span>Retardos:</span><strong className={proy.totalRetardos > 0 ? 'text-warning' : ''}>{proy.totalRetardos}</strong></div>
                <div className="d-flex justify-content-between"><span>Faltas:</span><strong className={proy.totalFaltas > 0 ? 'text-danger' : ''}>{proy.totalFaltas}</strong></div>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-3">
                <h6 className="text-muted mb-2"><i className="bi bi-bar-chart me-1"></i>Nominas procesadas: {proy.totalNominas}</h6>
                <div className="d-flex justify-content-between mb-1"><span>Meses con datos:</span><strong>{proy.mesesConDatos} de 12</strong></div>
                <div className="progress mb-2" style={{ height: '8px' }}>
                  <div className="progress-bar bg-success" style={{ width: `${(proy.mesesConDatos / 12) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0">
            <h6 className="mb-0"><i className="bi bi-table me-2"></i>Desglose mensual</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Mes</th>
                    <th className="text-end">Pagos</th>
                    <th className="text-end">Descuentos</th>
                    <th className="text-center">Retardos</th>
                    <th className="text-center">Faltas</th>
                    <th className="text-center">Periodos</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((mes, idx) => {
                    const data = proy.nominasPorMes[idx + 1];
                    if (!data) {
                      return (
                        <tr key={idx} className="text-muted" style={{ opacity: 0.5 }}>
                          <td>{mes}</td><td className="text-end">-</td><td className="text-end">-</td>
                          <td className="text-center">-</td><td className="text-center">-</td><td className="text-center">-</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={idx}>
                        <td className="fw-medium">{mes}</td>
                        <td className="text-end text-success fw-bold">${formatearNumero(data.pagos)}</td>
                        <td className="text-end text-danger">-${formatearNumero(data.descuentos)}</td>
                        <td className="text-center">{data.retardos > 0 ? <span className="badge bg-warning text-dark">{data.retardos}</span> : <span className="text-muted">0</span>}</td>
                        <td className="text-center">{data.faltas > 0 ? <span className="badge bg-danger">{data.faltas}</span> : <span className="text-muted">0</span>}</td>
                        <td className="text-center">{data.periodos}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-success">
                  <tr className="fw-bold">
                    <td>TOTAL</td>
                    <td className="text-end">${formatearNumero(proy.totalPagado)}</td>
                    <td className="text-end text-danger">-${formatearNumero(proy.totalDescuentos)}</td>
                    <td className="text-center">{proy.totalRetardos}</td>
                    <td className="text-center">{proy.totalFaltas}</td>
                    <td className="text-center">{proy.totalNominas}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Vista Detalle
  const renderDetalle = () => {
    if (!nominaDetalle) return null;

    const r = nominaDetalle.datos;
    const p = nominaDetalle.periodo;
    const esProyeccion = nominaDetalle.esProyeccion || r.esProyeccion;
    const pagoFinal = r.pagoFinalConJustificaciones || r.pagoFinalAjustado || r.pagoFinal;

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">
            <i className={`bi ${esProyeccion ? 'bi-lightning-charge text-warning' : 'bi-receipt text-success'} me-2`}></i>
            {esProyeccion && <span className="badge bg-warning text-dark me-2">ESTIMADO</span>}
            {getPeriodoLabel(p.periodo)} - {MESES[p.mes - 1]} {p.anio}
          </h5>
          <div>
            <button
              className="btn btn-success btn-sm me-2"
              onClick={() => generarTicketPDF(nominaDetalle)}
              disabled={generandoPDF}
            >
              {generandoPDF ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Generando...</>
              ) : (
                <><i className="bi bi-file-earmark-pdf me-1"></i>Descargar PDF</>
              )}
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={volverALista}>
              <i className="bi bi-arrow-left me-1"></i>Volver
            </button>
          </div>
        </div>

        {esProyeccion && (
          <div className="alert alert-warning py-2 small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            Esta es una <strong>proyeccion estimada</strong> basada en tu asistencia actual. El monto final puede variar cuando RH procese la nomina oficial.
          </div>
        )}

        <div className="card border-0 shadow-sm mb-3">
          <div className={`card-header ${esProyeccion ? 'bg-warning text-dark' : 'bg-success text-white'}`}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-0">{r.empleado?.nombre || userData?.nombre}</h6>
                <small className="opacity-75">{getTipoNombre(r.empleado?.tipo)} | {(r.empleado?.tipoNomina || r.periodo?.tipoNomina) === 'semanal' ? 'Semanal' : 'Quincenal'}</small>
              </div>
              <div className="text-end">
                <small className="d-block opacity-75">Salario base</small>
                <span className="fw-bold fs-5">${formatearNumero(r.salarioQuincenal)}</span>
              </div>
            </div>
          </div>
          <div className="card-body">
            {/* Progreso (solo para proyeccion) */}
            {esProyeccion && r.progresoPeriodo !== undefined && (
              <div className="mb-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Progreso del periodo</span>
                  <span>{r.diasTranscurridos} de {r.diasLaboralesReales} dias ({r.progresoPeriodo}%)</span>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div className="progress-bar bg-success" style={{ width: `${r.progresoPeriodo}%` }}></div>
                </div>
              </div>
            )}

            <h6 className="text-success border-bottom pb-2 mb-3"><i className="bi bi-calendar-check me-1"></i>Asistencia</h6>
            <div className="row g-2 mb-4">
              <div className="col-3">
                <div className="text-center p-2 rounded" style={{ background: '#e8f5e8' }}>
                  <div className="fw-bold fs-5 text-success">{r.diasLaboralesEsperados || r.diasLaboralesReales || 10}</div>
                  <small className="text-muted">Esperados</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center p-2 rounded" style={{ background: r.diasTrabajados >= (r.diasLaboralesEsperados || 10) ? '#e8f5e8' : '#fff3cd' }}>
                  <div className="fw-bold fs-5" style={{ color: r.diasTrabajados >= (r.diasLaboralesEsperados || 10) ? '#0f5132' : '#856404' }}>{r.diasTrabajados}</div>
                  <small className="text-muted">Trabajados</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center p-2 rounded" style={{ background: r.retardos > 0 ? '#fff3cd' : '#e8f5e8' }}>
                  <div className="fw-bold fs-5" style={{ color: r.retardos > 0 ? '#856404' : '#0f5132' }}>{r.retardos}</div>
                  <small className="text-muted">Retardos</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center p-2 rounded" style={{ background: r.diasFaltantes > 0 ? '#f8d7da' : '#e8f5e8' }}>
                  <div className="fw-bold fs-5" style={{ color: r.diasFaltantes > 0 ? '#721c24' : '#0f5132' }}>{r.diasFaltantes}</div>
                  <small className="text-muted">Faltas</small>
                </div>
              </div>
            </div>

            <h6 className="text-success border-bottom pb-2 mb-3"><i className="bi bi-cash-coin me-1"></i>Desglose financiero</h6>
            <div className="row">
              <div className="col-md-6">
                <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Pago por dia:</span><span className="fw-medium">${formatearNumero(r.pagoPorDia)}</span></div>
                <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Dias efectivos:</span><span className="fw-medium">{r.diasEfectivos || r.diasTrabajados} dias</span></div>
                {r.diasDescuento > 0 && <div className="d-flex justify-content-between py-2 border-bottom text-danger"><span>Desc. retardos:</span><span className="fw-medium">-{r.diasDescuento} dias</span></div>}
                {r.diasJustificados > 0 && <div className="d-flex justify-content-between py-2 border-bottom text-success"><span>Dias justificados:</span><span className="fw-medium">+{r.diasJustificados} dias</span></div>}
                <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Subtotal:</span><span className="fw-bold">${formatearNumero(r.pagoTotal)}</span></div>
              </div>
              <div className="col-md-6">
                {r.descuentoIMSS > 0 && <div className="d-flex justify-content-between py-2 border-bottom text-danger"><span>IMSS:</span><span className="fw-medium">-${formatearNumero(r.descuentoIMSS)}</span></div>}
                {r.descuentoCaja > 0 && <div className="d-flex justify-content-between py-2 border-bottom text-danger"><span>Caja ahorro:</span><span className="fw-medium">-${formatearNumero(r.descuentoCaja)}</span></div>}
                <div className="d-flex justify-content-between py-2 border-bottom border-success border-2"><span className="fw-bold text-success">DESCUENTOS:</span><span className="fw-bold text-danger">-${formatearNumero(r.totalDescuentos)}</span></div>
              </div>
            </div>

            {r.justificacionesDetalle && r.justificacionesDetalle.length > 0 && (
              <div className="mt-3 p-3 rounded" style={{ background: '#f0f8ff', borderLeft: '3px solid #17a2b8' }}>
                <h6 className="text-info mb-2"><i className="bi bi-info-circle me-1"></i>Justificaciones</h6>
                {r.justificacionesDetalle.map((j, idx) => (
                  <div key={idx} className="small mb-1">
                    <strong>{j.nombreTipo || j.tipo}:</strong> {j.dias} dia(s)
                    {j.motivo && <span className="text-muted"> - {j.motivo}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className={`mt-4 p-3 rounded text-center text-white`} style={{ background: esProyeccion ? 'linear-gradient(135deg, #856404, #ffc107)' : 'linear-gradient(135deg, #0f5132, #198754)' }}>
              <small className="d-block opacity-75 text-uppercase mb-1" style={{ letterSpacing: '1px' }}>{esProyeccion ? 'Estimado a pagar' : 'Total a pagar'}</small>
              <div className="fw-bold" style={{ fontSize: '2rem' }}>${formatearNumero(pagoFinal)}</div>
              {esProyeccion && r.diasRestantes > 0 && r.pagoProyectado !== pagoFinal && (
                <small className="d-block mt-1 opacity-75">
                  Proyeccion completa: ${formatearNumero(r.pagoProyectado)}
                </small>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Vista Lista
  const renderLista = () => (
    <div>
      {/* Proyeccion del periodo actual - SIEMPRE visible */}
      {renderProyeccionActual()}

      {/* Filtros */}
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <h6 className="mb-0 me-2"><i className="bi bi-clock-history me-1"></i>Historial de recibos</h6>
        <div className="d-flex align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)}>
            <option value="">Todos</option>
            {MESES.map((mes, idx) => <option key={idx} value={idx + 1}>{mes}</option>)}
          </select>
        </div>
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-outline-success btn-sm" onClick={() => setVista('proyecciones')} disabled={historial.length === 0}>
            <i className="bi bi-graph-up me-1"></i>Anuales
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => { cargarHistorial(); cargarProyeccion(); }} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-success" role="status"><span className="visually-hidden">Cargando...</span></div>
          <p className="text-muted mt-2">Cargando historial...</p>
        </div>
      ) : historial.length === 0 ? (
        <div className="text-center py-4">
          <i className="bi bi-receipt-cutoff text-muted" style={{ fontSize: '2.5rem' }}></i>
          <h6 className="mt-3 text-muted">Sin recibos guardados</h6>
          <p className="text-muted small">
            Los recibos oficiales apareceran aqui cuando RH procese la nomina.
            <br />Mientras tanto, puedes ver tu <strong>proyeccion en tiempo real</strong> arriba.
          </p>
        </div>
      ) : (
        <div>
          {historial.map((nomina, idx) => {
            const r = nomina.datos;
            const p = nomina.periodo;
            const pagoFinal = r.pagoFinalConJustificaciones || r.pagoFinalAjustado || r.pagoFinal;

            return (
              <div key={idx} className="card border-0 shadow-sm mb-2" style={{ cursor: 'pointer' }} onClick={() => verDetalle(nomina)}>
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">
                        <i className="bi bi-receipt text-success me-2"></i>
                        {getPeriodoLabel(p.periodo)} - {MESES[p.mes - 1]} {p.anio}
                      </h6>
                      <div className="d-flex gap-3 small text-muted">
                        <span><i className="bi bi-calendar-check me-1"></i>{r.diasTrabajados}/{r.diasLaboralesEsperados || 10} dias</span>
                        {r.retardos > 0 && <span className="text-warning"><i className="bi bi-exclamation-triangle me-1"></i>{r.retardos}</span>}
                        {r.diasFaltantes > 0 && <span className="text-danger"><i className="bi bi-x-circle me-1"></i>{r.diasFaltantes}</span>}
                        {r.totalDescuentos > 0 && <span className="text-danger">-${formatearNumero(r.totalDescuentos)}</span>}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold fs-5 text-success">${formatearNumero(pagoFinal)}</div>
                      <div className="d-flex gap-1 justify-content-end mt-1">
                        <button className="btn btn-sm btn-outline-success" onClick={(e) => { e.stopPropagation(); generarTicketPDF(nomina); }} disabled={generandoPDF} title="PDF">
                          <i className="bi bi-file-earmark-pdf"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); verDetalle(nomina); }} title="Detalle">
                          <i className="bi bi-eye"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {historial.length > 0 && (
            <div className="card border-0 shadow-sm mt-2" style={{ background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)' }}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">{historial.length} recibo{historial.length !== 1 ? 's' : ''}</small>
                  <div className="text-end">
                    <small className="text-muted d-block">Total</small>
                    <span className="fw-bold text-success fs-5">
                      ${formatearNumero(historial.reduce((sum, n) => sum + (n.datos.pagoFinalConJustificaciones || n.datos.pagoFinalAjustado || n.datos.pagoFinal || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="nomina-empleado-tab">
      <div className="d-flex align-items-center mb-3">
        <h4 className="mb-0">
          <i className="bi bi-wallet2 me-2 text-success"></i>
          Mi Nomina
        </h4>
      </div>

      {vista === 'lista' && renderLista()}
      {vista === 'detalle' && renderDetalle()}
      {vista === 'proyecciones' && renderProyeccionesAnuales()}
    </div>
  );
}

export default NominaEmpleadoTab;
