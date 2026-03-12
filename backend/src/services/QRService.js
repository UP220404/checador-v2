/**
 * Servicio para gestión de QR Tokens
 */

import { getFirestore } from '../config/firebase.js';
import { randomBytes } from 'crypto';
import { COLLECTIONS, CONFIG } from '../config/constants.js';

class QRService {
  constructor() {
    this.qrCollection = COLLECTIONS.QR_TOKENS;
    this.statsCollection = COLLECTIONS.QR_STATS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Obtiene el token QR actual
   */
  async getCurrentToken() {
    try {
      const tokenDoc = await this.db.collection(this.qrCollection).doc('current').get();

      if (!tokenDoc.exists) {
        return null;
      }

      return {
        id: tokenDoc.id,
        ...tokenDoc.data(),
        expiracion: tokenDoc.data().expiracion?.toDate()
      };
    } catch (error) {
      console.error('Error obteniendo token QR actual:', error);
      throw error;
    }
  }

  /**
   * Valida un token QR
   * @param {string} qrCode - Código QR base (ej: 'OFICINA2025')
   * @param {string} token - Token único
   * @param {string} userEmail - Email del usuario (para modo pruebas)
   * @returns {Object} { valido: boolean, mensaje: string, tokenData: Object }
   */
  async validateToken(qrCode, token, userEmail = null) {
    try {
      // 1. Validar QR base
      if (qrCode !== CONFIG.QR_CODE_PREFIX) {
        await this.incrementStat('bloqueados');
        return {
          valido: false,
          mensaje: '❌ Código QR inválido'
        };
      }

      // 2. Si no hay token, es QR estático anterior (compatibilidad)
      if (!token) {
        return await this.validateStaticQR();
      }

      // 3. Validar token dinámico
      const tokenDoc = await this.db.collection(this.qrCollection).doc('current').get();

      if (!tokenDoc.exists) {
        await this.incrementStat('bloqueados');
        return {
          valido: false,
          mensaje: '❌ Token no encontrado. Solicita un nuevo QR.'
        };
      }

      const tokenData = tokenDoc.data();
      const ahora = new Date();
      const expiracion = tokenData.expiracion?.toDate();

      // 4. Verificar que el token coincida
      if (tokenData.token !== token) {
        await this.incrementStat('bloqueados');
        return {
          valido: false,
          mensaje: '❌ Token inválido. Escanea el QR más reciente.'
        };
      }

      // 5. Verificar expiración
      if (ahora > expiracion) {
        await this.incrementStat('bloqueados');
        return {
          valido: false,
          mensaje: '⏰ QR expirado. Solicita un nuevo código.'
        };
      }

      // 6. Verificar modo y uso
      const modoToken = tokenData.modo || 'dinamico';
      const esUsuarioPruebas = userEmail && CONFIG.USUARIOS_MODO_PRUEBAS?.includes(userEmail);

      if (modoToken === 'dinamico') {
        // Modo dinámico: solo un uso (excepto usuarios en pruebas)
        if (tokenData.usado && !esUsuarioPruebas) {
          await this.incrementStat('bloqueados');
          return {
            valido: false,
            mensaje: '🚫 QR ya utilizado. Cada QR solo puede usarse una vez.'
          };
        }

        // Marcar como usado si no es modo pruebas
        if (!esUsuarioPruebas) {
          await this.db.collection(this.qrCollection).doc('current').update({
            usado: true,
            fechaUso: new Date(),
            ultimoUsuario: userEmail || 'desconocido'
          });
        }
      } else if (modoToken === 'estatico') {
        // Modo estático: múltiples usos permitidos
        await this.db.collection(this.qrCollection).doc('current').update({
          ultimoAcceso: new Date(),
          ultimoUsuario: userEmail || 'desconocido',
          contadorUsos: admin.firestore.FieldValue.increment(1)
        });
      }

      await this.incrementStat('exitosos');

      return {
        valido: true,
        mensaje: '✅ QR válido',
        tokenData: {
          modo: modoToken,
          expiracion: expiracion
        }
      };

    } catch (error) {
      console.error('Error validando token QR:', error);
      throw error;
    }
  }

  /**
   * QR estático legacy — deshabilitado por seguridad.
   * Registros sin token dinámico válido son rechazados.
   */
  async validateStaticQR() {
    await this.incrementStat('bloqueados');
    return {
      valido: false,
      mensaje: '❌ Se requiere escanear el QR dinámico actualizado'
    };
  }

  /**
   * Genera un nuevo token QR
   * @param {string} modo - 'dinamico' o 'estatico'
   * @param {number} duracionMinutos - Duración en minutos
   * @returns {Object} Token generado
   */
  async generateToken(modo = 'dinamico', duracionMinutos = 5) {
    try {
      const ahora = new Date();
      const expiracion = new Date(ahora.getTime() + duracionMinutos * 60000);

      // Generar token único
      const token = this.generateUniqueToken();

      const tokenData = {
        token: token,
        qrCode: CONFIG.QR_CODE_PREFIX,
        modo: modo,
        expiracion: expiracion,
        fechaCreacion: ahora,
        usado: false,
        contadorUsos: 0
      };

      // Guardar en Firestore
      await this.db.collection(this.qrCollection).doc('current').set(tokenData);
      await this.incrementStat('generados');

      return {
        success: true,
        token: token,
        qrCode: CONFIG.QR_CODE_PREFIX,
        fullUrl: `?qr=${CONFIG.QR_CODE_PREFIX}&token=${token}`,
        expiracion: expiracion,
        modo: modo
      };

    } catch (error) {
      console.error('Error generando token:', error);
      throw error;
    }
  }

  /**
   * Genera un token único criptográficamente seguro
   */
  generateUniqueToken() {
    return randomBytes(32).toString('hex');
  }

  /**
   * Incrementa estadísticas de QR
   */
  async incrementStat(tipo) {
    const hoy = new Date().toISOString().split('T')[0];
    const statsRef = this.db.collection(this.statsCollection).doc(hoy);

    try {
      await statsRef.update({
        [tipo]: admin.firestore.FieldValue.increment(1),
        ultimaActualizacion: new Date()
      });
    } catch (error) {
      if (error.code === 'not-found') {
        // Crear documento si no existe
        const newData = {
          generados: 0,
          exitosos: 0,
          bloqueados: 0,
          fecha: hoy,
          ultimaActualizacion: new Date()
        };
        newData[tipo] = 1;
        await statsRef.set(newData);
      } else {
        console.error('Error incrementando estadística:', error);
      }
    }
  }

  /**
   * Obtiene estadísticas de QR
   */
  async getStats(fecha = null) {
    try {
      const fechaQuery = fecha || new Date().toISOString().split('T')[0];
      const statsDoc = await this.db.collection(this.statsCollection).doc(fechaQuery).get();

      if (!statsDoc.exists) {
        return {
          generados: 0,
          exitosos: 0,
          bloqueados: 0,
          fecha: fechaQuery
        };
      }

      return {
        ...statsDoc.data(),
        fecha: fechaQuery
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}

export default new QRService();
