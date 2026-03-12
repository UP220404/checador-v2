# 🔑 Cómo Obtener Token de Firebase para Postman

## 🚀 Opción 1: Usando el archivo HTML (MÁS FÁCIL)

1. **Hacer doble click en el archivo:**
   ```
   obtener-token-RAPIDO.bat
   ```

2. **En el navegador que se abre:**
   - Click en "Iniciar Sesión con Google"
   - Usa una cuenta ADMIN (sistemas16ch@gmail.com, etc.)
   - Click en "Obtener Token"
   - Click en "Copiar Token"

3. **En Postman:**
   - Ve a Headers
   - Agrega: `Authorization: Bearer [pegar token aquí]`

---

## 🌐 Opción 2: Desde el Sistema Deployado

1. **Ir al sistema en producción:**
   ```
   https://qr-acceso-cielito-home.web.app/admin.html
   ```

2. **Iniciar sesión con Google**

3. **Abrir consola del navegador** (F12)

4. **Ejecutar este código en la consola:**
   ```javascript
   firebase.auth().currentUser.getIdToken().then(token => {
     console.log("=== TU TOKEN ===");
     console.log(token);
     console.log("=== FIN DEL TOKEN ===");

     // También copiarlo al portapapeles
     navigator.clipboard.writeText(token);
     alert("✅ Token copiado al portapapeles!");
   });
   ```

5. **Copiar el token de la consola**

---

## 📱 Opción 3: Desde el Frontend Local

1. **Abrir el archivo index.html local:**
   ```
   Checador QR/index.html
   ```

2. **Iniciar sesión con Google**

3. **Abrir consola (F12)**

4. **Ejecutar el mismo código:**
   ```javascript
   firebase.auth().currentUser.getIdToken().then(token => {
     console.log(token);
     navigator.clipboard.writeText(token);
     alert("Token copiado!");
   });
   ```

---

## ⚠️ IMPORTANTE

- **El token expira después de 1 HORA**
- Tendrás que generar un nuevo token cada hora
- Usa una cuenta que esté en `ADMIN_EMAILS` del archivo `.env`

---

## 🧪 Verificar que el Token Funciona

### En Postman:

**1. Probar Health Check (sin token):**
```
GET http://localhost:3000/health
```
✅ Debe responder 200 OK

**2. Probar endpoint con token:**
```
GET http://localhost:3000/api/v1/users

Headers:
Authorization: Bearer [tu_token]
```
✅ Debe responder 200 OK con lista de usuarios

**3. Si obtienes 401 Unauthorized:**
- Verifica que incluiste `Bearer ` antes del token
- Verifica que el token no tenga espacios extras
- Genera un nuevo token (puede haber expirado)

**4. Si obtienes 403 Forbidden:**
- El usuario NO es admin
- Verifica que tu email esté en `ADMIN_EMAILS` en `.env`
- Reinicia el servidor después de modificar `.env`

---

## 📝 Emails de Admin Configurados

Según tu archivo `.env`:
```
sistemas16ch@gmail.com
leticia@cielitohome.com
direcciongeneral@cielitohome.com
```

Solo estos emails pueden usar endpoints de admin.

---

## 🔄 Si el Token Expira

**Síntomas:**
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```

**Solución:**
Ejecuta nuevamente el código en la consola para obtener un token fresco.

---

## 💡 Tip: Crear Variable en Postman

Para no tener que pegar el token cada vez:

1. En Postman, click en el ícono del ojo (👁️)
2. Click en "Edit" junto al environment
3. Agregar variable:
   - Variable: `AUTH_TOKEN`
   - Value: [pegar token aquí]
4. En los headers usar: `Bearer {{AUTH_TOKEN}}`

Así solo actualizas la variable cuando el token expire.

---

**¿Listo para probar el backend? 🚀**
