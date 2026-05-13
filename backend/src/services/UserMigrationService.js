/**
 * UserMigrationService — Migración automática de identidad de usuario.
 *
 * Estrategia (simplificada vs. versión anterior):
 *   Al cambiar el email, este servicio SOLO actualiza el campo email en Firestore
 *   y deshabilita la cuenta vieja de Auth. NO crea usuarios en Firebase Auth
 *   artificialmente (eso generaba UIDs que nunca coincidían con Google OAuth).
 *
 *   La corrección del UID ocurre de forma "lazy" la primera vez que el empleado
 *   inicia sesión con su nueva cuenta de Google, a través del mecanismo
 *   autoFixUidMismatch en UserController.getCurrentUserRole.
 */

import { getAuth, getFirestore } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';

/**
 * Colecciones secundarias y el campo que contiene el UID del empleado.
 * Si el campo tiene valor null, la colección usa el UID como ID de documento.
 */
const COLECCIONES_A_MIGRAR = [
  { nombre: COLLECTIONS.REGISTROS,            campo: 'uid' },
  { nombre: COLLECTIONS.AUSENCIAS,            campo: 'uid' },
  { nombre: COLLECTIONS.NOTIFICACIONES,       campo: 'uid' },
  { nombre: COLLECTIONS.DOCUMENTOS_EMPLEADO,  campo: 'uid' },
  { nombre: COLLECTIONS.EVALUACIONES_CONTRATO, campo: 'empleadoUid' },
  { nombre: COLLECTIONS.EVALUACIONES,         campo: 'empleadoUid' },
  { nombre: COLLECTIONS.CONFIG_NOMINA,        campo: null }, // documento ID = UID
];

class UserMigrationService {

  get db() { return getFirestore(); }
  get auth() { return getAuth(); }

  /**
   * Cuando un admin cambia el email de un empleado:
   *   1. Actualiza SOLO el campo email en Firestore (el documento mantiene su UID actual).
   *   2. Intenta deshabilitar la cuenta vieja de Auth (best-effort).
   *
   * El UID se corregirá automáticamente la próxima vez que el empleado
   * inicie sesión con su nueva cuenta de Google (lazy fix en getCurrentUserRole).
   *
   * @param {string} oldUID   - UID actual del documento en Firestore.
   * @param {string} newEmail - Nuevo correo institucional.
   * @returns {string}        - El mismo oldUID (el doc no se mueve todavía).
   */
  async migrateUserIdentity(oldUID, newEmail) {
    console.log(`📧 [Migración] Actualizando email. UID=${oldUID} → newEmail=${newEmail}`);

    const userRef = this.db.collection(COLLECTIONS.USUARIOS).doc(oldUID);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Usuario ${oldUID} no encontrado en Firestore.`);
    }

    // Solo actualizar el campo email — no mover el documento ni crear Auth users
    await userRef.update({
      email: newEmail,
      fechaActualizacion: new Date(),
      _emailActualizadoEn: new Date()
    });
    console.log(`✅ [Migración] Email actualizado en Firestore para UID ${oldUID}`);

    // Intentar deshabilitar la cuenta de Auth anterior (best-effort)
    await this._disableOldAccount(oldUID);

    console.log(`🏁 [Migración] Lista. El UID se corregirá automáticamente en el próximo login.`);

    // Retornamos el mismo UID porque el documento no se movió
    return oldUID;
  }

  /**
   * Mueve el documento de Firestore y TODAS las colecciones secundarias
   * de oldUID a newUID. Llamado por el mecanismo de auto-corrección en login
   * (UserController.getCurrentUserRole) cuando detecta un UID desfasado.
   *
   * @param {string} oldUID
   * @param {string} newUID
   * @param {string} newEmail
   */
  async migrateAllData(oldUID, newUID, newEmail) {
    console.log(`🔄 [Auto-fix] Moviendo datos de Firestore. ${oldUID} → ${newUID}`);

    // 1. Copiar documento principal al nuevo UID
    const oldDoc = await this.db.collection(COLLECTIONS.USUARIOS).doc(oldUID).get();
    if (!oldDoc.exists) {
      throw new Error(`[Auto-fix] Documento ${oldUID} no encontrado en Firestore.`);
    }

    const data = oldDoc.data();
    await this.db.collection(COLLECTIONS.USUARIOS).doc(newUID).set({
      ...data,
      uid: newUID,
      email: newEmail,
      fechaActualizacion: new Date(),
      _migradoDe: oldUID,
      _migradoEn: new Date()
    });
    console.log(`✅ [Auto-fix] Documento principal copiado: ${oldUID} → ${newUID}`);

    // 2. Migrar colecciones secundarias en paralelo
    const resultados = await Promise.allSettled(
      COLECCIONES_A_MIGRAR.map(col => this._migrateCollection(col, oldUID, newUID))
    );

    resultados.forEach((result, i) => {
      const col = COLECCIONES_A_MIGRAR[i];
      if (result.status === 'rejected') {
        console.error(`⚠️  [Auto-fix] Fallo en colección ${col.nombre}:`, result.reason?.message);
      } else if (result.value > 0) {
        console.log(`✅ [Auto-fix] ${col.nombre}: ${result.value} doc(s) migrados`);
      }
    });

    // 3. Eliminar documento viejo
    await this.db.collection(COLLECTIONS.USUARIOS).doc(oldUID).delete();
    console.log(`✅ [Auto-fix] Documento viejo eliminado: ${oldUID}`);

    console.log(`🏁 [Auto-fix] Completado. ${oldUID} → ${newUID}`);
  }

  /**
   * Migra los documentos de una colección secundaria de oldUID a newUID.
   * @private
   */
  async _migrateCollection({ nombre, campo }, oldUID, newUID) {
    const db = this.db;

    // Caso especial: colección donde el UID ES el ID del documento (ej. config_nomina)
    if (campo === null) {
      const oldDoc = await db.collection(nombre).doc(oldUID).get();
      if (!oldDoc.exists) return 0;

      await db.collection(nombre).doc(newUID).set({ ...oldDoc.data(), uid: newUID });
      await db.collection(nombre).doc(oldUID).delete();
      return 1;
    }

    // Caso general: buscar por campo y actualizar en batch
    const snapshot = await db.collection(nombre).where(campo, '==', oldUID).get();
    if (snapshot.empty) return 0;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { [campo]: newUID }));
    await batch.commit();

    return snapshot.size;
  }

  /**
   * Deshabilita la cuenta vieja en Firebase Auth y revoca sus tokens.
   * No es crítico — si falla, el proceso de migración continúa.
   * @private
   */
  async _disableOldAccount(oldUID) {
    try {
      await this.auth.updateUser(oldUID, { disabled: true });
      await this.auth.revokeRefreshTokens(oldUID);
      console.log(`🔒 [Migración] Cuenta vieja deshabilitada: ${oldUID}`);
    } catch (error) {
      console.warn(`⚠️  [Migración] No se pudo deshabilitar cuenta vieja ${oldUID}:`, error.message);
    }
  }
}

export default new UserMigrationService();
