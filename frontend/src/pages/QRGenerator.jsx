import { useState, useEffect, useRef } from 'react';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
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
  const [horaActual, setHoraActual]         = useState(() => new Date());

  const qrCanvasRef       = useRef(null);
  const modoTickRef       = useRef(null);   // Tick de modo cada minuto
  const statsIntervalRef  = useRef(null);
  const agendaPollRef     = useRef(null);
  const agendaHashRef     = useRef('');
  const agendaListaRef    = useRef(null);
  const unsubscribeRef    = useRef(null);   // Listener Firestore (detección de escaneo)
  const carouselRef       = useRef(null);   // Interval de carrusel
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

  // Scroll a junta actual cuando carga la agenda
  useEffect(() => {
    if (!agenda.length || !agendaListaRef.current) return;
    setTimeout(() => scrollToCurrentTime(), 300);
  }, [agenda]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-scroll cada minuto
  useEffect(() => {
    scrollToCurrentTime();
  }, [minutosAhora]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carousel — arranca/para según el modo
  useEffect(() => {
    if (modoActual === 'carrusel' && FOTOS_CARRUSEL.length > 0) {
      if (!carouselRef.current) {
        carouselRef.current = setInterval(() => {
          setFotoActual(f => (f + 1) % FOTOS_CARRUSEL.length);
        }, INTERVALO_CARRUSEL_MS);
      }
    } else {
      if (carouselRef.current) { clearInterval(carouselRef.current); carouselRef.current = null; }
    }
    return () => {
      if (carouselRef.current) { clearInterval(carouselRef.current); carouselRef.current = null; }
    };
  }, [modoActual]);

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

      const urlCompleta = `${window.location.origin}?qr=OFICINA2025&token=${nuevoToken}&t=${Date.now()}`;

      setTimeout(() => {
        if (qrCanvasRef.current) {
          new QRious({
            element:    qrCanvasRef.current,
            value:      urlCompleta,
            size:       340,
            foreground: '#155d27',
            background: '#ffffff'
          });
          setShowQR(true);
          setStatus('activo');
          setCountdown('Esperando escaneo');

          // Siempre escuchar: el QR se renueva al ser escaneado en cualquier modo activo
          escucharTokenEscaneado(nuevoToken);
        }
      }, 500);

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
          const urlCompleta = `${window.location.origin}?qr=OFICINA2025&token=${data.token}&t=${Date.now()}`;

          if (qrCanvasRef.current) {
            new QRious({ element: qrCanvasRef.current, value: urlCompleta, size: 340, foreground: '#155d27', background: '#ffffff' });
            setShowQR(true);
            setStatus('activo');
            setCountdown('Esperando escaneo');
            escucharTokenEscaneado(data.token);
          }
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

  const construirNombreHoja = (fecha = new Date()) => {
    const dias  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[fecha.getDay()]} ${String(fecha.getDate()).padStart(2, '0')} ${meses[fecha.getMonth()]}`;
  };

  const parsearCSV = (texto) => {
    const filas = [];
    let i = 0;
    const N = texto.length;

    while (i < N) {
      const fila = [];

      // Parsear todos los campos de esta fila
      while (i < N) {
        let campo = '';

        if (texto[i] === '"') {
          // Campo entre comillas: puede contener comas y saltos de línea
          i++;
          while (i < N) {
            if (texto[i] === '"' && texto[i + 1] === '"') {
              campo += '"'; i += 2;   // "" → una comilla literal
            } else if (texto[i] === '"') {
              i++; break;             // comilla de cierre
            } else {
              campo += texto[i++];
            }
          }
        } else {
          // Campo sin comillas: termina en coma o salto de línea
          while (i < N && texto[i] !== ',' && texto[i] !== '\n' && texto[i] !== '\r') {
            campo += texto[i++];
          }
        }

        fila.push(campo.trim());

        if (i >= N || texto[i] === '\n' || texto[i] === '\r') break; // fin de fila
        if (texto[i] === ',') i++;  // separador → siguiente campo
      }

      // Avanzar sobre \r\n o \n
      if (i < N && texto[i] === '\r') i++;
      if (i < N && texto[i] === '\n') i++;

      if (fila.some(c => c)) filas.push(fila);
    }

    return filas;
  };

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

  const quitarAcentos = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const fetchHoja = async (nombre) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nombre)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const csv = await resp.text();
      if (csv.trimStart().startsWith('<')) return null;
      const filas = parsearCSV(csv);

      // Encontrar fila de encabezado
      const headerIdx = filas.findIndex(f => f.some(c => c.toLowerCase().includes('hora')));
      if (headerIdx === -1) return null;

      // Detectar columnas por nombre — independiente del orden en la hoja
      const header = filas[headerIdx].map(c => c.toLowerCase().trim());
      const iHora     = header.findIndex(c => c.includes('hora'));
      const iCliente  = header.findIndex(c => c.includes('cliente'));
      const iMeeting  = header.findIndex(c => c.includes('meeting') || (c.includes('nombre') && !c.includes('fecha')));
      const iAsignada = header.findIndex(c => c.includes('asignad'));
      const iLink     = header.findIndex(c => c.includes('link') || c.includes('comentar'));

      // Remap cada fila a posiciones fijas que el resto del código ya espera:
      // [0]=ignorado  [1]=hora  [2]=cliente  [3]=meeting  [4]=asignada  [5]=link
      const get = (f, idx, fallback) => (idx >= 0 ? (f[idx] || '') : (f[fallback] || ''));

      const datos = filas
        .slice(headerIdx + 1)
        .filter(f => f.some(c => c))
        .map(f => [
          '',
          get(f, iHora,     1),
          get(f, iCliente,  2),
          get(f, iMeeting,  3),
          get(f, iAsignada, 4),
          get(f, iLink,     5),
        ]);

      return datos.length > 0 ? datos : null;
    } catch (e) {
      console.error('[Agenda] Error:', e.message);
      return null;
    }
  };

  const cargarAgenda = async (silencioso = false) => {
    if (!silencioso) setLoadingAgenda(true);
    const nombreHoja      = construirNombreHoja();
    const nombreSinAcento = quitarAcentos(nombreHoja);
    setAgendaFecha(nombreHoja);
    try {
      let datos = await fetchHoja(nombreHoja);
      if (!datos) datos = await fetchHoja(nombreSinAcento);
      const resultado  = datos || [];
      const nuevoHash  = JSON.stringify(resultado);
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
          if (dias <= 15) resultado.push({ tipo: 'aniversario', nombre: emp.nombre, descripcion: `${anios} año${anios !== 1 ? 's' : ''} en Cielito Home · ${texto}`, dias });
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

  // ─── Inicializar ──────────────────────────────────────────────────────────
  const inicializar = async () => {
    dormidoRef.current = false;
    const tipo = getTipoModo();
    setModoActual(tipo);

    // En carrusel o modo activo: cargar agenda y fechas
    if (tipo !== 'inactivo') {
      await Promise.all([cargarFechasImportantes(), cargarAgenda()]);
      agendaPollRef.current = setInterval(() => cargarAgenda(true), 2 * 60 * 1000);
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
      <div className="main-container">

        {/* ── PANEL IZQUIERDO: QR o Carrusel ── */}
        <div className="qr-section">

          {modo.tipo === 'carrusel' ? (
            /* ── CARRUSEL ── */
            <div className="carrusel-wrapper">
              {FOTOS_CARRUSEL.length > 0 ? (
                <>
                  <img
                    key={fotoActual}
                    src={FOTOS_CARRUSEL[fotoActual]}
                    alt={`Cielito Home ${fotoActual + 1}`}
                    className="carrusel-foto"
                  />
                  <div className="carrusel-overlay">
                    <div className="carrusel-brand">Cielito Home</div>
                  </div>
                  <div className="carrusel-dots">
                    {FOTOS_CARRUSEL.map((_, i) => (
                      <button
                        key={i}
                        className={`carrusel-dot${i === fotoActual ? ' activo' : ''}`}
                        onClick={() => setFotoActual(i)}
                        aria-label={`Foto ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Sin fotos configuradas */
                <div className="carrusel-empty">
                  <i className="bi bi-images"></i>
                  <p>Agrega fotos en</p>
                  <code>public/fotos/</code>
                  <p style={{ fontSize: '0.7rem', marginTop: '0.3rem' }}>y regístralas en FOTOS_CARRUSEL al inicio de QRGenerator.jsx</p>
                </div>
              )}
              <div className="carrusel-time">
                <span>{horaDisplay}</span>
              </div>
            </div>
          ) : (
            /* ── QR ── */
            <>
              <div className="logo-section">
                <h1 className="title">Cielito Home</h1>
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

        {/* ── PANEL DERECHO: Agenda + Fechas ── */}
        <div className="info-section">

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
                  const conTiempos = agenda.map((fila, i) => {
                    const startMin = parseHora(fila[1]);
                    const finRango = parseHoraFin(fila[1]);
                    const nextMin  = i + 1 < agenda.length ? parseHora(agenda[i + 1][1]) : -1;
                    const endMin   = finRango !== -1 ? finRango
                      : (nextMin !== -1 && nextMin > startMin) ? nextMin
                      : (startMin !== -1 ? startMin + 60 : -1);
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
      </div>
    </div>
  );
}

export default QRGenerator;
