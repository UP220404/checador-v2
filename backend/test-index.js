import { initializeFirebase, getFirestore } from './src/config/firebase.js';

async function testQuery() {
  try {
    initializeFirebase();
    const db = getFirestore();
    console.log("Corriendo query para forzar el error de indice compuesto...");
    await db.collection('registros')
      .where('uid', '==', 'testudo')
      .where('fecha', '>=', '2024-01-01')
      .where('fecha', '<=', '2024-01-31')
      .get();
    console.log("Query exitosa (el indice ya existe)");
    process.exit(0);
  } catch (error) {
    console.log("=========================================");
    console.log("LINK PARA CREAR EL INDICE:");
    console.log(error.message);
    console.log("=========================================");
    process.exit(1);
  }
}

testQuery();
