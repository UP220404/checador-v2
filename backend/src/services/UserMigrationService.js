/**
 * UserMigrationService — Migración automática de identidad de usuario.
 *
 * Cuando un admin cambia el email de un empleado desde el panel de RH,
 * este servicio:
 *   1. Crea un nuevo usuario en Firebase Auth con el nuevo email.
 *   2. Migra el documento principal del usuario en Firestore (usuarios/{oldUID} → usuarios/{newUID}).
 *   3. Actualiza todas las colecciones secundarias que referencian el oldUID.
 *   4. Deshabilita la cuenta vieja en Firebase Auth y revoca sus tokens.
 *   5. Elimina el documento viejo de Firestore.
 *
 * El empleado NO necesita hacer nada especial. La próxima vez que entre
 * con su nueva cuenta de Google, Firebase la vincula al nuevo UID automáticamente.
 */

import admin from 'firebase-admin';
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
   * Punto de entrada principal.
   * @param {string} oldUID - UID actual del empleado (cuenta vieja de Google).
   * @param {string} newEmail - Nuevo correo institucional.
   * @returns {string} newUID - El nuevo UID generado en Firebase Auth.
   */
  async migrateUserIdentity(oldUID, newEmail) {
    console.log(`🔄 [Migración] Iniciando migración de UID. oldUID=${oldUID} → newEmail=${newEmail}`);

    // 1. Crear nuevo usuario en Firebase Auth
    const newUID = await this._createNewAuthUser(newEmail);
    console.log(`✅ [Migración] Nuevo UID creado: ${newUID}`);

    try {
      // 2. Migrar documento principal del usuario
      await this._migrateUserDocument(oldUID, newUID, newEmail);

      // 3. Migrar colecciones secundarias en paralelo
      await this._migrateAllCollections(oldUID, newUID);

      // 4. Deshabilitar cuenta vieja y revocar tokens
      await this._disableOldAccount(oldUID);

      // 5. Eliminar documento viejo de Firestore
      await this.db.collection(COLLECTIONS.USUARIOS).doc(oldUID).delete();

      console.log(`🏁 [Migración] Completada. oldUID=${oldUID} → newUID=${newUID}`);
      return newUID;

    } catch (error) {
      // Si algo falla después de crear el nuevo usuario en Auth,
      // intentamos limpiar para no dejar cuentas huérfanas.
      console.error(`❌ [Migración] Error durante la migración de ${oldUID}:`, error);
      try {
        await this.auth.deleteUser(newUID);
        console.warn(`⚠️  [Migración] Nuevo usuario Auth (${newUID}) eliminado por rollback.`);
      } catch (cleanupErr) {
        console.error('❌ [Migración] No se pudo limpiar el nuevo Auth user:', cleanupErr);
      }
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario en Firebase Auth con el nuevo email.
   * Al tener el mismo email que la cuenta de Google Workspace,
   * Firebase lo vinculará automáticamente cuando el usuario inicie sesión.
   */
  async _createNewAuthUser(newEmail) {
    // Verificar si ya existe un usuario con ese email (ej. si el admin lo intenta dos veces)
    try {
      const existing = await this.auth.getUserByEmail(newEmail);
      if (existing) {
        console.warn(`⚠️  [Migración] Ya existe un usuario Auth con ${newEmail}. UID: ${existing.uid}`);
        return existing.uid;
      }
    } catch (e) {
      // auth/user-not-found es el caso esperado → seguimos adelante
    }

    const newUser = await this.auth.createUser({
      email: newEmail,
      emailVerified: true,
    });
    return newUser.uid;
  }

  /**
   * Copia el documento del usuario del UID viejo al nuevo, actualizando el email.
   */
  async _migrateUserDocument(oldUID, newUID, newEmail) {
    const oldDoc = await this.db.collection(COLLECTIONS.USUARIOS).doc(oldUID).get();
    if (!oldDoc.exists) {
      throw new Error(`Usuario ${oldUID} no encontrado en Firestore.`);
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

    console.log(`✅ [Migración] Documento de usuario copiado: ${oldUID} → ${newUID}`);
  }

  /**
   * Migra todas las colecciones secundarias.
   */
  async _migrateAllCollections(oldUID, newUID) {
    const resultados = await Promise.allSettled(
      COLECCIONES_A_MIGRAR.map(col => this._migrateCollection(col, oldUID, newUID))
    );

    resultados.forEach((result, i) => {
      const col = COLECCIONES_A_MIGRAR[i];
      if (result.status === 'rejected') {
        console.error(`❌ [Migración] Fallo en colección ${col.nombre}:`, result.reason);
      } else {
        console.log(`✅ [Migración] ${col.nombre}: ${result.value} doc(s) migrados`);
      }
    });
  }

  /**
   * Migra los documentos de una colección secundaria.
   * Si `campo` es null, el UID es el ID del documento (se copia y borra).
   * Si `campo` es un string, es un whereEqual query sobre ese campo.
   */
  async _migrateCollection({ nombre, campo }, oldUID, newUID) {
    const db = this.db;

    // Caso especial: colección donde el UID ES el ID del documento (ej. config_nomina)
    if (campo === null) {
      const oldDoc = await db.collection(nombre).doc(oldUID).get();
      if (!oldDoc.exists) return 0;

      const data = oldDoc.data();
      await db.collection(nombre).doc(newUID).set({ ...data, uid: newUID });
      await db.collection(nombre).doc(oldUID).delete();
      return 1;
    }

    // Caso general: buscar por campo y actualizar
    const snapshot = await db.collection(nombre).where(campo, '==', oldUID).get();
    if (snapshot.empty) return 0;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { [campo]: newUID });
    });
    await batch.commit();

    return snapshot.size;
  }

  /**
   * Deshabilita la cuenta vieja en Firebase Auth y revoca sus tokens.
   */
  async _disableOldAccount(oldUID) {
    try {
      await this.auth.updateUser(oldUID, { disabled: true });
      await this.auth.revokeRefreshTokens(oldUID);
      console.log(`🔒 [Migración] Cuenta vieja deshabilitada y tokens revocados: ${oldUID}`);
    } catch (error) {
      // No crítico — si falla, la cuenta simplemente no se deshabilita pero los datos ya migraron
      console.error(`⚠️  [Migración] No se pudo deshabilitar cuenta vieja ${oldUID}:`, error.message);
    }
  }
}

export default new UserMigrationService();
