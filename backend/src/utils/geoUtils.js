/**
 * Utilidades de geolocalización
 */

import { CONFIG } from '../config/constants.js';

/**
 * Calcula la distancia entre dos coordenadas usando la fórmula de Haversine
 * @param {number} lat1 - Latitud punto 1
 * @param {number} lng1 - Longitud punto 1
 * @param {number} lat2 - Latitud punto 2
 * @param {number} lng2 - Longitud punto 2
 * @returns {number} Distancia en metros
 */
export function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distancia en metros
}

/**
 * Verifica si unas coordenadas están dentro del rango de la oficina
 * @param {Object} coords - { lat, lng }
 * @returns {Object} { dentroDeRango: boolean, distancia: number }
 */
export function verificarUbicacionOficina(coords) {
  if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) {
    console.error('❌ ERROR: Coordenadas de oficina no configuradas en el servidor (OFFICE_LAT/OFFICE_LNG)');
    return {
      dentroDeRango: false,
      distancia: null,
      error: 'Configuración de servidor incompleta'
    };
  }

  if (!coords.lat || !coords.lng) {
    return {
      dentroDeRango: false,
      distancia: null,
      error: 'Coordenadas inválidas'
    };
  }

  const distancia = calcularDistanciaMetros(
    coords.lat,
    coords.lng,
    CONFIG.OFICINA.lat,
    CONFIG.OFICINA.lng
  );

  console.log(`📍 Validación de ubicación: Distancia a oficina = ${Math.round(distancia)}m (Límite: ${CONFIG.OFICINA.radio_metros}m)`);

  return {
    dentroDeRango: distancia <= CONFIG.OFICINA.radio_metros,
    distancia: Math.round(distancia),
    limiteMetros: CONFIG.OFICINA.radio_metros
  };
}

/**
 * Formatea coordenadas para mostrar
 */
export function formatearCoordenadas(coords) {
  if (!coords) return 'Sin ubicación';

  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}

export default {
  calcularDistanciaMetros,
  verificarUbicacionOficina,
  formatearCoordenadas
};
