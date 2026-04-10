/**
 * Script de migración: Usuarios -> Empleados (Legacy)
 * CommonJS version (.cjs) 
 * NO USAR IMPORT EN ESTE ARCHIVO
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrate() {
  console.log('🚀 Iniciando sincronización a colección legacy "empleados"...');
  
  try {
    const usuariosSnapshot = await db.collection('usuarios').get();
    console.log(`📊 Encontrados ${usuariosSnapshot.size} usuarios.`);

    const batch = db.batch();
    let count = 0;

    usuariosSnapshot.forEach(doc =\u003e {
      const data = doc.data();
      const uid = doc.id;
      
      const legacyDoc = {
        nombre: data.nombre || '',
        correo: data.correo || '',
        tipo: data.tipo || 'tiempo_completo',
        activo: data.activo !== false,
        departamento: data.departamento || '',
        puesto: data.puesto || '',
        fechaSincronizacion: admin.firestore.Timestamp.now()
      };

      if (data.salarioBase) legacyDoc.salarioBase = data.salarioBase;
      if (data.salarioQuincenal) legacyDoc.salarioQuincenal = data.salarioQuincenal;

      const legacyRef = db.collection('empleados').doc(uid);
      batch.set(legacyRef, legacyDoc, { merge: true });
      count++;
    });

    if (count \u003e 0) {
      await batch.commit();
      console.log(`✅ Sincronización completada: ${count} documentos actualizados en /empleados/`);
    } else {
      console.log('ℹ️ No hay usuarios para sincronizar.');
    }

  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
