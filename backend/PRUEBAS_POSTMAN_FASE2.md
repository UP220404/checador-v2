# 🧪 GUÍA DE PRUEBAS POSTMAN - FASE 2
## Módulos de Asistencias y QR

---

## 📋 ÍNDICE

1. [Configuración Inicial](#configuración-inicial)
2. [Pruebas de QR Tokens](#pruebas-de-qr-tokens)
3. [Pruebas de Asistencias](#pruebas-de-asistencias)
4. [Casos de Prueba Especiales](#casos-de-prueba-especiales)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Configuración Inicial

### Variables de Entorno en Postman

Crea las siguientes variables en Postman (si no las tienes ya):

```
BASE_URL: http://localhost:3000
API_VERSION: /api/v1
AUTH_TOKEN: [tu_firebase_token]
USER_UID: [tu_uid]
```

Para obtener tu token de Firebase:
1. Ve a: https://qr-acceso-cielito-home.web.app/admin.html
2. Inicia sesión con tu cuenta admin
3. Abre la consola del navegador y ejecuta:
```javascript
firebase.auth().currentUser.getIdToken().then(token => console.log(token))
```

---

## 🎫 PRUEBAS DE QR TOKENS

### 1. Obtener Token QR Actual

**Endpoint:** `GET /api/v1/qr/current`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Respuesta Esperada (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "current",
    "token": "...",
    "qrCode": "OFICINA2025",
    "modo": "dinamico",
    "expiracion": "2025-11-27T16:00:00.000Z",
    "fechaCreacion": "2025-11-27T15:55:00.000Z",
    "usado": false
  }
}
```

**Respuesta si NO hay token (404):**
```json
{
  "success": false,
  "message": "No hay token QR activo"
}
```

---

### 2. Generar Nuevo Token QR (ADMIN ONLY)

**Endpoint:** `POST /api/v1/qr/generate`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body (Modo Dinámico - un solo uso):**
```json
{
  "modo": "dinamico",
  "duracionMinutos": 5
}
```

**Body (Modo Estático - múltiples usos):**
```json
{
  "modo": "estatico",
  "duracionMinutos": 60
}
```

**Respuesta Esperada (201 CREATED):**
```json
{
  "success": true,
  "token": "lqr5t4h-k3j2h4g5f6d7s",
  "qrCode": "OFICINA2025",
  "fullUrl": "?qr=OFICINA2025&token=lqr5t4h-k3j2h4g5f6d7s",
  "expiracion": "2025-11-27T16:00:00.000Z",
  "modo": "dinamico"
}
```

**⚠️ Nota:** Guarda el `token` generado para las siguientes pruebas

---

### 3. Validar Token QR

**Endpoint:** `POST /api/v1/qr/validate`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "qrCode": "OFICINA2025",
  "token": "mihmeycc-e3rehwjicyf"
}
```

**Respuesta Válida (200 OK):**
```json
{
  "valido": true,
  "mensaje": "✅ QR válido",
  "tokenData": {
    "modo": "dinamico",
    "expiracion": "2025-11-27T16:00:00.000Z"
  }
}
```

**Respuestas de Error:**

❌ Token expirado:
```json
{
  "valido": false,
  "mensaje": "⏰ QR expirado. Solicita un nuevo código."
}
```

❌ Token ya usado (modo dinámico):
```json
{
  "valido": false,
  "mensaje": "🚫 QR ya utilizado. Cada QR solo puede usarse una vez."
}
```

❌ QR inválido:
```json
{
  "valido": false,
  "mensaje": "❌ Código QR inválido"
}
```

---

### 4. Obtener Estadísticas QR (ADMIN ONLY)

**Endpoint:** `GET /api/v1/qr/stats`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcional):**
```
fecha=2025-11-27
```

**Respuesta Esperada (200 OK):**
```json
{
  "success": true,
  "data": {
    "generados": 5,
    "exitosos": 12,
    "bloqueados": 3,
    "fecha": "2025-11-27",
    "ultimaActualizacion": "2025-11-27T15:30:00.000Z"
  }
}
```

---

## 📝 PRUEBAS DE ASISTENCIAS

### 5. Registrar Entrada/Salida (Check-in)

**Endpoint:** `POST /api/v1/attendance/check-in`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body (Usuario Normal):**
```json
{
  "qrCode": "OFICINA2025",
  "token": "lqr5t4h-k3j2h4g5f6d7s",
  "location": {
    "lat": 20.634503,
    "lng": -103.339386,
    "accuracy": 15
  }
}
```

**Body (Usuario Remoto - sin ubicación ni QR):**
```json
{
  "qrCode": "OFICINA2025"
}
```

**Respuesta Entrada Puntual (201 CREATED):**
```json
{
  "success": true,
  "data": {
    "id": "xyz123",
    "uid": "...",
    "nombre": "Lenin Navarro",
    "email": "sistemas16ch@gmail.com",
    "tipo": "empleado",
    "fecha": "2025-11-27",
    "hora": "09:00:00",
    "tipoEvento": "entrada",
    "estado": "puntual",
    "ubicacion": { "lat": 20.634503, "lng": -103.339386 },
    "timestamp": "2025-11-27T09:00:00.000Z"
  },
  "message": "✅ Entrada puntual registrada a las 09:00:00. ¡Buen día, Lenin Navarro!"
}
```

**Respuesta Entrada con Retardo:**
```json
{
  "success": true,
  "data": { /* ... */ },
  "message": "⚠️ Entrada con retardo registrada a las 09:16:00."
}
```

**Respuesta Salida:**
```json
{
  "success": true,
  "data": {
    "tipoEvento": "salida",
    "estado": "salida",
    /* ... */
  },
  "message": "📤 Salida registrada a las 18:00:00. ¡Hasta mañana, Lenin Navarro!"
}
```

**Errores Comunes:**

❌ QR inválido (400):
```json
{
  "success": false,
  "message": "❌ Token inválido. Escanea el QR más reciente."
}
```

❌ Fuera de rango (400):
```json
{
  "success": false,
  "message": "⛔ Solo puedes registrar asistencia dentro de la oficina. Distancia: 250m (máximo: 150m)"
}
```

❌ Ya registrado hoy (400):
```json
{
  "success": false,
  "message": "⚠️ Ya registraste entrada y salida hoy."
}
```

❌ Fin de semana (400):
```json
{
  "success": false,
  "message": "⛔ No puedes registrar asistencia en fin de semana."
}
```

---

### 6. Obtener Historial de Asistencias

**Endpoint:** `GET /api/v1/attendance/history/:userId`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcional):**
```
limit=30
```

**Ejemplo:**
```
GET /api/v1/attendance/history/abc123?limit=10
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "reg1",
      "uid": "abc123",
      "nombre": "Lenin Navarro",
      "fecha": "2025-11-27",
      "hora": "09:00:00",
      "tipoEvento": "entrada",
      "estado": "puntual",
      "timestamp": "2025-11-27T09:00:00.000Z"
    },
    {
      "id": "reg2",
      "tipoEvento": "salida",
      "hora": "18:00:00",
      /* ... */
    }
  ]
}
```

**Autorización:**
- ✅ Usuarios pueden ver su propio historial
- ✅ Admins pueden ver historial de cualquier usuario
- ❌ Usuarios NO pueden ver historial de otros (403 Forbidden)

---

### 7. Obtener Asistencias Semanales

**Endpoint:** `GET /api/v1/attendance/weekly/:userId`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/attendance/weekly/abc123
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "fecha": "2025-11-25",
      "tipoEvento": "entrada",
      "hora": "09:00:00"
    },
    {
      "fecha": "2025-11-25",
      "tipoEvento": "salida",
      "hora": "18:00:00"
    },
    /* ... más registros de la semana ... */
  ]
}
```

**Nota:** Solo muestra registros desde el lunes de la semana actual.

---

### 8. Obtener Asistencias del Día (ADMIN ONLY)

**Endpoint:** `GET /api/v1/attendance/today`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "nombre": "Lenin Navarro",
      "email": "sistemas16ch@gmail.com",
      "tipoEvento": "entrada",
      "hora": "09:00:00",
      "estado": "puntual"
    },
    {
      "nombre": "Leticia García",
      "tipoEvento": "entrada",
      "hora": "09:15:00",
      "estado": "retardo"
    },
    /* ... más registros del día ... */
  ]
}
```

**Uso:** Panel de admin para ver quién ha llegado hoy.

---

## 🧪 CASOS DE PRUEBA ESPECIALES

### Caso 1: Usuario Remoto (sin QR ni ubicación)

**Usuario:** Un correo que esté en `USUARIOS_REMOTOS` en `constants.js`

**Body mínimo:**
```json
{
  "qrCode": "OFICINA2025"
}
```

**Resultado:** ✅ No valida QR ni ubicación, registro exitoso

---

### Caso 2: Modo Pruebas

**Usuario:** Un correo en `USUARIOS_MODO_PRUEBAS` o `CONFIG.MODO_PRUEBAS = true`

**Características:**
- No valida QR ni ubicación
- No valida horarios ni días
- Ignora restricciones de fin de semana
- Puede registrar siempre como "puntual"

---

### Caso 3: Multi-Registro

**Usuario:** Un correo en `USUARIOS_MULTI_REGISTRO`

**Características:**
- Puede hacer múltiples entradas/salidas el mismo día
- Alterna automáticamente: entrada → salida → entrada → salida...

**Ejemplo:**
```
1er check-in: entrada
2do check-in: salida
3er check-in: entrada
4to check-in: salida
```

---

### Caso 4: Token Dinámico vs Estático

**Dinámico:**
- Se usa UNA sola vez
- Segunda validación: `"🚫 QR ya utilizado"`
- Ideal para uso individual

**Estático:**
- Múltiples usos permitidos
- No se marca como "usado"
- Ideal para un día completo en oficina

---

## 🔍 TROUBLESHOOTING

### Error: "No autorizado"

**Problema:** Token expirado o inválido

**Solución:**
1. Obtén un nuevo token de Firebase
2. Actualiza `{{AUTH_TOKEN}}` en Postman
3. Los tokens expiran después de 1 hora

---

### Error: "No autorizado para ver este historial"

**Problema:** Usuario normal tratando de ver historial de otro usuario

**Solución:**
- Usa tu propio UID: `/api/v1/attendance/history/{{USER_UID}}`
- O usa una cuenta admin

---

### Error: "Código QR es requerido"

**Problema:** Falta el campo `qrCode` en el body

**Solución:** Incluye siempre:
```json
{
  "qrCode": "OFICINA2025"
}
```

---

### Error: "No se pudo obtener tu ubicación"

**Problema:** Usuario normal sin campo `location`

**Solución:** Para usuarios normales (no remotos), incluye ubicación:
```json
{
  "qrCode": "OFICINA2025",
  "token": "...",
  "location": {
    "lat": 20.634503,
    "lng": -103.339386,
    "accuracy": 15
  }
}
```

---

### Error: "Solo puedes registrar entre 7:00 am y 10:00 pm"

**Problema:** Intentando registrar fuera del horario permitido

**Solución:**
- Espera al horario válido (7 AM - 10 PM)
- O agrega tu correo a `USUARIOS_MODO_PRUEBAS` para testing

---

### Error: "No puedes registrar asistencia en fin de semana"

**Problema:** Intentando registrar sábado o domingo

**Solución:**
- Espera a día hábil (lunes-viernes)
- O usa modo pruebas para testing

---

### Error: "Ya registraste entrada y salida hoy"

**Problema:** Ya hiciste tus 2 registros del día

**Solución:**
- Esto es el comportamiento correcto
- Si necesitas múltiples registros, pide que te agreguen a `USUARIOS_MULTI_REGISTRO`

---

## 📊 SECUENCIA DE PRUEBA COMPLETA

### Flujo Recomendado:

1. **Generar QR Token (Admin)**
   ```
   POST /api/v1/qr/generate
   ```
   → Guarda el `token` generado

2. **Validar QR**
   ```
   POST /api/v1/qr/validate
   ```
   → Verifica que el token sea válido

3. **Registrar Entrada**
   ```
   POST /api/v1/attendance/check-in
   ```
   → Usa el token válido + ubicación

4. **Ver Historial Personal**
   ```
   GET /api/v1/attendance/history/{{USER_UID}}
   ```

5. **Ver Asistencias del Día (Admin)**
   ```
   GET /api/v1/attendance/today
   ```

6. **Ver Estadísticas QR (Admin)**
   ```
   GET /api/v1/qr/stats
   ```

---

## ✅ CHECKLIST DE PRUEBAS

### QR Tokens:
- [ ] Obtener token actual
- [ ] Generar token dinámico
- [ ] Generar token estático
- [ ] Validar token válido
- [ ] Validar token expirado
- [ ] Validar token ya usado
- [ ] Obtener estadísticas

### Asistencias:
- [ ] Registrar entrada puntual
- [ ] Registrar entrada con retardo
- [ ] Registrar salida
- [ ] Intentar doble registro (debe fallar)
- [ ] Ver historial propio
- [ ] Ver historial de otro (admin)
- [ ] Ver asistencias semanales
- [ ] Ver asistencias del día (admin)

### Casos Especiales:
- [ ] Usuario remoto (sin QR/ubicación)
- [ ] Usuario modo pruebas
- [ ] Usuario multi-registro
- [ ] Token estático (múltiples usos)
- [ ] Fin de semana (debe bloquear)
- [ ] Fuera de horario (debe bloquear)

---

## 📞 SOPORTE

Si encuentras algún error no documentado:

1. Revisa los logs del servidor en la consola
2. Verifica que Firebase esté correctamente configurado
3. Confirma que tu usuario tenga los permisos necesarios
4. Revisa el archivo `backend/src/config/constants.js` para listas de usuarios especiales

---

**¡Listo para probar! 🚀**
