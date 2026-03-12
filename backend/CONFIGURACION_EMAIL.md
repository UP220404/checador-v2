# 📧 Configuración de Envío de Correos Electrónicos

Este documento explica cómo funciona el envío de nóminas por correo electrónico usando EmailJS.

## ⚙️ Configuración

### 1. EmailJS (Configuración Actual)

El sistema utiliza **EmailJS** para enviar correos electrónicos directamente desde el navegador. La configuración ya está preestablecida:

**Credenciales configuradas:**
- **USER_ID**: `TsUC1dOMXmxb4h00Y`
- **SERVICE_ID**: `service_je1e978`
- **TEMPLATE_ID**: `template_vobe2vd`
- **FROM_EMAIL**: `sistemas16ch@gmail.com`
- **FROM_NAME**: `Cielito Home - Nómina`

**Archivo de configuración:**
- `frontend/src/config/emailConfig.js` - Contiene las credenciales de EmailJS
- `frontend/src/services/emailService.js` - Servicio para envío de correos

### 2. Ventajas de EmailJS

- ✅ **Sin servidor SMTP**: No requiere configuración de servidor
- ✅ **Cliente-side**: Envío directo desde el navegador
- ✅ **Seguro**: No expone credenciales en el backend
- ✅ **Límite diario**: 200 correos por día
- ✅ **Throttling**: 1 segundo entre cada envío para evitar spam

### 3. Gestión de la Cuenta EmailJS

Para administrar o modificar la configuración:

1. Inicia sesión en https://www.emailjs.com/
2. Usa la cuenta asociada a `sistemas16ch@gmail.com`
3. Puedes ver:
   - Estadísticas de envío
   - Historial de correos
   - Modificar templates
   - Ver límites de uso

## 📨 Cómo Usar

### Desde el Frontend

1. Calcula la nómina del período deseado
2. Verifica que todos los datos sean correctos
3. Haz clic en el botón **"Enviar por Correo"** (botón morado)
4. Confirma el envío en el cuadro de diálogo
5. Espera a que se envíen todos los correos

### Formato del Correo

Cada empleado recibirá un correo con:
- **Asunto**: Nómina Primera/Segunda Quincena - Mes Año
- **Contenido en texto plano** con:
  - Saludo personalizado
  - Período de nómina
  - Resumen detallado:
    - Días trabajados, retardos, faltas, días efectivos
    - Salario base quincenal y pago por día
    - Subtotal
    - Descuentos (IMSS, Caja de Ahorro) si aplican
    - **Total a pagar** (destacado)
  - Alertas de descuentos por retardos (si aplica)
  - Información de contacto

## 🔍 Verificación

### Logs de la Consola del Navegador

Al enviar correos, verás logs en la consola del navegador:

```
✅ EmailJS inicializado correctamente
📧 Iniciando envío de 15 nóminas por correo...
📧 Enviando email a: empleado1@email.com
✅ Email enviado exitosamente a: empleado1@email.com
📧 Enviando email a: empleado2@email.com
✅ Email enviado exitosamente a: empleado2@email.com
...
✅ Envío completado: 15 exitosos, 0 fallidos
```

### Verificar Estado en EmailJS Dashboard

1. Ve a https://dashboard.emailjs.com/
2. Inicia sesión con la cuenta de `sistemas16ch@gmail.com`
3. Revisa la sección "Email History" para ver los correos enviados
4. Monitorea el uso diario en "Analytics"

## ⚠️ Solución de Problemas

### Error: "EmailJS no está configurado correctamente"
- **Causa**: Credenciales inválidas o servicio no disponible
- **Solución**: Verifica que las credenciales en `emailConfig.js` sean correctas

### Error: "Email del empleado inválido"
- **Causa**: Email mal formado o vacío
- **Solución**: Verifica que el empleado tenga un email válido configurado

### Error: "Failed to send email"
- **Causa**: Problema con el servicio EmailJS o límite alcanzado
- **Solución**:
  - Revisa el dashboard de EmailJS
  - Verifica que no hayas excedido el límite diario (200 emails)
  - Espera unos minutos e intenta nuevamente

### Algunos correos no se envían
- **Causa**: Empleados sin email configurado
- **Solución**: Verifica que todos los empleados tengan un email válido en su perfil

## 📋 Notas Importantes

1. **Límites de envío**: EmailJS tiene límite de 200 correos por día en plan gratuito
2. **Pausa entre envíos**: El sistema espera 1 segundo entre cada correo para evitar spam
3. **Verificación**: Siempre verifica que los datos de nómina sean correctos ANTES de enviar
4. **Backup**: Considera exportar a Excel antes de enviar correos
5. **Sin backend**: Los correos se envían directamente desde el navegador

## 🔒 Seguridad

- **NUNCA** compartas las credenciales de EmailJS públicamente
- Las credenciales están en el código del frontend (client-side), lo cual es seguro para EmailJS
- EmailJS gestiona la seguridad y prevención de spam en su plataforma
- Usa solo cuentas de correo corporativas verificadas

## ✅ Checklist de Configuración

- [x] Cuenta EmailJS configurada con `sistemas16ch@gmail.com`
- [x] Credenciales de EmailJS en `frontend/src/config/emailConfig.js`
- [x] Template de email configurado en EmailJS (ID: `template_vobe2vd`)
- [x] Servicio de email activo (ID: `service_je1e978`)
- [ ] Prueba de envío realizada con 1-2 empleados
- [ ] Todos los empleados tienen email configurado
- [ ] Verificar límite diario en dashboard de EmailJS
