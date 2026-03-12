# 🔄 GUÍA DE MIGRACIÓN - FIRESTORE V1 → V2

Esta guía te ayudará a migrar tu base de datos de Firestore de la estructura actual (V1) a la nueva estructura optimizada (V2).

---

## 📋 PRE-REQUISITOS

Antes de empezar, asegúrate de:

- [ ] Tener acceso de administrador a Firestore
- [ ] Tener el archivo `firebase-service-account.json` en la raíz del proyecto
- [ ] Haber leído completamente `FIRESTORE_ESTRUCTURA_V2.md`
- [ ] Tener Node.js instalado (v16 o superior)
- [ ] **IMPORTANTE:** Hacer esto en un ambiente de DESARROLLO primero

---

## ⚠️ ADVERTENCIAS IMPORTANTES

### 🚨 LEE ESTO ANTES DE CONTINUAR

1. **BACKUP OBLIGATORIO**: Esta migración modificará tu base de datos. Crea un backup manual primero.
2. **TESTING**: Prueba la migración en un proyecto Firebase de desarrollo antes de hacerla en producción.
3. **TIEMPO DE INACTIVIDAD**: Durante la migración, el sistema estará parcialmente inoperable.
4. **IRREVERSIBLE**: Una vez completada, revertir la migración requiere restaurar el backup.
5. **VALIDACIÓN**: Después de la migración, valida los datos antes de eliminar las colecciones viejas.

---

## 🗓️ PLAN DE MIGRACIÓN RECOMENDADO

### Opción A: Ambiente de Desarrollo (RECOMENDADO)

```
1. Crear un nuevo proyecto Firebase para pruebas
2. Exportar datos de producción
3. Importar datos en proyecto de pruebas
4. Ejecutar migración en proyecto de pruebas
5. Validar datos migrados
6. Una vez validado, repetir en producción
```

### Opción B: Directamente en Producción (RIESGOSO)

```
1. Crear backup completo
2. Agendar ventana de mantenimiento (3-4 horas)
3. Detener aplicaciones frontend/backend
4. Ejecutar migración
5. Validar datos
6. Reiniciar aplicaciones
```

---

## 📝 PASO A PASO

### PASO 1: Preparación

#### 1.1. Crear backup manual en Firestore Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a Firestore Database
4. Usa la opción "Export" para exportar todas las colecciones
5. Guarda el backup en un lugar seguro

#### 1.2. Verificar dependencias

```bash
cd backend/scripts/migration
npm install firebase-admin
```

#### 1.3. Verificar archivo de service account

```bash
ls ../../../firebase-service-account.json
```

Si no existe, descárgalo desde:
Firebase Console → Project Settings → Service Accounts → Generate New Private Key

---

### PASO 2: Simulación (Dry Run)

Ejecuta la migración en modo **simulación** para ver qué haría sin escribir nada:

```bash
node migrate-firestore.js --dry-run
```

**Qué hace:**
- Lee todas las colecciones actuales
- Muestra cuántos documentos se migrarían
- Muestra estadísticas
- **NO escribe nada en Firestore**

**Qué buscar:**
- ✅ Número de documentos correcto
- ✅ No hay errores de lectura
- ✅ Las transformaciones se ven correctas

---

### PASO 3: Migración con Backup

Ejecuta la migración **REAL** con creación de backup automático:

```bash
node migrate-firestore.js --backup --execute
```

**Qué hace:**
1. Crea copias de seguridad en colecciones `_backup_*`
2. Lee colecciones antiguas
3. Transforma datos
4. Escribe en colecciones nuevas
5. Muestra estadísticas finales

**Duración estimada:** 5-30 minutos dependiendo del volumen de datos

**Salida esperada:**
```
🚀 MIGRACIÓN FIRESTORE V1 → V2
============================================================
Modo: ⚡ EJECUCIÓN REAL
Backup: ✅ Sí
============================================================

📘 [timestamp] 🔄 Creando backup de colecciones actuales...
✅ [timestamp] Backed up 25 documents from usuarios
✅ [timestamp] Backed up 1523 documents from registros
...

📘 [timestamp] 🔄 Migrando usuarios → employees
✅ [timestamp] Empleados migrados: 25 de 25

📘 [timestamp] 🔄 Migrando registros → attendance_events
✅ [timestamp] Eventos migrados: 1523 de 1523

📘 [timestamp] 🔄 Generando attendance_daily (consolidación)...
✅ [timestamp] Registros diarios creados: 382

...

============================================================
📊 ESTADÍSTICAS DE MIGRACIÓN
============================================================

employees:
  total: 25
  migrated: 25
  errors: 0

attendance_events:
  total: 1523
  migrated: 1523
  errors: 0

...

============================================================
✅ MIGRACIÓN COMPLETADA EXITOSAMENTE
⚠️  Verifica los datos en Firestore Console antes de eliminar colecciones antiguas
============================================================
```

---

### PASO 4: Configuración Inicial

Ahora crea los datos iniciales (roles, settings, permisos):

```bash
node setup-initial-data.js
```

**Qué hace:**
- Crea roles del sistema (super_admin, hr_manager, etc.)
- Crea configuración global (settings)
- Asigna permisos de super_admin a los emails especificados

**IMPORTANTE:** Antes de ejecutar, edita `setup-initial-data.js` línea 155:

```javascript
const ADMINS = [
  'sistemas16ch@gmail.com',        // ← Actualizar con tu email
  'administrador@cielitohome.com'  // ← Actualizar con tu email
];
```

---

### PASO 5: Crear Índices en Firestore

Los índices compuestos deben crearse manualmente en Firestore Console.

1. Ve a: [Firestore Indexes](https://console.firebase.google.com/project/_/firestore/indexes)
2. Haz clic en "Create Index"
3. Crea los siguientes índices:

#### Índice 1: employees (status + name)
- Collection: `employees`
- Fields:
  - `employment.status` (Ascending)
  - `personalInfo.fullName` (Ascending)

#### Índice 2: attendance_events (employee + date)
- Collection: `attendance_events`
- Fields:
  - `employeeId` (Ascending)
  - `eventDate` (Descending)

#### Índice 3: attendance_daily (employee + date)
- Collection: `attendance_daily`
- Fields:
  - `employeeId` (Ascending)
  - `date` (Descending)

#### Índice 4: attendance_daily (status + date)
- Collection: `attendance_daily`
- Fields:
  - `attendance.status` (Ascending)
  - `date` (Descending)

#### Índice 5: leave_requests (employee + status)
- Collection: `leave_requests`
- Fields:
  - `employeeId` (Ascending)
  - `approval.status` (Ascending)

#### Índice 6: audit_log (actor + time)
- Collection: `audit_log`
- Fields:
  - `actor.employeeId` (Ascending)
  - `timestamp` (Descending)

#### Índice 7: audit_log (category + time)
- Collection: `audit_log`
- Fields:
  - `category` (Ascending)
  - `timestamp` (Descending)

**Tiempo de creación:** Los índices pueden tardar 5-15 minutos en construirse.

---

### PASO 6: Validación de Datos

Valida manualmente en Firestore Console que los datos se migraron correctamente:

#### Checklist de Validación:

**Colección `employees`:**
- [ ] Cantidad de documentos = cantidad en `usuarios` vieja
- [ ] Abrir 3-5 documentos aleatorios
- [ ] Verificar que `personalInfo.email` corresponde con `correo` antiguo
- [ ] Verificar que `compensation.baseSalary` corresponde con `salarioQuincenal`
- [ ] Verificar que `employment.status` está correcto

**Colección `attendance_events`:**
- [ ] Cantidad de documentos = cantidad en `registros` vieja
- [ ] Verificar que `eventType` es "check_in" o "check_out"
- [ ] Verificar que `validation.isOnTime` corresponde con `puntual`

**Colección `attendance_daily`:**
- [ ] Existen registros consolidados
- [ ] Abrir 3-5 documentos
- [ ] Verificar que `attendance.checkIn` y `attendance.checkOut` están correctos
- [ ] Verificar que `attendance.hoursWorked` tiene sentido

**Colección `leave_requests`:**
- [ ] Cantidad de documentos = cantidad en `ausencias` vieja
- [ ] Verificar que `approval.status` es correcto

**Colección `holidays`:**
- [ ] Cantidad de documentos = cantidad en `dias_festivos` vieja
- [ ] Verificar fechas y nombres

**Colección `roles`:**
- [ ] Existen 5 roles (super_admin, hr_manager, hr_staff, department_manager, employee)

**Colección `settings`:**
- [ ] Existe documento `system` con configuración

**Permisos (subcollection):**
- [ ] Abrir un empleado admin
- [ ] Verificar que tiene subcollection `permissions`
- [ ] Verificar que tiene documento `super_admin`

---

### PASO 7: Actualizar Código de la Aplicación

Una vez validados los datos, actualiza el código backend para usar las nuevas colecciones.

#### 7.1. Actualizar constants.js

```javascript
// backend/src/config/constants.js

export const COLLECTIONS = {
  // ===== COLECCIONES NUEVAS (V2) =====
  EMPLOYEES: 'employees',
  ATTENDANCE_EVENTS: 'attendance_events',
  ATTENDANCE_DAILY: 'attendance_daily',
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_BALANCES: 'leave_balances',
  PAYROLL_PERIODS: 'payroll_periods',
  PAYROLL_ITEMS: 'payroll_items',
  HOLIDAYS: 'holidays',
  ROLES: 'roles',
  AUDIT_LOG: 'audit_log',
  INCIDENTS: 'incidents',
  SETTINGS: 'settings',
  QR_TOKENS: 'qr_tokens',

  // ===== COLECCIONES ANTIGUAS (DEPRECADAS) =====
  // USUARIOS: 'usuarios',  // ← Comentar después de migración
  // REGISTROS: 'registros',
  // AUSENCIAS: 'ausencias',
  // ...
};
```

#### 7.2. Actualizar servicios

Necesitarás actualizar los siguientes archivos:

- `backend/src/services/UserService.js` → usar `employees`
- `backend/src/services/AttendanceService.js` → usar `attendance_events` y `attendance_daily`
- `backend/src/services/AbsenceService.js` → usar `leave_requests` y `leave_balances`
- `backend/src/services/PayrollService.js` → usar `payroll_periods` y `payroll_items`

**NOTA:** Puedo ayudarte a actualizar estos servicios después de validar la migración.

---

### PASO 8: Testing de la Aplicación

Con las nuevas colecciones en su lugar:

1. **Reinicia el backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Prueba endpoints críticos:**
   - [ ] Login de usuario
   - [ ] Ver perfil de empleado
   - [ ] Ver asistencia del día
   - [ ] Ver asistencia histórica
   - [ ] Solicitar permiso/vacaciones
   - [ ] Generar reporte de asistencia

3. **Verifica logs del backend:**
   - No deben haber errores de colecciones no encontradas
   - Las queries deben funcionar correctamente

---

### PASO 9: Limpieza (OPCIONAL - DESPUÉS DE VALIDACIÓN COMPLETA)

**SOLO después de estar 100% seguro de que todo funciona correctamente:**

1. **Eliminar colecciones antiguas** (usuarios, registros, ausencias, etc.)
2. **Eliminar backups** (_backup_*)

**Recomendación:** Espera al menos 1-2 semanas de operación normal antes de hacer limpieza.

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "Firebase not initialized"

**Solución:**
```bash
# Verifica que existe el archivo
ls ../../../firebase-service-account.json

# Verifica permisos
chmod 600 ../../../firebase-service-account.json
```

### Error: "Permission denied" al escribir en Firestore

**Solución:**
- Verifica que el service account tenga rol "Firebase Admin SDK Administrator Service Agent"
- Ve a: Firebase Console → Project Settings → Service Accounts

### Error: "Index not found"

**Solución:**
- Algunos queries pueden fallar si los índices no están creados
- Crea los índices faltantes en Firestore Console
- Espera a que se construyan (5-15 min)

### La migración se detiene a mitad

**Solución:**
```bash
# Re-ejecutar con --execute
# El script es idempotente, puede ejecutarse varias veces
node migrate-firestore.js --execute
```

### Datos se ven incorrectos después de migración

**Solución:**
1. NO borres nada todavía
2. Las colecciones viejas siguen ahí (usuarios, registros, etc.)
3. Puedes restaurar desde el backup: `_backup_*`
4. O puedes re-ejecutar la migración después de corregir el problema

---

## 📞 SOPORTE

Si encuentras problemas durante la migración:

1. **NO elimines nada** hasta estar seguro
2. Revisa los logs del script
3. Verifica en Firestore Console qué se escribió
4. Los backups están en `_backup_*`

---

## ✅ CHECKLIST FINAL

- [ ] Backup manual creado
- [ ] Migración ejecutada sin errores
- [ ] Datos validados en Firestore Console
- [ ] Índices creados y construidos
- [ ] Setup inicial ejecutado (roles, settings)
- [ ] Código actualizado para usar nuevas colecciones
- [ ] Backend reiniciado y funcional
- [ ] Testing completo de la aplicación
- [ ] Todo funciona correctamente durante 1-2 semanas
- [ ] (OPCIONAL) Limpieza de colecciones antiguas

---

## 🎉 ¡LISTO!

Si completaste todos los pasos, tu base de datos ahora está usando la estructura V2 optimizada.

**Próximos pasos:**
- Implementar sistema de auditoría
- Implementar consolidación diaria automática (cron job)
- Implementar flujo de aprobación de vacaciones
- Mejorar sistema de roles y permisos

---

**¿Necesitas ayuda actualizando los servicios? Avísame y te ayudo con el código.**
