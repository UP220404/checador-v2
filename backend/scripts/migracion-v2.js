/**
 * Script de Migración v2 - Portal Empleado
 *
 * Este script agrega los nuevos campos necesarios para el Portal Empleado
 * sin eliminar datos existentes. Es seguro ejecutarlo múltiples veces.
 *
 * Uso: node scripts/migracion-v2.js
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const PROGRESS_FILE = join(__dirname, '.migracion-v2-progress.json');
const BATCH_SIZE = 100;

// Inicializar Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');

if (!admin.apps.length) {
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin inicializado con service account');
  } else {
    console.error('❌ No se encontró firebase-service-account.json');
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Valores por defecto para los nuevos campos de usuario
 */
const DEFAULT_NEW_USER_FIELDS = {
  // Datos personales extendidos (se establecerán como null para que el usuario los complete)
  fechaNacimiento: null,
  fechaIngreso: null,
  puesto: null,
  fotoUrl: null,

  // Fechas importantes (array vacío)
  fechasImportantes: [],

  // Preferencias de notificaciones
  preferenciasNotificaciones: {
    alertaEntrada: true,
    alertaSalida: true,
    alertaCumpleanos: true,
    alertaAprobacionPermisos: true,
    canalPreferido: 'in_app'
  },

  // Saldo de vacaciones
  saldoVacaciones: {
    diasDisponibles: 6,  // Días por defecto según ley mexicana primer año
    diasUsados: 0,
    diasPendientes: 0,
    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
  }
};

/**
 * Carga el progreso de una migración previa (si existe)
 */
function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📋 Progreso anterior encontrado: ${data.processedCount} usuarios procesados`);
      return data;
    }
  } catch (error) {
    console.log('⚠️ No se pudo cargar progreso anterior, iniciando desde cero');
  }
  return { processedCount: 0, lastProcessedId: null, errors: [] };
}

/**
 * Guarda el progreso de la migración
 */
function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Limpia el archivo de progreso después de completar
 */
function clearProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      writeFileSync(PROGRESS_FILE, JSON.stringify({ completed: true, date: new Date().toISOString() }));
    }
  } catch (error) {
    console.log('⚠️ No se pudo limpiar archivo de progreso');
  }
}

/**
 * Migra un usuario individual agregando campos faltantes
 */
async function migrateUser(userDoc) {
  const userData = userDoc.data();
  const updates = {};
  let needsUpdate = false;

  // Verificar y agregar cada campo nuevo si no existe
  for (const [field, defaultValue] of Object.entries(DEFAULT_NEW_USER_FIELDS)) {
    if (!(field in userData)) {
      updates[field] = defaultValue;
      needsUpdate = true;
    }
  }

  // Si saldoVacaciones existe pero le faltan campos, completarlos
  if (userData.saldoVacaciones) {
    const saldoDefaults = DEFAULT_NEW_USER_FIELDS.saldoVacaciones;
    for (const [key, value] of Object.entries(saldoDefaults)) {
      if (!(key in userData.saldoVacaciones)) {
        updates[`saldoVacaciones.${key}`] = value;
        needsUpdate = true;
      }
    }
  }

  // Si preferenciasNotificaciones existe pero le faltan campos, completarlos
  if (userData.preferenciasNotificaciones) {
    const prefDefaults = DEFAULT_NEW_USER_FIELDS.preferenciasNotificaciones;
    for (const [key, value] of Object.entries(prefDefaults)) {
      if (!(key in userData.preferenciasNotificaciones)) {
        updates[`preferenciasNotificaciones.${key}`] = value;
        needsUpdate = true;
      }
    }
  }

  if (needsUpdate) {
    await userDoc.ref.update(updates);
    return { migrated: true, fields: Object.keys(updates) };
  }

  return { migrated: false, fields: [] };
}

/**
 * Ejecuta la migración de usuarios
 */
async function migrateUsers() {
  console.log('\n📦 MIGRACIÓN DE COLECCIÓN: usuarios');
  console.log('=' .repeat(50));

  const progress = loadProgress();
  let query = db.collection('usuarios').orderBy(admin.firestore.FieldPath.documentId());

  // Si hay progreso anterior, continuar desde el último ID
  if (progress.lastProcessedId) {
    query = query.startAfter(progress.lastProcessedId);
    console.log(`▶️ Continuando desde usuario: ${progress.lastProcessedId}`);
  }

  let totalMigrated = 0;
  let totalSkipped = 0;
  let hasMore = true;

  while (hasMore) {
    const snapshot = await query.limit(BATCH_SIZE).get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    for (const doc of snapshot.docs) {
      try {
        const result = await migrateUser(doc);

        if (result.migrated) {
          totalMigrated++;
          console.log(`  ✅ ${doc.id}: agregados ${result.fields.length} campos`);
        } else {
          totalSkipped++;
          console.log(`  ⏭️ ${doc.id}: ya tiene todos los campos`);
        }

        progress.processedCount++;
        progress.lastProcessedId = doc.id;
      } catch (error) {
        console.error(`  ❌ ${doc.id}: ${error.message}`);
        progress.errors.push({ id: doc.id, error: error.message });
      }
    }

    // Guardar progreso después de cada batch
    saveProgress(progress);

    // Preparar siguiente query
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    query = db.collection('usuarios')
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(lastDoc);
  }

  console.log(`\n📊 Resumen usuarios:`);
  console.log(`   Migrados: ${totalMigrated}`);
  console.log(`   Sin cambios: ${totalSkipped}`);
  console.log(`   Errores: ${progress.errors.length}`);

  return { migrated: totalMigrated, skipped: totalSkipped, errors: progress.errors };
}

/**
 * Crea las colecciones nuevas si no existen (con documento placeholder)
 */
async function createNewCollections() {
  console.log('\n📦 CREACIÓN DE NUEVAS COLECCIONES');
  console.log('=' .repeat(50));

  const collections = [
    {
      name: 'documentos_empleado',
      description: 'Documentos de empleados (contratos, recibos, etc.)'
    },
    {
      name: 'notificaciones',
      description: 'Notificaciones del sistema'
    }
  ];

  for (const col of collections) {
    try {
      // Verificar si la colección existe chequeando si tiene documentos
      const snapshot = await db.collection(col.name).limit(1).get();

      if (snapshot.empty) {
        // Crear documento placeholder que se puede eliminar después
        await db.collection(col.name).doc('_placeholder').set({
          _info: 'Documento placeholder - se puede eliminar',
          _createdAt: admin.firestore.FieldValue.serverTimestamp(),
          _description: col.description
        });
        console.log(`  ✅ Colección '${col.name}' creada`);
      } else {
        console.log(`  ⏭️ Colección '${col.name}' ya existe`);
      }
    } catch (error) {
      console.error(`  ❌ Error creando '${col.name}': ${error.message}`);
    }
  }
}

/**
 * Calcula el saldo de vacaciones basado en ausencias aprobadas
 */
async function recalculateVacationBalances() {
  console.log('\n📦 RECALCULO DE SALDOS DE VACACIONES');
  console.log('=' .repeat(50));

  const usersSnapshot = await db.collection('usuarios').get();
  let updated = 0;

  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;

    // Obtener ausencias de tipo vacaciones aprobadas
    const ausenciasSnapshot = await db.collection('ausencias')
      .where('uid', '==', uid)
      .where('tipo', '==', 'vacaciones')
      .where('estado', '==', 'aprobada')
      .get();

    let diasUsados = 0;
    ausenciasSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.diasSolicitados) {
        diasUsados += data.diasSolicitados;
      } else if (data.fechaInicio && data.fechaFin) {
        // Calcular días entre fechas
        const inicio = data.fechaInicio.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio);
        const fin = data.fechaFin.toDate ? data.fechaFin.toDate() : new Date(data.fechaFin);
        const diffTime = Math.abs(fin - inicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        diasUsados += diffDays;
      }
    });

    // Obtener ausencias pendientes
    const pendientesSnapshot = await db.collection('ausencias')
      .where('uid', '==', uid)
      .where('tipo', '==', 'vacaciones')
      .where('estado', '==', 'pendiente')
      .get();

    let diasPendientes = 0;
    pendientesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.diasSolicitados) {
        diasPendientes += data.diasSolicitados;
      }
    });

    // Actualizar saldo
    const userData = userDoc.data();
    const diasBase = userData.saldoVacaciones?.diasDisponibles || 6;

    await userDoc.ref.update({
      'saldoVacaciones.diasUsados': diasUsados,
      'saldoVacaciones.diasPendientes': diasPendientes,
      'saldoVacaciones.ultimaActualizacion': admin.firestore.FieldValue.serverTimestamp()
    });

    if (diasUsados > 0 || diasPendientes > 0) {
      console.log(`  📊 ${userDoc.id}: ${diasUsados} usados, ${diasPendientes} pendientes`);
      updated++;
    }
  }

  console.log(`\n📊 Saldos actualizados: ${updated} usuarios`);
}

/**
 * Función principal de migración
 */
async function runMigration() {
  console.log('\n🚀 MIGRACIÓN V2 - PORTAL EMPLEADO');
  console.log('=' .repeat(50));
  console.log(`Fecha: ${new Date().toLocaleString()}`);
  console.log('=' .repeat(50));

  try {
    // 1. Migrar usuarios (agregar nuevos campos)
    await migrateUsers();

    // 2. Crear nuevas colecciones
    await createNewCollections();

    // 3. Recalcular saldos de vacaciones
    await recalculateVacationBalances();

    // Limpiar archivo de progreso
    clearProgress();

    console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('\n❌ ERROR EN MIGRACIÓN:', error);
    console.log('\n💡 La migración se puede reanudar ejecutando el script nuevamente.');
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar migración
runMigration();
