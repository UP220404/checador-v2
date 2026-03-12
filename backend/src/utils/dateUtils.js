/**
 * Utilidades para manejo de fechas
 * CONSOLIDACIÓN: Este archivo reemplaza todas las funciones de fecha duplicadas
 */

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (zona horaria México)
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte Date a string YYYY-MM-DD
 */
export function dateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte string YYYY-MM-DD a Date
 */
export function stringToDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Obtiene la hora en formato HH:MM:SS (24 horas)
 */
export function getTimeString(date = new Date()) {
  return date.toLocaleTimeString('es-MX', {
    hour12: false,
    timeZone: 'America/Mexico_City'
  });
}

/**
 * Evalúa si una hora es puntual o retardo
 */
export function evaluarPuntualidad(date, limiteHora = 8, limiteMinutos = 10) {
  const hora = date.getHours();
  const minutos = date.getMinutes();

  const minutosActuales = (hora * 60) + minutos;
  const minutosLimite = (limiteHora * 60) + limiteMinutos;

  return minutosActuales <= minutosLimite ? 'puntual' : 'retardo';
}

/**
 * Obtiene el día de la semana (0 = Domingo, 6 = Sábado)
 */
export function getDayOfWeek(date = new Date()) {
  return date.getDay();
}

/**
 * Verifica si es fin de semana
 */
export function isWeekend(date = new Date()) {
  const day = getDayOfWeek(date);
  return day === 0 || day === 6; // Domingo o Sábado
}

/**
 * Obtiene el inicio de la semana (Lunes)
 */
export function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar si es Domingo
  return new Date(d.setDate(diff));
}

/**
 * Calcula días laborables entre dos fechas (excluyendo fines de semana)
 */
export function calcularDiasLaborables(fechaInicio, fechaFin, festivos = []) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  let diasLaborables = 0;

  const festivosSet = new Set(festivos.map(f => dateToString(new Date(f))));

  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dateStr = dateToString(d);

    // No contar fines de semana ni festivos
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !festivosSet.has(dateStr)) {
      diasLaborables++;
    }
  }

  return diasLaborables;
}

/**
 * Determina la quincena de una fecha
 * @returns {Object} { periodo: 'primera' | 'segunda', mes: number, anio: number }
 */
export function obtenerQuincena(date = new Date()) {
  const dia = date.getDate();
  const mes = date.getMonth() + 1; // 1-12
  const anio = date.getFullYear();

  const periodo = dia <= 15 ? 'primera' : 'segunda';

  return { periodo, mes, anio };
}

/**
 * Obtiene fechas de inicio y fin de una quincena
 */
export function getFechasQuincena(mes, anio, periodo) {
  const mesIndex = mes - 1; // 0-11 para Date

  if (periodo === 'primera') {
    const inicio = new Date(anio, mesIndex, 1);
    const fin = new Date(anio, mesIndex, 15);
    return { inicio, fin };
  } else {
    const inicio = new Date(anio, mesIndex, 16);
    const fin = new Date(anio, mesIndex + 1, 0); // Último día del mes
    return { inicio, fin };
  }
}

/**
 * Calcula fechas de una semana laboral (Lunes a Viernes)
 */
export function getFechasSemanaLaboral(fecha = new Date()) {
  const inicio = getStartOfWeek(fecha); // Lunes
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 4); // Viernes

  return { inicio, fin };
}

/**
 * Formatea fecha a español legible
 */
export function formatoFechaLegible(date) {
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Valida si una fecha está dentro de un rango
 */
export function estaEnRango(fecha, inicio, fin) {
  const f = new Date(fecha);
  const i = new Date(inicio);
  const e = new Date(fin);

  return f >= i && f <= e;
}

/**
 * Obtiene timestamp de servidor (para Firestore)
 */
export function getServerTimestamp() {
  return new Date();
}

export default {
  getTodayString,
  dateToString,
  stringToDate,
  getTimeString,
  evaluarPuntualidad,
  getDayOfWeek,
  isWeekend,
  getStartOfWeek,
  calcularDiasLaborables,
  obtenerQuincena,
  getFechasQuincena,
  getFechasSemanaLaboral,
  formatoFechaLegible,
  estaEnRango,
  getServerTimestamp
};
