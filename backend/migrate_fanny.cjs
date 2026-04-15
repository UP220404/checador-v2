const admin = require('firebase-admin');
const fs = require('fs');

const keyPath = 'C:/Users/lenin/Downloads/qr-acceso-cielito-home-firebase-adminsdk-fbsvc-2a66c99c24.json';
const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(key)
});

const db = admin.firestore();

const CARLOS_UID = 'aIaWeIHdPkXvY7k9RtKtNdhwwlA3';
const FANNY_UID = 'fanny_giron_legacy';
const CUTOFF_DATE = '2025-12-09';

async function migrate() {
  console.log('--- EMPEZANDO MIGRACIÓN DE DATOS ---');
  
  // 1. Crear a Fanny
  const fannyRef = db.collection('usuarios').doc(FANNY_UID);
  await fannyRef.set({
    nombre: 'Fanny Giron',
    email: 'fanny.historic@cielitohome.com',
    role: 'empleado',
    departamento: 'Ventas',
    puesto: 'Vendedora',
    activo: false,
    uid: FANNY_UID,
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    nota: 'Perfil histórico para records de Fanny Giron antes de dic 2025'
  }, { merge: true });
  console.log('✅ Perfil de Fanny Giron creado/actualizado.');

  // 2. MIGRAMOS REGISTROS (Asistencias)
  let registrosQuery = await db.collection('registros')
    .where('userId', '==', CARLOS_UID)
    .get();
    
  if (!registrosQuery.empty) {
    let batch = db.batch();
    let count = 0;
    registrosQuery.forEach(doc => {
      const data = doc.data();
      if (data.fecha && data.fecha < CUTOFF_DATE) {
        batch.update(doc.ref, { 
          userId: FANNY_UID,
          empleadoNombre: 'Fanny Giron'
        });
        count++;
      }
    });
    await batch.commit();
    console.log(`✅ Registros de asistencia migrados: ${count}`);
  } else {
    console.log('🔹 Ningun registro de asistencia encontrado antes del corte.');
  }

  // 3. MIGRAMOS AUSENCIAS
  let ausenciasQuery = await db.collection('ausencias')
    .where('userId', '==', CARLOS_UID)
    .get();
    
  let ausenciasCount = 0;
  if (!ausenciasQuery.empty) {
    let batch = db.batch();
    ausenciasQuery.forEach(doc => {
      const data = doc.data();
      if ((data.fechaInicio && data.fechaInicio < CUTOFF_DATE) || 
          (data.fechaSolicitud && data.fechaSolicitud < CUTOFF_DATE)) {
        batch.update(doc.ref, {
          userId: FANNY_UID,
          empleadoNombre: 'Fanny Giron'
        });
        ausenciasCount++;
      }
    });
    if(ausenciasCount > 0) await batch.commit();
    console.log(`✅ Ausencias migradas: ${ausenciasCount}`);
  }

  // 4. MIGRAMOS NOMINAS 
  let nominasQuery = await db.collection('nominas').where('userId', '==', CARLOS_UID).get();
  
  if (nominasQuery.empty) {
    nominasQuery = await db.collection('nominas').where('empleadoId', '==', CARLOS_UID).get();
  }

  let nominasCount = 0;
  if (!nominasQuery.empty) {
    let batch = db.batch();
    nominasQuery.forEach(doc => {
      const data = doc.data();
      const belongs = data.userId === CARLOS_UID || data.empleadoId === CARLOS_UID;
      const anio = data.periodo?.anio || parseInt(data.id?.split('-')[0]) || 2025; 
      const mes = data.periodo?.mes || parseInt(data.id?.split('-')[1]) || 12;
      
      const isBeforeDec2025 = anio < 2025 || (anio === 2025 && mes < 12);
      
      if (belongs && isBeforeDec2025) {
        let updateData = { empleadoNombre: 'Fanny Giron' };
        if (data.userId) updateData.userId = FANNY_UID;
        if (data.empleadoId) updateData.empleadoId = FANNY_UID;
        
        batch.update(doc.ref, updateData);
        nominasCount++;
      }
    });
    if(nominasCount > 0) await batch.commit();
    console.log(`✅ Nominas migradas: ${nominasCount}`);
  }

  // 5. MIGRAMOS CAMBIOS MANUALES DE NOMINA
  let cambiosQuery = await db.collection('nominas_cambios_manuales')
    .where('userId', '==', CARLOS_UID).get();
  if (cambiosQuery.empty) cambiosQuery = await db.collection('nominas_cambios_manuales').where('empleadoId', '==', CARLOS_UID).get();
  
  let cambiosCount = 0;
  if (!cambiosQuery.empty) {
    let batch = db.batch();
    cambiosQuery.forEach(doc => {
      batch.update(doc.ref, { userId: FANNY_UID }); 
      cambiosCount++;
    });
    if(cambiosCount > 0) await batch.commit();
    console.log(`✅ Cambios manuales de nómina migrados: ${cambiosCount}`);
  }

  // 6. MIGRAMOS DOCUMENTOS EMPLEADO
  let docsQuery = await db.collection('documentos_empleado')
    .where('userId', '==', CARLOS_UID).get();
    
  let docsCount = 0;
  if (!docsQuery.empty) {
    let batch = db.batch();
    docsQuery.forEach(doc => {
      const data = doc.data();
      let isBefore = false;
      if (data.fechaSubida) {
        let fechaStr = '';
        if (typeof data.fechaSubida === 'string') {
          fechaStr = data.fechaSubida;
        } else if (data.fechaSubida.toDate) {
          fechaStr = data.fechaSubida.toDate().toISOString();
        }
        if (fechaStr < CUTOFF_DATE) isBefore = true;
      }
      
      if (isBefore) {
        batch.update(doc.ref, { userId: FANNY_UID });
        docsCount++;
      }
    });
    if(docsCount > 0) await batch.commit();
    console.log(`✅ Documentos migrados: ${docsCount}`);
  }

  console.log('--- MIGRACIÓN COMPLETADA CON ÉXITO ---');
  process.exit(0);
}

migrate().catch(err => {
    console.error('Error migrando datos:', err);
    process.exit(1);
});
