/**
 * SYNC EMPLOYEES FINAL
 * Unique filename to avoid any OneDrive/Node cache issues.
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
  console.log('🚀 SYNC START...');
  try {
    const usuariosSnapshot = await db.collection('usuarios').get();
    console.log(`📊 Users: ${usuariosSnapshot.size}`);

    const batch = db.batch();
    let count = 0;

    usuariosSnapshot.forEach(doc =\u003e {
      const data = doc.data();
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

      batch.set(db.collection('empleados').doc(doc.id), legacyDoc, { merge: true });
      count++;
    });

    if (count \u003e 0) {
      await batch.commit();
      console.log(`✅ SUCCESS: ${count} users synced.`);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    process.exit(0);
  }
}
migrate();
