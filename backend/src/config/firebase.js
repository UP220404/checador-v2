import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let firebaseApp;
let db;
let auth;

/**
 * Inicializa Firebase Admin SDK
 */
export function initializeFirebase() {
  try {
    // Opción 1 (preferida): Variables de entorno — usar siempre en producción
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      console.log('✅ Firebase Admin SDK inicializado con variables de entorno');
    }
    // Opción 2 (solo desarrollo local): Archivo JSON — NO subir al repositorio ni a OneDrive
    else {
      const serviceAccountPath = join(__dirname, '../../firebase-service-account.json');
      let serviceAccount;

      try {
        const fileContent = readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(fileContent);
        console.warn('⚠️  Usando firebase-service-account.json — configura FIREBASE_PRIVATE_KEY en .env para producción');
      } catch {
        throw new Error(
          'Firebase no configurado. Agrega FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY a tu archivo .env'
        );
      }

      if (!serviceAccount?.project_id) {
        throw new Error('firebase-service-account.json inválido o vacío');
      }

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    db = admin.firestore();
    auth = admin.auth();

    // Configuración de Firestore
    db.settings({
      ignoreUndefinedProperties: true
    });

    console.log('✅ Firestore y Auth configurados correctamente');

  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin SDK:', error);
    process.exit(1);
  }
}

/**
 * Obtiene la instancia de Firestore
 */
export function getFirestore() {
  if (!db) {
    throw new Error('Firestore no está inicializado. Llama a initializeFirebase() primero.');
  }
  return db;
}

/**
 * Obtiene la instancia de Auth
 */
export function getAuth() {
  if (!auth) {
    throw new Error('Auth no está inicializado. Llama a initializeFirebase() primero.');
  }
  return auth;
}

/**
 * Verifica si un email es administrador
 */
export function isAdmin(email) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export default {
  initializeFirebase,
  getFirestore,
  getAuth,
  isAdmin
};
