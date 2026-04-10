import admin from 'firebase-admin';
import { initializeFirebase, getFirestore } from '../config/firebase.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

initializeFirebase();
const db = getFirestore();

async function migrateCorreoToEmail() {
  console.log('🚀 Iniciando migración de correo a email...');

  // 1. Usuarios
  const usuariosSnapshot = await db.collection('usuarios').get();
  let usuariosActualizados = 0;

  for (const doc of usuariosSnapshot.docs) {
    const data = doc.data();
    if (data.correo) {
      const emailValue = data.correo;
      
      const updatePayload = {
        email: emailValue
      };
      
      // Update the document to include email, and remove correo using FieldValue.delete()
      await doc.ref.update({
        email: emailValue,
        correo: admin.firestore.FieldValue.delete()
      });
      
      usuariosActualizados++;
    } else if (!data.email && !data.correo) {
       console.log(`Usuario ${doc.id} no tiene ni correo ni email.`);
    }
  }
  console.log(`✅ Usuarios actualizados: ${usuariosActualizados}/${usuariosSnapshot.size}`);

  console.log('✨ Migración de campos completada con éxito.');
  process.exit(0);
}

migrateCorreoToEmail().catch(err => {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
});
