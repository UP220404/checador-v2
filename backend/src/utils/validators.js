/**
 * Validadores de datos
 */

/**
 * Valida email
 */
export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida UID de Firebase
 */
export function validarUID(uid) {
  return typeof uid === 'string' && uid.length > 0;
}

/**
 * Valida coordenadas de geolocalización
 */
export function validarCoordenadas(coords) {
  if (!coords || typeof coords !== 'object') return false;

  const { lat, lng } = coords;

  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  return true;
}

/**
 * Valida que una fecha esté en formato YYYY-MM-DD
 */
export function validarFormatoFecha(fechaString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fechaString)) return false;

  const [year, month, day] = fechaString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
}

/**
 * Valida tipo de usuario
 */
export function validarTipoUsuario(tipo) {
  const tiposValidos = ['becario', 'tiempo_completo', 'especial', 'horario_especial'];
  return tiposValidos.includes(tipo);
}

/**
 * Valida tipo de ausencia
 */
export function validarTipoAusencia(tipo) {
  const tiposValidos = [
    'permiso',
    'vacaciones',
    'incapacidad',
    'viaje_negocios',
    'retardo_justificado',
    'justificante'
  ];
  return tiposValidos.includes(tipo);
}

/**
 * Valida estado de ausencia
 */
export function validarEstadoAusencia(estado) {
  const estadosValidos = ['pendiente', 'aprobada', 'rechazada'];
  return estadosValidos.includes(estado);
}

/**
 * Valida período de nómina
 */
export function validarPeriodoNomina(mes, anio, periodo) {
  if (typeof mes !== 'number' || mes < 1 || mes > 12) return false;
  if (typeof anio !== 'number' || anio < 2020 || anio > 2100) return false;
  if (periodo !== 'primera' && periodo !== 'segunda') return false;

  return true;
}

/**
 * Valida tipo de nómina
 */
export function validarTipoNomina(tipo) {
  return tipo === 'quincenal' || tipo === 'semanal';
}

/**
 * Sanitiza texto para prevenir inyecciones
 */
export function sanitizarTexto(texto) {
  if (typeof texto !== 'string') return '';

  return texto
    .trim()
    .replace(/[<>]/g, '') // Remover tags
    .substring(0, 500); // Limitar longitud
}

/**
 * Valida salario (número positivo)
 */
export function validarSalario(salario) {
  return typeof salario === 'number' && salario > 0 && salario < 1000000;
}

/**
 * Valida número de retardos
 */
export function validarRetardos(retardos) {
  return Number.isInteger(retardos) && retardos >= 0 && retardos <= 100;
}

export default {
  validarEmail,
  validarUID,
  validarCoordenadas,
  validarFormatoFecha,
  validarTipoUsuario,
  validarTipoAusencia,
  validarEstadoAusencia,
  validarPeriodoNomina,
  validarTipoNomina,
  sanitizarTexto,
  validarSalario,
  validarRetardos
};
