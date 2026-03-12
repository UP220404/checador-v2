/**
 * Sistema de Cache para reducir llamadas a la API
 */

const CACHE_PREFIX = 'checador_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos por defecto

// TTLs específicos por tipo de dato
const CACHE_TTL = {
  users: 10 * 60 * 1000,        // 10 minutos - usuarios no cambian frecuentemente
  holidays: 24 * 60 * 60 * 1000, // 24 horas - festivos casi nunca cambian
  settings: 30 * 60 * 1000,      // 30 minutos
  departments: 60 * 60 * 1000,   // 1 hora
  todayAttendance: 2 * 60 * 1000, // 2 minutos - datos del día más frescos
  documents: 5 * 60 * 1000,      // 5 minutos
};

/**
 * Guarda datos en cache con timestamp
 */
export function setCache(key, data, customTTL = null) {
  try {
    const ttl = customTTL || CACHE_TTL[key] || DEFAULT_TTL;
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl
    };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Error guardando en cache:', e);
  }
}

/**
 * Obtiene datos del cache si no han expirado
 */
export function getCache(key) {
  try {
    const cached = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const { data, timestamp, ttl } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > ttl;

    if (isExpired) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data;
  } catch (e) {
    console.warn('Error leyendo cache:', e);
    return null;
  }
}

/**
 * Invalida un cache específico
 */
export function invalidateCache(key) {
  sessionStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Invalida todos los caches
 */
export function clearAllCache() {
  Object.keys(sessionStorage)
    .filter(k => k.startsWith(CACHE_PREFIX))
    .forEach(k => sessionStorage.removeItem(k));
}

/**
 * Verifica si hay datos en cache válidos
 */
export function hasValidCache(key) {
  return getCache(key) !== null;
}

/**
 * Helper para hacer fetch con cache
 */
export async function fetchWithCache(key, fetchFn, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCache(key);
    if (cached) {
      return cached;
    }
  }

  const data = await fetchFn();
  setCache(key, data);
  return data;
}

export default {
  setCache,
  getCache,
  invalidateCache,
  clearAllCache,
  hasValidCache,
  fetchWithCache
};
