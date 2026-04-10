/**
 * Script de migración: Vincular registros a IDs de usuario (UID)
 *
 * Este script recorre las colecciones que dependen de correos electrónicos
 * y les añade el campo 'userId' (UID de Firebase) para permitir cambios
 * de correo sin perder historial.
 */

import { initializeFirebase, getFirestore } from '../config/firebase.js';
import dotenv from 'dotenv';
import admin from 'firebase-admin'; // Para FieldValue

// Cargar variables de entorno
dotenv.config();

// Inicializar Firebase usando la configuración del proyecto
initializeFirebase();
const db = getFirestore();

async function migrate() {
  console.log('🚀 Iniciando migración a UID...');

  // 1. Obtener todos los usuarios para crear un mapa email -> uid
  console.log('📥 Obteniendo mapa de usuarios...');
  const usuariosSnapshot = await db.collection('usuarios').get();
  const emailToUid = {};
  const uidToEmail = {};

  usuariosSnapshot.forEach(doc => {
    const data = doc.data();
    const email = (data.correo || data.email || '').toLowerCase().trim();
    if (email) {
      emailToUid[email] = doc.id;
      uidToEmail[doc.id] = email;
    }
  });

  console.log(`✅ Mapa de usuarios cargado: ${Object.keys(emailToUid).length} usuarios hallados.`);

  // 2. Procesar AUSENCIAS
  await migrateCollection('ausencias', 'userId', 'emailUsuario', emailToUid);

  // 3. Procesar REGISTROS
  await migrateCollection('registros', 'uid', 'email', emailToUid);

  // 4. Procesar NOTIFICACIONES
  await migrateCollection('notificaciones', 'uid', 'emailUsuario', emailToUid);

  // 5. Procesar DOCUMENTOS
  await migrateCollection('documentos_empleado', 'uid', 'emailUsuario', emailToUid);

  console.log('\n✨ Migración completada con éxito.');
}

async function migrateCollection(collectionName, idField, emailField, emailToUid) {
  console.log(`🔄 Procesando colección: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  const batchSize = 500;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    if (data[idField]) {
      skipped++;
      continue;
    }

    const email = (data[emailField] || data.correo || '').toLowerCase().trim();
    const uid = emailToUid[email];

    if (uid) {
      batch.update(doc.ref, { 
        [idField]: uid,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updated++;
      count++;
    } else {
      unmatched++;
    }

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
      console.log(`... ${updated} documentos de ${collectionName} migrados...`);
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`🏁 Resultados de ${collectionName.toUpperCase()}:`);
  console.log(`   - Actualizados: ${updated}`);
  console.log(`   - Saltados: ${skipped}`);
  console.log(`   - Sin coincidencia: ${unmatched}`);
}

migrate().catch(err => {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
});
