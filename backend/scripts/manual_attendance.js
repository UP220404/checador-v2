/**
 * HERRAMIENTA DE ADMINISTRACIÓN - SOLO USO LOCAL
 * Inyección manual de registros de asistencia
 * 
 * Uso: node scripts/manual_attendance.js <email> <fecha> <hora_entrada> [hora_salida]
 * Ejemplo: node scripts/manual_attendance.js luther@cielito.com 2026-03-27 08:30:00 16:00:00
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const serviceAccountPath = join(__dirname, '../firebase-service-account.json');

// Inicializar Firebase
async function init() {
  try {
    let credential;
    if (process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      });
    } else {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
    }

    admin.initializeApp({ credential });
    return admin.firestore();
  } catch (err) {
    console.error('❌ Error inicializando Firebase:', err.message);
    process.exit(1);
  }
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('\n🚀 Herramienta de Inyección de Asistencia (Backdoor Local)');
    console.log('Uso: node scripts/manual_attendance.js <email> <fecha> <hora_entrada> [hora_salida]');
    console.log('Ejemplo: node scripts/manual_attendance.js sistemas16ch@gmail.com 2026-03-27 08:30:00 16:05:00\n');
    process.exit(0);
  }

  const [email, fecha, horaEntrada, horaSalida] = args;
  const db = await init();

  console.log(`\n🔍 Buscando usuario: ${email}...`);
  
  // 1. Buscar usuario por email
  const userSnapshot = await db.collection('usuarios')
    .where('correo', '==', email)
    .limit(1)
    .get();

  if (userSnapshot.empty) {
    // Reintentar con field 'email' por si acaso
    const altSnapshot = await db.collection('usuarios')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (altSnapshot.empty) {
      console.error('❌ Usuario no encontrado en la colección "usuarios".');
      process.exit(1);
    }
  }

  const userDoc = userSnapshot.docs[0] || userSnapshot.docs[0];
  const userData = userDoc.data();
  const uid = userDoc.id;

  console.log(`✅ Usuario encontrado: ${userData.nombre} (${uid})`);

  // 2. Crear registro de ENTRADA
  const [h, m, s] = horaEntrada.split(':').map(Number);
  const timestampEntrada = new Date(`${fecha}T${horaEntrada}`);
  
  // Determinar si es retardo (límite 8:10 AM)
  const esRetardo = (h > 8) || (h === 8 && m > 10);
  const estadoEntrada = (userData.tipo === 'especial' || userData.tipo === 'horario_especial') ? 'puntual' : (esRetardo ? 'retardo' : 'puntual');

  const registroEntrada = {
    uid,
    nombre: userData.nombre,
    email: email,
    tipo: userData.tipo || 'empleado',
    fecha,
    hora: horaEntrada,
    tipoEvento: 'entrada',
    estado: estadoEntrada,
    ubicacion: null,
    timestamp: timestampEntrada,
    metodo: 'manual_backdoor'
  };

  console.log(`📤 Inyectando ENTRADA (${estadoEntrada})...`);
  await db.collection('registros').add(registroEntrada);

  // 3. Crear registro de SALIDA (si se proporcionó)
  if (horaSalida) {
    const timestampSalida = new Date(`${fecha}T${horaSalida}`);
    const registroSalida = {
      uid,
      nombre: userData.nombre,
      email: email,
      tipo: userData.tipo || 'empleado',
      fecha,
      hora: horaSalida,
      tipoEvento: 'salida',
      estado: 'salida',
      ubicacion: null,
      timestamp: timestampSalida,
      metodo: 'manual_backdoor'
    };

    console.log(`📤 Inyectando SALIDA...`);
    await db.collection('registros').add(registroSalida);
  }

  console.log('\n✨ ¡Proceso completado con éxito! ✨\n');
  process.exit(0);
}

run();
