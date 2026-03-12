# Guía de Setup - Backend Checador Cielito Home

Esta guía te llevará paso a paso para configurar y ejecutar el backend por primera vez.

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** versión 18 o superior → [Descargar aquí](https://nodejs.org/)
- **npm** (viene con Node.js)
- **Git** (opcional pero recomendado)
- Cuenta de **Firebase** con el proyecto "qr-acceso-cielito-home"

## 🚀 Paso 1: Instalar Dependencias

Abre una terminal en la carpeta `backend/` y ejecuta:

```bash
npm install
```

Esto instalará todas las dependencias necesarias (Express, Firebase Admin SDK, etc.)

## 🔐 Paso 2: Obtener Credenciales de Firebase

### Opción A: Descargar Service Account Key (Recomendado para desarrollo local)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto "qr-acceso-cielito-home"
3. Ve a **⚙️ Project Settings** (Configuración del proyecto)
4. Pestaña **Service Accounts**
5. Click en **"Generate new private key"** (Generar nueva clave privada)
6. Descargar el archivo JSON
7. **Renombrar el archivo** a `firebase-service-account.json`
8. **Moverlo** a la carpeta `backend/` (al mismo nivel que `package.json`)

⚠️ **IMPORTANTE:** Este archivo contiene credenciales secretas. NUNCA lo subas a Git.

### Opción B: Usar Variables de Entorno (Producción)

Si prefieres no usar el archivo JSON, puedes configurar variables de entorno (ver Paso 3).

## 🔧 Paso 3: Configurar Variables de Entorno

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Abre `.env` con un editor de texto

3. **Configuración Mínima (si usas firebase-service-account.json):**

```env
# Server
PORT=3000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:5000,https://qr-acceso-cielito-home.web.app

# Admin Emails
ADMIN_EMAILS=sistemas16ch@gmail.com,leticia@cielitohome.com,direcciongeneral@cielitohome.com
```

4. **Configuración Completa (sin archivo JSON):**

Si NO usas el archivo `firebase-service-account.json`, necesitas agregar:

```env
# Firebase Admin SDK (extraer del archivo JSON descargado)
FIREBASE_PROJECT_ID=qr-acceso-cielito-home
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@qr-acceso-cielito-home.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"
```

**Nota:** Para obtener estos valores, abre el archivo JSON descargado en el Paso 2:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (copiar TODO, incluyendo `-----BEGIN` y `-----END`)

## ✅ Paso 4: Verificar Configuración

Verifica que tienes:

```
backend/
├── node_modules/          ✓ (creado con npm install)
├── src/                   ✓
├── .env                   ✓ (copiado de .env.example y editado)
├── firebase-service-account.json  ✓ (descargado de Firebase)
├── package.json           ✓
└── README.md              ✓
```

## 🎯 Paso 5: Iniciar el Servidor

### Modo Desarrollo (con auto-reload)

```bash
npm run dev
```

### Modo Producción

```bash
npm start
```

Si todo está bien, verás:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🏢 CHECADOR CIELITO HOME - API BACKEND            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✅ Firebase Admin SDK inicializado con service account key
✅ Firestore y Auth configurados correctamente

📡 Servidor corriendo en puerto: 3000
🌍 Entorno: development
🕐 Iniciado: ...

📋 Endpoints disponibles:
   • Health check: http://localhost:3000/health
   • API root: http://localhost:3000/api/v1

✅ Servidor listo para recibir peticiones
```

## 🧪 Paso 6: Probar el Servidor

### Opción A: Navegador

Abre tu navegador y ve a:

```
http://localhost:3000/health
```

Deberías ver:

```json
{
  "status": "ok",
  "timestamp": "2025-11-27T...",
  "uptime": 1.234,
  "environment": "development"
}
```

### Opción B: cURL (Terminal)

```bash
curl http://localhost:3000/health
```

### Opción C: Postman/Thunder Client

Importa y prueba los endpoints desde tu herramienta favorita.

## 📡 Endpoints Disponibles (Fase 1)

### Usuarios

**Nota:** Todos los endpoints requieren autenticación con Firebase Auth token.

#### 1. Obtener todos los usuarios (Admin)

```
GET /api/v1/users
Headers:
  Authorization: Bearer <firebase_token>
```

#### 2. Obtener usuario específico

```
GET /api/v1/users/:uid
Headers:
  Authorization: Bearer <firebase_token>
```

#### 3. Crear usuario (Admin)

```
POST /api/v1/users
Headers:
  Authorization: Bearer <firebase_token>
  Content-Type: application/json
Body:
{
  "uid": "firebase_uid_here",
  "nombre": "Juan Pérez",
  "correo": "juan@cielitohome.com",
  "tipo": "tiempo_completo"
}
```

## 🔍 Probar con Token de Firebase

Para probar los endpoints que requieren autenticación, necesitas un token de Firebase:

### Opción 1: Obtener token desde el Frontend Actual

1. Abre el sistema actual (index.html)
2. Inicia sesión con Google
3. Abre la consola del navegador (F12)
4. Ejecuta:

```javascript
firebase.auth().currentUser.getIdToken().then(token => console.log(token))
```

5. Copia el token que aparece en consola

### Opción 2: Crear Script de Prueba

Crea un archivo `test-auth.js` en la raíz del backend:

```javascript
// Próximamente: script para generar tokens de prueba
```

### Usar el Token en Postman/cURL

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN_HERE"
```

## ❌ Solución de Problemas Comunes

### Error: "Firebase Admin SDK no está inicializado"

**Causa:** Archivo `firebase-service-account.json` no encontrado o variables de entorno incorrectas.

**Solución:**
1. Verifica que el archivo existe en `backend/firebase-service-account.json`
2. O configura las variables de entorno en `.env`

### Error: "Puerto 3000 ya está en uso"

**Causa:** Otro proceso está usando el puerto 3000.

**Solución:**
1. Cambia el puerto en `.env`: `PORT=3001`
2. O detén el proceso que usa el puerto 3000

### Error: "No permitido por CORS"

**Causa:** El frontend está en una URL no autorizada.

**Solución:**
Agrega la URL del frontend a `ALLOWED_ORIGINS` en `.env`:

```env
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:8080,tu-url-aqui
```

### Error: "Token de autenticación inválido"

**Causa:** El token de Firebase ha expirado o es inválido.

**Solución:**
1. Genera un nuevo token desde el frontend
2. Los tokens de Firebase expiran después de 1 hora

## 📚 Próximos Pasos

Una vez que el servidor esté funcionando:

1. ✅ **Fase 1 completada:** Estructura base y usuarios
2. 🔄 **Fase 2:** Migrar módulo de asistencias
3. 🔄 **Fase 3:** Migrar módulo de nómina
4. 🔄 **Fase 4:** Migrar reportes y ausencias
5. 🔄 **Fase 5:** Actualizar frontend para usar API

## 🆘 Ayuda

Si tienes problemas:

1. Revisa los logs en la consola del servidor
2. Verifica que todas las dependencias están instaladas
3. Asegúrate de que Firebase Admin SDK está inicializado
4. Contacta al equipo de desarrollo

---

**¡Listo!** Tu backend debería estar funcionando correctamente. 🎉
