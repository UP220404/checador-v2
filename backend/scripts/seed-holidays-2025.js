/**
 * Script para agregar días festivos de México 2025
 *
 * Ejecutar con: node scripts/seed-holidays-2025.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar service account
const serviceAccountPath = join(__dirname, '../firebase-service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Días festivos oficiales de México 2025
const festivos2025 = [
  {
    fecha: '2025-01-01',
    año: 2025,
    mes: 1,
    dia: 1,
    nombre: 'Año Nuevo',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-02-03',
    año: 2025,
    mes: 2,
    dia: 3,
    nombre: 'Día de la Constitución Mexicana',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-03-17',
    año: 2025,
    mes: 3,
    dia: 17,
    nombre: 'Natalicio de Benito Juárez',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-05-01',
    año: 2025,
    mes: 5,
    dia: 1,
    nombre: 'Día del Trabajo',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-09-16',
    año: 2025,
    mes: 9,
    dia: 16,
    nombre: 'Día de la Independencia de México',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-11-17',
    año: 2025,
    mes: 11,
    dia: 17,
    nombre: 'Aniversario de la Revolución Mexicana',
    tipo: 'federal',
    activo: true
  },
  {
    fecha: '2025-12-25',
    año: 2025,
    mes: 12,
    dia: 25,
    nombre: 'Navidad',
    tipo: 'federal',
    activo: true
  }
];

async function seedHolidays() {
  console.log('🎉 Iniciando carga de días festivos 2025...\n');

  let agregados = 0;
  let existentes = 0;

  for (const festivo of festivos2025) {
    try {
      // Verificar si ya existe
      const existingQuery = await db.collection('dias_festivos')
        .where('fecha', '==', festivo.fecha)
        .get();

      if (existingQuery.empty) {
        await db.collection('dias_festivos').add({
          ...festivo,
          creadoEn: new Date().toISOString()
        });
        console.log(`✅ Agregado: ${festivo.fecha} - ${festivo.nombre}`);
        agregados++;
      } else {
        console.log(`⚠️  Ya existe: ${festivo.fecha} - ${festivo.nombre}`);
        existentes++;
      }
    } catch (error) {
      console.error(`❌ Error agregando ${festivo.fecha}:`, error.message);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   • Días festivos agregados: ${agregados}`);
  console.log(`   • Días festivos existentes: ${existentes}`);
  console.log(`   • Total: ${festivos2025.length}`);
  console.log('\n✅ Proceso completado\n');

  process.exit(0);
}

// Ejecutar
seedHolidays().catch(error => {
  console.error('❌ Error ejecutando script:', error);
  process.exit(1);
});
