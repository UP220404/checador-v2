# 🧪 Guía de Pruebas con Postman - Backend Checador Cielito Home

**Estado de tu `.env`:** ✅ Configurado correctamente
**Archivo Firebase:** ✅ `firebase-service-account.json` encontrado

---

## 📋 Prerrequisitos

✅ Node.js instalado
✅ Archivo `.env` configurado
✅ `firebase-service-account.json` en la carpeta backend
⬜ Dependencias instaladas (lo haremos ahora)
⬜ Servidor iniciado
⬜ Postman instalado

---

## 🚀 PASO 1: Instalar Dependencias e Iniciar Servidor

### 1.1 Abrir terminal en la carpeta backend

```bash
cd backend
```

### 1.2 Instalar dependencias

```bash
npm install
```

Deberías ver algo como:
```
added 150 packages, and audited 151 packages in 15s
```

### 1.3 Iniciar el servidor en modo desarrollo

```bash
npm run dev
```

**✅ Si todo está bien, verás:**

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
🕐 Iniciado: [fecha/hora]

📋 Endpoints disponibles:
   • Health check: http://localhost:3000/health
   • API root: http://localhost:3000/api/v1

✅ Servidor listo para recibir peticiones
```

**❌ Si ves errores, revisa la sección "Solución de Problemas" al final**

---

## 🧪 PASO 2: Pruebas sin Autenticación (Health Check)

### 2.1 Abrir Postman

Si no tienes Postman instalado:
- **Opción A:** Descargar desde https://www.postman.com/downloads/
- **Opción B:** Usar la versión web https://web.postman.com/
- **Opción C:** Usar Thunder Client (extensión de VS Code)

### 2.2 Crear Nueva Request

1. Click en "New" → "HTTP Request"
2. Configurar:
   - **Método:** `GET`
   - **URL:** `http://localhost:3000/health`
3. Click en "Send"

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-11-27T15:30:00.000Z",
  "uptime": 12.345,
  "environment": "development"
}
```

### 2.3 Probar Ruta Raíz

1. **Método:** `GET`
2. **URL:** `http://localhost:3000/`
3. Click en "Send"

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "message": "API Checador Cielito Home",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "api": "/api/v1"
  }
}
```

---

## 🔐 PASO 3: Obtener Token de Firebase para Autenticación

Para probar los endpoints protegidos, necesitas un token de Firebase Auth.

### Opción A: Desde el Frontend Actual (Más Fácil)

1. **Ir al sistema actual:**
   - Abrir: `Checador QR/index.html` en el navegador
   - O ir a: `https://qr-acceso-cielito-home.web.app/`

2. **Iniciar sesión con Google**

3. **Abrir la consola del navegador:**
   - Presiona `F12` o `Ctrl + Shift + I`
   - Ve a la pestaña "Console"

4. **Ejecutar este código:**

```javascript
firebase.auth().currentUser.getIdToken().then(token => {
  console.log("=== TOKEN DE FIREBASE ===");
  console.log(token);
  console.log("=== COPIA EL TOKEN DE ARRIBA ===");

  // También lo copiamos al clipboard
  navigator.clipboard.writeText(token);
  alert("Token copiado al portapapeles! Pégalo en Postman.");
});
```

5. **Copiar el token** que aparece en consola (es un string largo como: `eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...`)

**💡 Nota:** El token expira después de 1 hora, así que tendrás que generar uno nuevo si pasa ese tiempo.

### Opción B: Crear Script de Node.js (Más Técnico)

Crea un archivo `backend/test/get-token.js`:

```javascript
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Leer service account
const serviceAccount = JSON.parse(
  readFileSync('./firebase-service-account.json', 'utf8')
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Crear custom token para un usuario de prueba
const uid = 'test-user-uid'; // Cambiar por un UID real de tu sistema
admin.auth().createCustomToken(uid)
  .then((token) => {
    console.log('Custom Token:', token);
    console.log('\nPara obtener ID token, intercambia este token en el cliente');
  })
  .catch((error) => {
    console.error('Error:', error);
  });
```

**No recomiendo esta opción para empezar.** Mejor usa la Opción A.

---

## 🧪 PASO 4: Probar Endpoints CON Autenticación

### 4.1 Configurar Headers en Postman

Para TODAS las siguientes peticiones, debes agregar el header de autenticación:

1. En Postman, ve a la pestaña **"Headers"**
2. Agrega un nuevo header:
   - **Key:** `Authorization`
   - **Value:** `Bearer TU_TOKEN_AQUI` (pegar el token que copiaste)

**Ejemplo:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjNkOT...
```

---

### 4.2 TEST 1: Obtener Todos los Usuarios (Solo Admin)

**Request:**
- **Método:** `GET`
- **URL:** `http://localhost:3000/api/v1/users`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "uid": "abc123...",
      "nombre": "Juan Pérez",
      "correo": "juan@cielitohome.com",
      "tipo": "tiempo_completo",
      "activo": true,
      "fechaCreacion": {...}
    },
    // ... más usuarios
  ]
}
```

**❌ Si obtienes error 401:**
```json
{
  "success": false,
  "message": "Token de autenticación no proporcionado"
}
```
→ Verifica que agregaste el header `Authorization`

**❌ Si obtienes error 403:**
```json
{
  "success": false,
  "message": "Se requieren privilegios de administrador"
}
```
→ El usuario con el que iniciaste sesión NO es admin. Usa un email de la lista `ADMIN_EMAILS` en `.env`

---

### 4.3 TEST 2: Obtener Usuario Específico

**Request:**
- **Método:** `GET`
- **URL:** `http://localhost:3000/api/v1/users/UID_DEL_USUARIO`
  - Reemplaza `UID_DEL_USUARIO` con un UID real de la lista anterior
  - Ejemplo: `http://localhost:3000/api/v1/users/abc123def456`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "data": {
    "uid": "abc123def456",
    "nombre": "María López",
    "correo": "maria@cielitohome.com",
    "tipo": "becario",
    "activo": true,
    "fechaCreacion": {
      "_seconds": 1700000000,
      "_nanoseconds": 0
    }
  }
}
```

**❌ Si obtienes error 404:**
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```
→ El UID no existe. Usa un UID de un usuario real.

---

### 4.4 TEST 3: Crear Nuevo Usuario (Solo Admin)

**Request:**
- **Método:** `POST`
- **URL:** `http://localhost:3000/api/v1/users`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`
  - `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "uid": "test-user-123",
  "nombre": "Usuario de Prueba",
  "correo": "prueba@cielitohome.com",
  "tipo": "becario"
}
```

**✅ Respuesta esperada (Status: 201 Created):**

```json
{
  "success": true,
  "message": "Usuario creado exitosamente",
  "data": {
    "uid": "test-user-123",
    "nombre": "Usuario de Prueba",
    "correo": "prueba@cielitohome.com",
    "tipo": "becario",
    "activo": true,
    "fechaCreacion": {...}
  }
}
```

**❌ Si obtienes error 409:**
```json
{
  "success": false,
  "message": "El email ya está registrado"
}
```
→ Cambia el email por uno que no exista.

---

### 4.5 TEST 4: Actualizar Usuario (Solo Admin)

**Request:**
- **Método:** `PUT`
- **URL:** `http://localhost:3000/api/v1/users/test-user-123`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`
  - `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "nombre": "Usuario Actualizado",
  "tipo": "tiempo_completo"
}
```

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "message": "Usuario actualizado exitosamente",
  "data": {
    "uid": "test-user-123",
    "nombre": "Usuario Actualizado",
    "tipo": "tiempo_completo",
    // ... otros campos
  }
}
```

---

### 4.6 TEST 5: Obtener Configuración de Nómina

**Request:**
- **Método:** `GET`
- **URL:** `http://localhost:3000/api/v1/users/test-user-123/payroll-config`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "data": {
    "salarioQuincenal": 0,
    "tipoNomina": "quincenal",
    "tieneIMSS": false,
    "tieneCajaAhorro": false,
    "montoCajaAhorro": 0
  }
}
```

---

### 4.7 TEST 6: Actualizar Configuración de Nómina (Solo Admin)

**Request:**
- **Método:** `PUT`
- **URL:** `http://localhost:3000/api/v1/users/test-user-123/payroll-config`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`
  - `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "salarioQuincenal": 3500,
  "tipoNomina": "quincenal",
  "tieneIMSS": true,
  "tieneCajaAhorro": false,
  "montoCajaAhorro": 0
}
```

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "message": "Configuración de nómina actualizada",
  "data": {
    "salarioQuincenal": 3500,
    "tipoNomina": "quincenal",
    "tieneIMSS": true,
    "tieneCajaAhorro": false,
    "montoCajaAhorro": 0,
    "fechaActualizacion": {...}
  }
}
```

---

### 4.8 TEST 7: Eliminar Usuario (Solo Admin)

**Request:**
- **Método:** `DELETE`
- **URL:** `http://localhost:3000/api/v1/users/test-user-123`
- **Headers:**
  - `Authorization: Bearer TU_TOKEN`

**✅ Respuesta esperada (Status: 200 OK):**

```json
{
  "success": true,
  "message": "Usuario desactivado"
}
```

**Nota:** Es un "soft delete", el usuario se marca como `activo: false` pero NO se borra de la base de datos.

---

## 📊 Checklist de Pruebas

Marca cada prueba conforme la completes:

- [ ] ✅ Health check (`GET /health`)
- [ ] ✅ API root (`GET /`)
- [ ] 🔐 Obtener token de Firebase
- [ ] 🔐 Listar todos los usuarios (`GET /api/v1/users`)
- [ ] 🔐 Obtener usuario específico (`GET /api/v1/users/:uid`)
- [ ] 🔐 Crear usuario (`POST /api/v1/users`)
- [ ] 🔐 Actualizar usuario (`PUT /api/v1/users/:uid`)
- [ ] 🔐 Obtener config nómina (`GET /api/v1/users/:uid/payroll-config`)
- [ ] 🔐 Actualizar config nómina (`PUT /api/v1/users/:uid/payroll-config`)
- [ ] 🔐 Eliminar usuario (`DELETE /api/v1/users/:uid`)

---

## ❌ Solución de Problemas

### Error: "Cannot find module 'firebase-admin'"

**Solución:**
```bash
cd backend
npm install
```

### Error: "Firebase Admin SDK no está inicializado"

**Causa:** No encuentra el archivo `firebase-service-account.json`

**Solución:**
1. Verifica que el archivo existe en `backend/firebase-service-account.json`
2. Verifica que el nombre es exacto (sensible a mayúsculas/minúsculas)

### Error: "EADDRINUSE: address already in use :::3000"

**Causa:** El puerto 3000 ya está en uso

**Solución 1 - Cambiar puerto:**
1. Editar `.env`
2. Cambiar `PORT=3000` a `PORT=3001`
3. Reiniciar servidor
4. Actualizar URLs en Postman a `http://localhost:3001/...`

**Solución 2 - Matar proceso:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [número_de_proceso] /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Error: "Token de autenticación inválido"

**Causas posibles:**
1. Token expirado (duran 1 hora)
2. Token mal copiado (espacios extra, incompleto)
3. Falta el prefijo `Bearer ` en el header

**Solución:**
1. Generar nuevo token desde el frontend
2. Verificar que el header sea: `Authorization: Bearer TU_TOKEN`
3. Asegurarse de que no haya espacios extra

### Error: "No permitido por CORS"

**Causa:** Estás haciendo requests desde un origen no autorizado

**Solución:**
1. En Postman esto NO debería pasar (Postman no valida CORS)
2. Si usas el navegador, verifica `ALLOWED_ORIGINS` en `.env`

### Error: "Se requieren privilegios de administrador"

**Causa:** El email del usuario no está en la lista de admins

**Solución:**
1. Verifica `.env` → `ADMIN_EMAILS`
2. Asegúrate de que el email con el que iniciaste sesión está en esa lista
3. Si agregaste un email nuevo, reinicia el servidor

---

## 🎉 Siguiente Paso

Una vez que TODAS las pruebas pasen exitosamente:

1. ✅ **Confirmar que el backend funciona correctamente**
2. 🔄 **Decidir:** ¿Continuar con Fase 2 (Asistencias)?
3. 📝 **Documentar** cualquier problema encontrado
4. 💬 **Discutir** próximos pasos con el equipo

---

## 📸 Capturas Recomendadas

Para documentar las pruebas, toma capturas de:
- ✅ Servidor iniciado correctamente (terminal)
- ✅ Health check exitoso (Postman)
- ✅ GET usuarios con autenticación (Postman)
- ✅ POST crear usuario exitoso (Postman)

---

**¿Algún problema?** Revisa los logs del servidor en la terminal donde ejecutaste `npm run dev`.

**¡Listo para probar!** 🚀
