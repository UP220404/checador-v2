import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc, updateDoc, increment, onSnapshot, collection } from 'firebase/firestore';
import QRious from 'qrious';
import { api } from '../services/api';
import '../styles/QRGenerator.css';

// ─────────────────────────────────────────────────────────────────────────────
// CARRUSEL — Agrega aquí los nombres de las fotos que pusiste en public/fotos/
// ─────────────────────────────────────────────────────────────────────────────
const FOTOS_CARRUSEL = [ 
  '/fotos/1.jpg',
   '/fotos/2.jpg',
  '/fotos/3.jpg',
];
const INTERVALO_CARRUSEL_MS = 12000; // 12 segundos por foto

// Horarios clave
const HORA_INICIO     = 7;   // 7 AM  — activa el sistema
const HORA_CARRUSEL   = 10;  // 10 AM — empieza carrusel
const HORA_TARDE      = 13;  // 1 PM  — vuelve el QR estático
const HORA_DORMIR     = 17;  // 5 PM  — el sistema se duerme

function QRGenerator() {
  const navigate = useNavigate();
  const [tokenActual, setTokenActual]       = useState(null);
  const [modoActual, setModoActual]         = useState('detectando');
  const [countdown, setCountdown]           = useState('--');
  const [status, setStatus]                 = useState('iniciando');
  const [stats, setStats]                   = useState({ generados: 0, exitosos: 0, bloqueados: 0 });
  const [showQR, setShowQR]                 = useState(false);
  const [fechasProximas, setFechasProximas] = useState([]);
  const [loadingFechas, setLoadingFechas]   = useState(true);
  const [agenda, setAgenda]                 = useState([]);
  const [loadingAgenda, setLoadingAgenda]   = useState(true);
  const [agendaFecha, setAgendaFecha]       = useState('');
  const [agendaActualizada, setAgendaActualizada] = useState(false);
  const [minutosAhora, setMinutosAhora]     = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });
  const [fotoActual, setFotoActual]         = useState(0);
  const [marketingImages, setMarketingImages] = useState([]);
  const [horaActual, setHoraActual]         = useState(() => new Date());
  
  // Customization state
  const [viewOverride, setViewOverride]     = useState(() => localStorage.getItem('qr_view_override') || 'auto');
  const [showSettings, setShowSettings]     = useState(false);

  const qrCanvasRef       = useRef(null);
  const modoTickRef       = useRef(null);   // Tick de modo cada minuto
  const statsIntervalRef  = useRef(null);
  const agendaPollRef     = useRef(null);
  const agendaHashRef     = useRef('');
  const agendaListaRef    = useRef(null);
  const unsubscribeRef    = useRef(null);   // Listener Firestore (detección de escaneo)
  const carouselRef       = useRef(null);   // Interval de carrusel
  const carouselSnapshotRef = useRef(null); // Listener Firestore (carrusel de marketing)
  const dormidoRef        = useRef(false);  // ¿El sistema está dormido?
  const tokenActivoRef    = useRef(null);   // Token actualmente desplegado

  // ─── Ciclo de vida principal ───────────────────────────────────────────────
  useEffect(() => {
    inicializar();

    // Reloj local — sin peticiones de red
    const timeTick = setInterval(() => {
      const n = new Date();
      setMinutosAhora(n.getHours() * 60 + n.getMinutes());
      setHoraActual(new Date(n));
    }, 60000);

    // Tick de modo — detecta cambios de horario (sleep↔active, carrusel, etc.)
    modoTickRef.current = setInterval(() => {
      const tipo = getTipoModo();
      setModoActual(tipo);

      if (dormidoRef.current && tipo !== 'inactivo') {
        // Despertar: reinicializar todo
        dormidoRef.current = false;
        inicializar();
      } else if (!dormidoRef.current && tipo === 'inactivo') {
        // Dormir: apagar todo
        dormirSistema();
      }
    }, 60000);

    return () => {
      clearInterval(timeTick);
      limpiarTodo();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect mode changes to re-trigger QR when returning from carousel
  useEffect(() => {
    if ((modoActual === 'dinamico' || modoActual === 'estatico') && !dormidoRef.current) {
      if (status === 'carrusel' || status === 'iniciando' || !tokenActual) {
        verificarToken();
      }
    }
  }, [modoActual]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll a junta actual cuando carga la agenda
  useEffect(() => {
    if (!agenda.length || !agendaListaRef.current) return;
    setTimeout(() => scrollToCurrentTime(), 300);
  }, [agenda]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-scroll cada minuto
  useEffect(() => {
    scrollToCurrentTime();
  }, [minutosAhora]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carousel — arranca/para según el modo con tiempos dinámicos
  useEffect(() => {
    const listado = marketingImages.length > 0 ? marketingImages : FOTOS_CARRUSEL.map(url => ({ url, duracion: 10 }));
    
    if (modoActual === 'carrusel' && listado.length > 0) {
      const advanceSlide = () => {
        setFotoActual(f => {
          const nextIdx = (f + 1) % listado.length;
          const currentSlide = listado[nextIdx];
          const delay = (currentSlide.duracion || 10) * 1000;
          
          if (carouselRef.current) clearTimeout(carouselRef.current);
          carouselRef.current = setTimeout(advanceSlide, delay);
          
          return nextIdx;
        });
      };

      // Iniciar el primer timer
      if (!carouselRef.current) {
        const initialDelay = (listado[fotoActual]?.duracion || 10) * 1000;
        carouselRef.current = setTimeout(advanceSlide, initialDelay);
      }
    } else {
      if (carouselRef.current) { clearTimeout(carouselRef.current); carouselRef.current = null; }
    }
    return () => {
      if (carouselRef.current) { clearTimeout(carouselRef.current); carouselRef.current = null; }
    };
  }, [modoActual, marketingImages]);

  // QR Generation robust effect: redibuja si el token o el layout cambian
  useEffect(() => {
    if (tokenActual && qrCanvasRef.current) {
      const urlCompleta = `${window.location.origin}?qr=OFICINA2025&token=${tokenActual}&t=${Date.now()}`;
      
      new QRious({
        element:    qrCanvasRef.current,
        value:      urlCompleta,
        size:       480,
        foreground: '#155d27',
        background: '#ffffff'
      });

      // Si estábamos esperando o detectando, activamos el QR
      if (status === 'generando' || status === 'detectando' || status === 'iniciando' || !showQR) {
        setShowQR(true);
        setStatus('activo');
        setCountdown('Esperando escaneo');
        escucharTokenEscaneado(tokenActual);
      }
    }
  }, [status, tokenActual, viewOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers de modo ──────────────────────────────────────────────────────
  const getTipoModo = () => {
    const h = new Date().getHours();
    if (h < HORA_INICIO || h >= HORA_DORMIR) return 'inactivo';
    if (h < HORA_CARRUSEL)                   return 'dinamico';
    if (h < HORA_TARDE)                      return 'carrusel';
    return 'estatico';
  };

  const detectarModo = () => {
    const tipo = getTipoModo();
    const MAP = {
      inactivo: { tipo, descripcion: 'Sistema en reposo', icono: 'bi-moon-stars',   clase: 'status-night'    },
      dinamico:  { tipo, descripcion: 'QR Activo · Renueva al escanear', icono: 'bi-qr-code-scan', clase: 'mode-dinamico' },
      carrusel:  { tipo, descripcion: 'Pantalla de bienvenida',           icono: 'bi-images',        clase: 'mode-carrusel' },
      estatico:  { tipo, descripcion: 'QR Activo · Renueva al escanear', icono: 'bi-shield-lock',   clase: 'mode-estatico' },
    };
    return MAP[tipo] || MAP.inactivo;
  };

  // Calcula cuándo expira el token según el modo
  const calcularExpiracion = (tipoModo) => {
    const ahora = Date.now();
    if (tipoModo === 'dinamico') {
      // El QR dinámico solo vive 2 minutos. Si nadie lo usa, se regenera.
      // Esto evita "fotos compartidas" a larga distancia.
      return ahora + (2 * 60 * 1000);
    } else {
      // Modo estático (Tarde): Vive hasta que el sistema se duerme
      const fin = new Date();
      fin.setHours(HORA_DORMIR, 0, 0, 0);
      if (fin.getTime() < ahora) fin.setDate(fin.getDate() + 1);
      return fin.getTime();
    }
  };

  // ─── Sleep / Wake ─────────────────────────────────────────────────────────
  const dormirSistema = () => {
    dormidoRef.current = true;
    if (statsIntervalRef.current)  { clearInterval(statsIntervalRef.current);  statsIntervalRef.current = null; }
    if (agendaPollRef.current)     { clearInterval(agendaPollRef.current);     agendaPollRef.current = null; }
    if (carouselRef.current)       { clearInterval(carouselRef.current);       carouselRef.current = null; }
    if (unsubscribeRef.current)    { unsubscribeRef.current();                 unsubscribeRef.current = null; }
    tokenActivoRef.current = null;
    setStatus('dormido');
    setShowQR(false);
  };

  const limpiarTodo = () => {
    if (modoTickRef.current)       clearInterval(modoTickRef.current);
    if (statsIntervalRef.current)  clearInterval(statsIntervalRef.current);
    if (agendaPollRef.current)     clearInterval(agendaPollRef.current);
    if (carouselRef.current)       clearInterval(carouselRef.current);
    if (unsubscribeRef.current)    unsubscribeRef.current();
    if (carouselSnapshotRef.current) {
      carouselSnapshotRef.current();
      carouselSnapshotRef.current = null;
    }
  };

  // ─── Firestore listener: detecta escaneo y auto-regenera ──────────────────
  const escucharTokenEscaneado = (tokenGenerado) => {
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }

    const tokenRef = doc(db, 'qr_tokens', 'current');
    unsubscribeRef.current = onSnapshot(tokenRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      // Solo regeneramos si el token activo ha sido marcado como usado
      // Esto evita la condición de carrera donde el generador cambia el token
      // mientras el servidor aún lo está validando.
      const debeRegenerar = data.token === tokenActivoRef.current && data.usado === true;

      if (debeRegenerar) {
        setStatus('escaneado');
        setShowQR(false);
        setCountdown('Generando nuevo...');
        setTimeout(() => generarQR(false), 1200);
      }
    });
  };

  // ─── QR generation ────────────────────────────────────────────────────────
  const generarTokenSeguro = () => {
    const ts    = Date.now();
    const r1    = Math.random().toString(36).substring(2, 15);
    const r2    = Math.random().toString(36).substring(2, 8);
    const modo  = getTipoModo().charAt(0).toUpperCase();
    return `CH_${modo}_${ts}_${r1}_${r2}`.toUpperCase();
  };

  const generarQR = async (forzarPorUsuario = false) => {
    try {
      const modo = detectarModo();
      setModoActual(modo.tipo);

      if (modo.tipo === 'inactivo' || modo.tipo === 'carrusel') return;

      setStatus('generando');
      setShowQR(false);

      const nuevoToken   = generarTokenSeguro();
      const expiracion   = calcularExpiracion(modo.tipo);
      const duracionMin  = Math.round((expiracion - Date.now()) / 60000);

      tokenActivoRef.current = nuevoToken;
      setTokenActual(nuevoToken);

      await setDoc(doc(db, 'qr_tokens', 'current'), {
        token:           nuevoToken,
        expiracion:      new Date(expiracion),
        creado:          new Date(),
        usado:           false,
        activo:          true,
        modo:            modo.tipo,
        duracionMinutos: duracionMin,
        contadorUsos:    0,
        ultimoUsuario:   null,
        ultimoAcceso:    null
      });

      if (forzarPorUsuario) await actualizarEstadisticas();

    } catch (error) {
      console.error('Error generando QR:', error);
      setStatus('error');
    }
  };

  const actualizarEstadisticas = async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const statsRef = doc(db, 'qr_stats', hoy);
      try {
        await updateDoc(statsRef, { generados: increment(1), ultimaActualizacion: new Date() });
      } catch {
        await setDoc(statsRef, { generados: 1, exitosos: 0, bloqueados: 0, fecha: hoy, ultimaActualizacion: new Date() });
      }
      await cargarEstadisticas();
    } catch (error) {
      console.error('Error actualizando estadísticas:', error);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const statsDoc = await getDoc(doc(db, 'qr_stats', hoy));
      if (statsDoc.exists()) {
        const data = statsDoc.data();
        setStats({ generados: data.generados || 0, exitosos: data.exitosos || 0, bloqueados: data.bloqueados || 0 });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const verificarToken = async () => {
    try {
      const modo = detectarModo();
      setModoActual(modo.tipo);

      if (modo.tipo === 'inactivo') { dormirSistema(); return; }
      if (modo.tipo === 'carrusel') { setStatus('carrusel'); return; }

      const tokenDoc = await getDoc(doc(db, 'qr_tokens', 'current'));

      if (tokenDoc.exists()) {
        const data       = tokenDoc.data();
        const expiracion = data.expiracion.toDate();
        const debeRegen  = data.usado || new Date() > expiracion || data.modo !== modo.tipo;

        if (debeRegen) {
          await generarQR(false);
        } else {
          tokenActivoRef.current = data.token;
          setTokenActual(data.token);
          setStatus('generando'); // El useEffect se encarga de pintar el QR
        }
      } else {
        await generarQR(true);
      }
      await cargarEstadisticas();
    } catch (error) {
      console.error('Error verificando token:', error);
      await generarQR(true);
    }
  };

  // ── GOOGLE SHEETS ──────────────────────────────────────────────────────────
  const SPREADSHEET_ID = '1tGgyRdl76vTFtaBVGqmYXyYb14bh8iy3EwhUruVyHdg';
  const quitarAcentos = (str) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';


  const parseHora = (horaStr) => {
    if (!horaStr) return -1;
    const s = horaStr.trim().toUpperCase();
    const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
    if (m) {
      let h = parseInt(m[1]); const min = m[2] !== undefined ? parseInt(m[2]) : 0;
      if (m[3] === 'PM' && h !== 12) h += 12;
      if (m[3] === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    }
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
    return -1;
  };

  const parseHoraFin = (horaStr) => {
    if (!horaStr) return -1;
    const partes = horaStr.split(/\s*-\s*/);
    if (partes.length < 2) return -1;
    return parseHora(partes[1]);
  };

  const scrollToCurrentTime = () => {
    if (!agendaListaRef.current) return;
    const container = agendaListaRef.current;
    const target = container.querySelector('.en-curso-header')
      || container.querySelector('.proximas-header');
    if (!target) { container.scrollTop = 0; return; }
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  };

  const construirNombresHoja = () => {
    const fecha = new Date();
    const dias     = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diasSin  = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const mesesAbr  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mesesFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const diaNom   = dias[fecha.getDay()];
    const diaSin   = diasSin[fecha.getDay()];
    const diaNum   = String(fecha.getDate());
    const diaNum0  = diaNum.padStart(2, '0');
    const mesAbr   = mesesAbr[fecha.getMonth()];
    const mesFull  = mesesFull[fecha.getMonth()];
    const anio     = fecha.getFullYear();
    // Variantes ordenadas de mayor a menor probabilidad de coincidencia
    return [
      // Nuevo formato: "Martes 12 Mayo 2026" (con acento y sin cero)
      `${diaNom} ${diaNum} ${mesFull} ${anio}`,
      // Sin acento en día: "Martes 12 Mayo 2026"
      `${diaSin} ${diaNum} ${mesFull} ${anio}`,
      // Con cero: "Martes 12 Mayo 2026"
      `${diaNom} ${diaNum0} ${mesFull} ${anio}`,
      `${diaSin} ${diaNum0} ${mesFull} ${anio}`,
      // Mes abreviado sin año: "Martes 12 May"
      `${diaNom} ${diaNum0} ${mesAbr}`,
      `${diaSin} ${diaNum0} ${mesAbr}`,
      `${diaNom} ${diaNum} ${mesAbr}`,
      `${diaSin} ${diaNum} ${mesAbr}`,
      // Solo número y mes
      `${diaNum} ${mesFull}`,
      `${diaNum0} ${mesFull}`,
      `${diaNum} ${mesAbr}`,
    ];
  };

  const parsearCSV = (texto) => {
    if (!texto) return [];
    const lineas = [];
    let lineaActual = [];
    let campoActual = '';
    let enComillas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (c === '"') {
            if (enComillas && texto[i+1] === '"') { campoActual += '"'; i++; }
            else { enComillas = !enComillas; }
        } else if (c === ',' && !enComillas) {
            lineaActual.push(campoActual.trim()); campoActual = '';
        } else if ((c === '\n' || c === '\r') && !enComillas) {
            lineaActual.push(campoActual.trim());
            if (lineaActual.length > 0) lineas.push(lineaActual);
            lineaActual = []; campoActual = '';
            if (c === '\r' && texto[i+1] === '\n') i++;
        } else {
            campoActual += c;
        }
    }
    if (campoActual || lineaActual.length > 0) { lineaActual.push(campoActual.trim()); lineas.push(lineaActual); }
    return lineas;
  };

  const fetchHoja = async (nombre) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nombre)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const csv = await resp.text();
      if (!csv || csv.trimStart().startsWith('<')) return null;
      const filas = parsearCSV(csv);
      const hIdx = filas.findIndex(f => f.some(c => c.toLowerCase().includes('hora')));
      if (hIdx === -1) return null;
      const header = filas[hIdx].map(c => c.toLowerCase().trim());
      const iHora    = header.findIndex(c => c.includes('hora'));
      const iCliente = header.findIndex(c => c.includes('cliente'));
      const iMeeting = header.findIndex(c => c.includes('meeting') || (c.includes('nombre') && !c.includes('fecha')) || c.includes('asunto') || c.includes('titulo'));
      const iAsignada = header.findIndex(c => c.includes('asignad') || c.includes('responsable'));
      const iLink    = header.findIndex(c => c.includes('link') || c.includes('comentar') || c.includes('url'));
      return filas.slice(hIdx + 1).filter(f => f[iHora] && (f[iMeeting] || f[iCliente])).map(f => {
        const hStr = f[iHora] || '';
        const match = hStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        let startMin = -1;
        if (match) {
          let h = parseInt(match[1]);
          const m = parseInt(match[2]);
          if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
          if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
          startMin = h * 60 + m;
        }
        return {
          fila: ['', hStr, f[iCliente] || '', f[iMeeting] || f[iCliente] || '(Sin título)', f[iAsignada] || '', f[iLink] || ''],
          startMin
        };
      });
    } catch (e) { return null; }
  };

  const cargarAgenda = async (silencioso = false) => {
    if (!silencioso) setLoadingAgenda(true);
    const variantes = construirNombresHoja();
    // Mostrar el primer nombre (el más probable) en el badge de la UI
    setAgendaFecha(variantes[0]);
    try {
      let datos = null;
      let nombreEncontrado = '';
      // Probar cada variante hasta encontrar una hoja con datos
      for (const nombre of variantes) {
        const resultado = await fetchHoja(nombre);
        if (resultado && resultado.length > 0) {
          datos = resultado;
          nombreEncontrado = nombre;
          break;
        }
      }
      if (nombreEncontrado) {
        setAgendaFecha(nombreEncontrado);
      }
      const resultado = datos || [];
      const nuevoHash = JSON.stringify(resultado);
      if (silencioso && nuevoHash !== agendaHashRef.current) {
        setAgendaActualizada(true);
        setTimeout(() => setAgendaActualizada(false), 3000);
      }
      agendaHashRef.current = nuevoHash;
      setAgenda(resultado);
    } catch (e) {
      console.error('[Agenda] Error general:', e);
      if (!silencioso) setAgenda([]);
    } finally {
      if (!silencioso) setLoadingAgenda(false);
    }
  };

  // ─── Fechas importantes ────────────────────────────────────────────────────
  const calcularDiasRestantes = (mes, dia, hoy) => {
    const hoyNorm = new Date(hoy); hoyNorm.setHours(0, 0, 0, 0);
    let fecha = new Date(hoy.getFullYear(), parseInt(mes) - 1, parseInt(dia)); fecha.setHours(0, 0, 0, 0);
    if (fecha < hoyNorm) fecha = new Date(hoy.getFullYear() + 1, parseInt(mes) - 1, parseInt(dia));
    const diff   = Math.round((fecha - hoyNorm) / (1000 * 60 * 60 * 24));
    const meses  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const texto  = `${parseInt(dia)} de ${meses[parseInt(mes) - 1]}`;
    return { dias: diff, texto, anioFecha: fecha.getFullYear() };
  };

  const cargarFechasImportantes = async () => {
    setLoadingFechas(true);
    try {
      const resp     = await api.getUsers();
      const empleados = (resp.data.data || []).filter(e => e.activo !== false);
      const hoy       = new Date();
      const resultado = [];
      for (const emp of empleados) {
        if (emp.fechaNacimiento) {
          const [, mes, dia] = emp.fechaNacimiento.split('-');
          const { dias, texto } = calcularDiasRestantes(mes, dia, hoy);
          if (dias <= 15) resultado.push({ tipo: 'cumpleanos', nombre: emp.nombre, descripcion: `Cumpleaños · ${texto}`, dias });
        }
        if (emp.fechaIngreso) {
          const [anioStr, mes, dia] = emp.fechaIngreso.split('-');
          const { dias, texto, anioFecha } = calcularDiasRestantes(mes, dia, hoy);
          const anios = anioFecha - parseInt(anioStr);
          
          let descripcionAniversario = '';
          if (anios === 0) {
            descripcionAniversario = `Nuevo Ingreso · ${texto}`;
          } else {
            descripcionAniversario = `${anios} año${anios !== 1 ? 's' : ''} en Cielito Home · ${texto}`;
          }

          if (dias <= 15) resultado.push({ 
            tipo: 'aniversario', 
            nombre: emp.nombre, 
            descripcion: descripcionAniversario, 
            dias 
          });
        }
      }
      resultado.sort((a, b) => a.dias - b.dias);
      setFechasProximas(resultado);
    } catch (err) {
      console.error('Error cargando fechas:', err);
    } finally {
      setLoadingFechas(false);
    }
  };

  const cargarMarketingImages = async () => {
    try {
      const resp = await api.getCarouselImages();
      if (resp.data?.success) {
        setMarketingImages(resp.data.data);
        // Resetear indice si cambiaron las imagenes para evitar desborde
        setFotoActual(0);
      }
    } catch (error) {
      console.error('Error cargando imágenes de marketing:', error);
    }
  };

  // ─── Inicializar ──────────────────────────────────────────────────────────
  const inicializar = async () => {
    dormidoRef.current = false;
    const tipo = getTipoModo();
    setModoActual(tipo);

    // En carrusel o modo activo: cargar agenda, fechas e imágenes de marketing
    if (tipo !== 'inactivo') {
      await Promise.all([cargarFechasImportantes(), cargarAgenda(), cargarMarketingImages()]);
      agendaPollRef.current = setInterval(() => cargarAgenda(true), 2 * 60 * 1000);

      // Real-time listener para que el TV se actualice al instante sin recargar
      if (!carouselSnapshotRef.current) {
        carouselSnapshotRef.current = onSnapshot(collection(db, 'marketing_carousel'), () => {
          cargarMarketingImages();
        });
      }
    }

    // En carrusel: no generar QR, solo mostrar carrusel
    if (tipo === 'carrusel') {
      setStatus('carrusel');
      statsIntervalRef.current = setInterval(() => cargarEstadisticas(), 2 * 60 * 1000);
      return;
    }

    // En modo activo: verificar/generar QR
    if (tipo !== 'inactivo') {
      await verificarToken();
      statsIntervalRef.current = setInterval(() => cargarEstadisticas(), 2 * 60 * 1000);
    } else {
      dormirSistema();
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const modo = detectarModo();

  const horaDisplay = horaActual.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  const fechaDisplay = horaActual.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  // ─── SLEEP SCREEN ─────────────────────────────────────────────────────────
  if (modo.tipo === 'inactivo') {
    return (
      <div className="sleep-screen">
        <div className="sleep-content">
          <div className="sleep-icon"><i className="bi bi-moon-stars-fill"></i></div>
          <div className="sleep-time">{horaDisplay}</div>
          <div className="sleep-date">{fechaDisplay}</div>
          <div className="sleep-msg">El sistema se reactiva a las {HORA_INICIO}:00 AM</div>
          <div className="sleep-brand">Cielito Home</div>
        </div>
      </div>
    );
  }

  // ─── JSX principal ────────────────────────────────────────────────────────
  return (
    <div className="qr-page-wrapper">
      {/* Controles de navegación fijos (Fuera del grid principal) */}
      <div id="fixed-nav-controls" className="top-nav-controls">
        <button 
          className="nav-home-btn"
          onClick={() => navigate('/')}
          title="Regresar al inicio"
        >
          <i className="bi bi-house-door-fill"></i>
        </button>

        <button 
          className={`settings-gear-btn-fixed ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Configuración de pantalla"
        >
          <i className="bi bi-gear-fill"></i>
        </button>
      </div>

      <div className={`main-container view-${viewOverride}`}>

        {/* ── PANEL IZQUIERDO: QR o Carrusel ── */}
        {(viewOverride === 'auto' || viewOverride === 'qr-agenda' || viewOverride === 'fotos-solo' || viewOverride === 'fotos-agenda') && (
          <div className={`qr-section ${ (viewOverride === 'fotos-solo') ? 'full-width' : ''}`}>
            { (modo.tipo === 'carrusel' || viewOverride === 'fotos-solo' || viewOverride === 'fotos-agenda') && viewOverride !== 'qr-agenda' ? (
              /* ── CARRUSEL ── */
              <div className="carrusel-wrapper">
              {(() => {
                const listado = marketingImages.length > 0 ? marketingImages : FOTOS_CARRUSEL.map(url => ({ url }));
                if (listado.length > 0) {
                  const img = listado[fotoActual];
                  return (
                    <>
                      {img.resource_type === 'video' ? (
                        <video
                          key={fotoActual}
                          src={img.url}
                          className="carrusel-foto"
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <img
                          key={fotoActual}
                          src={img.url}
                          alt={img.titulo || `Cielito Home ${fotoActual + 1}`}
                          className="carrusel-foto"
                          style={{ objectPosition: img.objectPosition || '50% 50%' }}
                        />
                      )}
                      <div className="carrusel-overlay">
                        <div className="carrusel-brand">{img.titulo || 'Cielito Home'}</div>
                      </div>
                      <div className="carrusel-dots">
                        {listado.map((_, i) => (
                          <button
                            key={i}
                            className={`carrusel-dot${i === fotoActual ? ' activo' : ''}`}
                            onClick={() => setFotoActual(i)}
                            aria-label={`Foto ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  );
                } else {
                  return (
                    /* Sin fotos configuradas */
                    <div className="carrusel-empty">
                      <i className="bi bi-images"></i>
                      <p>Sube fotos desde el panel de Marketing</p>
                    </div>
                  );
                }
              })()}
                <div className="carrusel-time">
                  <span>{horaDisplay}</span>
                </div>
              </div>
            ) : (
              /* ── QR ── */
              <>
              <div className="logo-section">
                <h1 className="title">Cielito Home <span style={{ fontSize: '12px', opacity: 0.4 }}>v2.1.9</span></h1>
                <p className="subtitle">Código QR de Acceso Inteligente</p>
              </div>

              <div className="qr-display">
                <div className={`status-badge status-${status === 'activo' ? 'success' : status === 'escaneado' ? 'warning' : status === 'error' ? 'danger' : 'warning'}`}>
                  <i className={`bi bi-${status === 'activo' ? 'shield-check' : status === 'escaneado' ? 'check-circle' : status === 'error' ? 'x-circle' : 'clock'}`}></i>
                  <span>{status === 'activo' ? 'Activo' : status === 'escaneado' ? 'Escaneado' : status === 'error' ? 'Error' : 'Generando'}</span>
                </div>

                {!showQR && (
                  <div className="loading-spinner">
                    <div className="loading-icon">
                      <i className={`bi ${status === 'escaneado' ? 'bi-check-circle' : 'bi-hourglass-split'}`}></i>
                    </div>
                    <p className="loading-text">
                      {status === 'escaneado' ? '¡QR escaneado! Generando nuevo...' : 'Generando QR...'}
                    </p>
                  </div>
                )}

                <canvas ref={qrCanvasRef} className="qr-canvas" style={{ display: showQR ? 'block' : 'none' }}></canvas>
              </div>

              <div className={`mode-indicator ${modo.clase}`}>
                <i className={`bi ${modo.icono} me-2`}></i>
                <span>{modo.descripcion}</span>
              </div>

              <button
                className="refresh-button"
                onClick={() => generarQR(true)}
                disabled={modo.tipo === 'inactivo' || modo.tipo === 'carrusel' || status === 'generando'}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                {status === 'generando' ? 'Generando...' : 'Forzar nuevo QR'}
              </button>
            </>
          )}
          </div>
        )}

        {/* ── PANEL DERECHO: Agenda + Fechas ── */}
        {(viewOverride === 'auto' || viewOverride === 'agenda-solo' || viewOverride === 'qr-agenda' || viewOverride === 'fotos-agenda') && (
          <div className={`info-section ${viewOverride === 'agenda-solo' ? 'full-width' : ''}`}>

          {/* Agenda del día */}
          <div className="agenda-panel">
            <h2 className="panel-title">
              <i className="bi bi-calendar2-week"></i>
              Agenda del Día
              <span className="agenda-fecha-badge">{agendaFecha}</span>
              <span className={`live-dot${agendaActualizada ? ' actualizada' : ''}`} title="Actualización automática cada 2 min"></span>
            </h2>

            {loadingAgenda ? (
              <div className="panel-loading"><i className="bi bi-hourglass-split"></i><span>Cargando agenda...</span></div>
            ) : agenda.length === 0 ? (
              <div className="panel-empty">
                <i className="bi bi-calendar-x"></i>
                <span>Sin agenda para hoy</span>
                <span style={{ fontSize: '0.6rem', color: '#ccc', marginTop: '0.2rem' }}>Hoja buscada: «{agendaFecha}»</span>
              </div>
            ) : (
              <div className="agenda-lista" ref={agendaListaRef}>
                {(() => {
                  const conTiempos = agenda.map((item, i) => {
                    const fila     = item.fila;
                    const startMin = item.startMin;
                    const nextItem = agenda[i + 1];
                    const nextMin  = nextItem ? nextItem.startMin : -1;
                    
                    // Calcular endMin si no está definido (asumir 1h si no hay siguiente)
                    let endMin = -1;
                    const hStr = fila[1] || '';
                    const finMatch = hStr.split(/\s*-\s*|\s*a\s*/i)[1];
                    if (finMatch) {
                      const match = finMatch.match(/(\d+):(\d+)\s*(AM|PM)/i);
                      if (match) {
                        let h = parseInt(match[1]);
                        const m = parseInt(match[2]);
                        if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
                        if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
                        endMin = h * 60 + m;
                      }
                    }
                    if (endMin === -1) {
                      endMin = (nextMin !== -1 && nextMin > startMin) ? nextMin : (startMin !== -1 ? startMin + 60 : -1);
                    }

                    return { fila, i, startMin, endMin };
                  });

                  const enCurso  = conTiempos.filter(({ startMin, endMin }) => startMin !== -1 && startMin <= minutosAhora && (endMin === -1 || endMin > minutosAhora));
                  const proximas = conTiempos.filter(({ startMin })          => startMin === -1 || startMin > minutosAhora);
                  const pasadas  = conTiempos.filter(({ startMin, endMin }) => startMin !== -1 && endMin !== -1 && endMin <= minutosAhora);

                  const renderItem = ({ fila, i, startMin }, extraClass = '') => {
                    const hora     = fila[1] || '';
                    const cliente  = fila[2] || '';
                    const meeting  = fila[3] || '';
                    const asignada = fila[4] || '';
                    const link     = fila[5] || '';
                    const esLink   = link.startsWith('http');
                    return (
                      <div key={i} data-min={startMin} className={`agenda-item ${extraClass}`}>
                        {hora && <div className="agenda-hora">{hora}</div>}
                        <div className="agenda-info">
                          <span className="agenda-meeting">{meeting || '(Sin título)'}</span>
                          <div className="agenda-meta">
                            {cliente  && <span className="agenda-cliente"><i className="bi bi-building me-1"></i>{cliente}</span>}
                            {asignada && <span className="agenda-asignada"><i className="bi bi-person me-1"></i>{asignada}</span>}
                          </div>
                          {!esLink && link && <span className="agenda-comentario">{link}</span>}
                        </div>
                        {esLink && (
                          <a href={link} target="_blank" rel="noreferrer" className="agenda-link" title="Abrir enlace">
                            <i className="bi bi-box-arrow-up-right"></i>
                          </a>
                        )}
                      </div>
                    );
                  };

                  if (enCurso.length === 0 && proximas.length === 0 && pasadas.length === 0) {
                    return <div className="panel-empty"><i className="bi bi-calendar-check"></i><span>Sin juntas para hoy</span></div>;
                  }
                  return (
                    <>
                      {/* Pasadas arriba — el scroll las empuja fuera del área visible */}
                      {pasadas.map(item => renderItem(item, 'pasada'))}
                      {enCurso.length > 0 && (
                        <>
                          <div className="agenda-seccion-header en-curso-header"><i className="bi bi-record-circle-fill"></i>En Curso</div>
                          {enCurso.map(item => renderItem(item, 'en-curso-item'))}
                        </>
                      )}
                      {proximas.length > 0 && (
                        <>
                          <div className={`agenda-seccion-header proximas-header${enCurso.length > 0 ? ' con-separador' : ''}`}>
                            <i className="bi bi-clock"></i>Próximas
                          </div>
                          {proximas.map(item => renderItem(item, ''))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Fechas importantes */}
          <div className="fechas-panel">
            <h2 className="panel-title">
              <i className="bi bi-calendar-heart"></i>
              Fechas Importantes
            </h2>
            {loadingFechas ? (
              <div className="panel-loading"><i className="bi bi-hourglass-split"></i><span>Cargando...</span></div>
            ) : fechasProximas.length === 0 ? (
              <div className="panel-empty"><i className="bi bi-calendar-check"></i><span>Sin fechas en los próximos 60 días</span></div>
            ) : (
              <div className="fechas-lista-qr">
                {fechasProximas.map((item, i) => (
                  <div key={i} className={`fecha-qr-item ${item.tipo}`}>
                    <div className="fecha-qr-icon">
                      <i className={`bi ${item.tipo === 'cumpleanos' ? 'bi-gift' : 'bi-award'}`}></i>
                    </div>
                    <div className="fecha-qr-info">
                      <span className="fecha-qr-nombre">{item.nombre}</span>
                      <span className="fecha-qr-desc">{item.descripcion}</span>
                    </div>
                    <div className="fecha-qr-dias">
                      {item.dias === 0 ? <span className="badge-hoy">HOY</span> : <span>{item.dias}d</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* ── BOTÓN DE AJUSTES (TUERQUITA) SE MOVIÓ AL TÍTULO ── */}

      {/* ── PANEL DE AJUSTES ── */}
      {showSettings && (
        <div className="settings-panel-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-panel-header">
              <h5><i className="bi bi-display me-2"></i>Personalizar Pantalla</h5>
              <button className="btn-close-settings" onClick={() => setShowSettings(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <div className="settings-options">
              <p className="settings-label">Modo de Visualización:</p>
              
              {[
                { id: 'auto', label: 'Modo por Defecto (Auto)', icon: 'bi-clock-history' },
                { id: 'qr-agenda', label: 'QR + Agenda', icon: 'bi-layout-split' },
                { id: 'fotos-agenda', label: 'Fotos + Agenda', icon: 'bi-grid-1x2' },
                { id: 'agenda-solo', label: 'Solo Agenda', icon: 'bi-calendar-week' },
                { id: 'fotos-solo', label: 'Solo Fotos / Marketing', icon: 'bi-images' }
              ].map(opt => (
                <button
                  key={opt.id}
                  className={`settings-opt-btn ${viewOverride === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    setViewOverride(opt.id);
                    localStorage.setItem('qr_view_override', opt.id);
                    setShowSettings(false);
                  }}
                >
                  <i className={`bi ${opt.icon}`}></i>
                  <span>{opt.label}</span>
                  {viewOverride === opt.id && <i className="bi bi-check-lg ms-auto text-success"></i>}
                </button>
              ))}
            </div>

            <div className="settings-footer">
              <p><i className="bi bi-info-circle me-1"></i> La configuración se guarda localmente en esta TV.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QRGenerator;
