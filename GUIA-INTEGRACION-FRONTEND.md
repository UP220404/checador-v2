# 🎨 Guía de Integración Frontend - API Backend

**Fecha:** 1 de Diciembre de 2025
**Estado:** En progreso
**Objetivo:** Migrar frontend para usar API backend en lugar de Firebase directo

---

## ✅ LO QUE YA ESTÁ HECHO

1. ✅ **Backend API completo** (44 endpoints operativos)
2. ✅ **apiClient.js creado** (cliente HTTP centralizado)
3. ✅ **apiClient.js agregado** a index.html, admin.html, nomina.html

---

## 📋 LO QUE FALTA POR HACER

### 1. Actualizar `script.js` (Módulo de Asistencias)
### 2. Actualizar `admin.js` (Módulo de Admin + Ausencias)
### 3. Actualizar `nomina.js` (Módulo de Nómina)
### 4. Remover credenciales Firebase
### 5. Pruebas E2E

---

## 🔧 PREPARACIÓN

### Iniciar el Backend

**IMPORTANTE:** El backend DEBE estar corriendo para que el frontend funcione.

```bash
# Terminal 1: Backend
cd backend
npm run dev
```

Deberías ver:
```
🚀 Servidor corriendo en puerto 3000
✅ Firebase Admin inicializado correctamente
```

---

## 📝 1. ACTUALIZAR `script.js`

**Archivo:** `Checador QR/script.js`
**Líneas actuales:** ~1,119
**Líneas objetivo:** ~300-400

### Cambios necesarios:

#### A. Inicializar apiClient después del login

**BUSCAR** (alrededor de línea 50-100):
```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // ... código actual
  }
});
```

**AGREGAR** después del login exitoso:
```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Inicializar API client
    window.apiClient.initialize(auth);

    // Resto del código...
  }
});
```

---

#### B. Reemplazar registro de asistencia

**BUSCAR** (alrededor de línea 200-300):
```javascript
async function registrarEntrada() {
  // ... código que usa addDoc(collection(db, 'registros'))
}
```

**REEMPLAZAR CON:**
```javascript
async function registrarEntrada() {
  try {
    mostrarLoader();

    // Datos del registro
    const data = {
      email: user.email,
      nombre: user.displayName,
      qrToken: qrToken,
      ubicacion: {
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude
      },
      tipo: tipoRegistro // 'entrada' o 'salida'
    };

    // Llamar a la API
    const response = await window.apiClient.checkIn(data);

    if (response.success) {
      mostrarNotificacion(response.message, 'success');
      cargarHistorial(); // Recargar historial
    }

  } catch (error) {
    mostrarNotificacion(error.message, 'error');
  } finally{
    ocultarLoader();
  }
}
```

---

#### C. Reemplazar obtención de historial

**BUSCAR** (alrededor de línea 400-500):
```javascript
async function cargarHistorial() {
  // ... código que usa getDocs(query(collection(db, 'registros')))
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarHistorial() {
  try {
    const userId = auth.currentUser.uid;

    // Obtener historial semanal
    const response = await window.apiClient.getWeeklyAttendance(userId);

    if (response.success) {
      const registros = response.data;
      mostrarHistorial(registros);
    }

  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}
```

---

#### D. Remover importaciones de Firestore

**ELIMINAR** (al inicio del archivo):
```javascript
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs } from "...";
```

**MANTENER SOLO:**
```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
```

---

## 👥 2. ACTUALIZAR `admin.js`

**Archivo:** `Checador QR/admin.js`
**Líneas actuales:** ~3,330
**Líneas objetivo:** ~800-1000

### Cambios necesarios:

#### A. Inicializar apiClient

**AGREGAR** después del login (similar a script.js):
```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    window.apiClient.initialize(auth);
    // ... resto del código
  }
});
```

---

#### B. Reemplazar gestión de usuarios

**BUSCAR** (alrededor de línea 500-800):
```javascript
async function cargarUsuarios() {
  const snapshot = await getDocs(collection(db, 'usuarios'));
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarUsuarios() {
  try {
    const response = await window.apiClient.getUsers();

    if (response.success) {
      const usuarios = response.data;
      mostrarUsuarios(usuarios);
    }

  } catch (error) {
    mostrarNotificacion('Error cargando usuarios: ' + error.message, 'error');
  }
}
```

---

**BUSCAR:**
```javascript
async function crearUsuario(formData) {
  await addDoc(collection(db, 'usuarios'), formData);
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function crearUsuario(formData) {
  try {
    const response = await window.apiClient.createUser(formData);

    if (response.success) {
      mostrarNotificacion('Usuario creado correctamente', 'success');
      cargarUsuarios();
    }

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message, 'error');
  }
}
```

---

**BUSCAR:**
```javascript
async function actualizarUsuario(uid, formData) {
  await updateDoc(doc(db, 'usuarios', uid), formData);
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function actualizarUsuario(uid, formData) {
  try {
    const response = await window.apiClient.updateUser(uid, formData);

    if (response.success) {
      mostrarNotificacion('Usuario actualizado', 'success');
      cargarUsuarios();
    }

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message, 'error');
  }
}
```

---

#### C. Reemplazar gestión de ausencias

**BUSCAR** (alrededor de línea 1730-2700):
```javascript
async function cargarAusencias() {
  const q = query(collection(db, 'ausencias'), ...);
  const snapshot = await getDocs(q);
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarAusencias() {
  try {
    // Obtener filtros actuales
    const filtros = {
      estado: document.getElementById('filtroEstadoAusencia')?.value || '',
      tipo: document.getElementById('filtroTipoAusencia')?.value || ''
    };

    // Limpiar filtros vacíos
    Object.keys(filtros).forEach(key => {
      if (!filtros[key]) delete filtros[key];
    });

    const response = await window.apiClient.getAbsences(filtros);

    if (response.success) {
      ausenciasData = response.data;
      actualizarTablaAusencias();
      actualizarEstadisticasAusencias();
    }

  } catch (error) {
    mostrarNotificacion('Error cargando ausencias: ' + error.message, 'error');
  }
}
```

---

**BUSCAR:**
```javascript
async function manejarNuevaAusencia(e) {
  e.preventDefault();
  // ... código que usa addDoc(collection(db, 'ausencias'))
}
```

**REEMPLAZAR CON:**
```javascript
async function manejarNuevaAusencia(e) {
  e.preventDefault();

  try {
    const formData = {
      emailUsuario: document.getElementById('ausenciaUsuario').value,
      nombreUsuario: document.getElementById('ausenciaUsuario').selectedOptions[0]?.dataset.nombre,
      tipo: document.getElementById('ausenciaTipo').value,
      fechaInicio: document.getElementById('ausenciaFechaInicio').value,
      fechaFin: document.getElementById('ausenciaFechaFin').value || null,
      motivo: document.getElementById('ausenciaMotivo').value,
      estado: document.getElementById('ausenciaEstado').value
    };

    // Si es retardo justificado, agregar datos de corrección
    if (formData.tipo === 'retardo_justificado') {
      const retardoSeleccionado = document.querySelector('input[name="retardoSeleccionado"]:checked');
      if (retardoSeleccionado) {
        formData.correccionHora = {
          horaCorregida: document.getElementById('ausenciaHoraCorregida').value,
          fechaEntrada: document.getElementById('ausenciaFechaEntrada').value,
          registroId: retardoSeleccionado.value
        };
      }
    }

    const response = await window.apiClient.createAbsence(formData);

    if (response.success) {
      mostrarNotificacion('Ausencia creada correctamente', 'success');
      bootstrap.Modal.getInstance(document.getElementById('modalNuevaAusencia')).hide();
      document.getElementById('formNuevaAusencia').reset();
      cargarAusencias();
    }

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message, 'error');
  }
}
```

---

**BUSCAR:**
```javascript
async function aprobarAusencia(id) {
  await updateDoc(doc(db, 'ausencias', id), { estado: 'aprobado' });
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function aprobarAusencia(id) {
  try {
    const response = await window.apiClient.approveAbsence(id);

    if (response.success) {
      mostrarNotificacion('Ausencia aprobada', 'success');
      cargarAusencias();
    }

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message, 'error');
  }
}
```

---

**BUSCAR:**
```javascript
async function rechazarAusencia(id) {
  await updateDoc(doc(db, 'ausencias', id), { estado: 'rechazado' });
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function rechazarAusencia(id) {
  try {
    const comentarios = prompt('Comentarios (opcional):');
    const response = await window.apiClient.rejectAbsence(id, comentarios || '');

    if (response.success) {
      mostrarNotificacion('Ausencia rechazada', 'success');
      cargarAusencias();
    }

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message, 'error');
  }
}
```

---

#### D. Reemplazar obtención de registros (Dashboard)

**BUSCAR** (alrededor de línea 100-300):
```javascript
async function cargarDashboard() {
  const q = query(collection(db, 'registros'), ...);
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarDashboard() {
  try {
    const response = await window.apiClient.getTodayAttendance();

    if (response.success) {
      const registros = response.data;
      actualizarEstadisticas(registros);
    }

  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}
```

---

## 💰 3. ACTUALIZAR `nomina.js`

**Archivo:** `Checador QR/nomina.js`
**Líneas actuales:** ~4,333
**Líneas objetivo:** ~500-700

### Cambios necesarios:

#### A. Inicializar apiClient

**AGREGAR** después del login:
```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    window.apiClient.initialize(auth);
    // ... resto del código
  }
});
```

---

#### B. Reemplazar carga de empleados

**BUSCAR** (alrededor de línea 200-400):
```javascript
async function cargarEmpleados() {
  const snapshot = await getDocs(collection(db, 'usuarios'));
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarEmpleados() {
  try {
    const response = await window.apiClient.getPayrollEmployees();

    if (response.success) {
      empleados = response.data;
      // Procesar empleados...
    }

  } catch (error) {
    mostrarNotificacion('Error cargando empleados: ' + error.message, 'error');
  }
}
```

---

#### C. Reemplazar cálculo de nómina

**BUSCAR** (alrededor de línea 800-1500):
```javascript
async function calcularNomina() {
  // ... todo el código de cálculo (¡MUCHO código!)

  // Al final:
  await addDoc(collection(db, 'nominas'), nominaData);
}
```

**REEMPLAZAR CON:**
```javascript
async function calcularNomina() {
  try {
    mostrarLoader('Calculando nómina...');

    const mesSelect = document.getElementById('mesNomina').value;
    const añoSelect = document.getElementById('añoNomina').value;
    const quinceSelect = document.getElementById('quincenaNomina').value;
    const tipoNomina = document.querySelector('input[name="tipoNomina"]:checked').value;

    // Preparar datos
    const data = {
      mes: parseInt(mesSelect),
      anio: parseInt(añoSelect),
      tipo: tipoNomina, // 'quincenal' o 'semanal'
      periodo: quinceSelect // 'primera', 'segunda', o número de semana
    };

    // Calcular en backend
    const response = await window.apiClient.calculatePayroll(data);

    if (response.success) {
      resultadosNomina = response.data.empleados;
      periodoActual = response.data.periodo;

      mostrarResultados();
      mostrarNotificacion('Nómina calculada correctamente', 'success');
    }

  } catch (error) {
    mostrarNotificacion('Error calculando nómina: ' + error.message, 'error');
  } finally {
    ocultarLoader();
  }
}
```

---

#### D. Reemplazar guardar nómina

**BUSCAR** (alrededor de línea 2000-2100):
```javascript
async function guardarNomina() {
  await addDoc(collection(db, 'nominas'), nominaData);
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function guardarNomina() {
  try {
    mostrarLoader('Guardando nómina...');

    const mesSelect = document.getElementById('mesNomina').value;
    const añoSelect = document.getElementById('añoNomina').value;
    const quinceSelect = document.getElementById('quincenaNomina').value;
    const tipoNomina = document.querySelector('input[name="tipoNomina"]:checked').value;

    const data = {
      mes: parseInt(mesSelect),
      anio: parseInt(añoSelect),
      tipo: tipoNomina,
      periodo: quinceSelect
    };

    // Calcular Y guardar en un solo paso
    const response = await window.apiClient.calculateAndSavePayroll(data);

    if (response.success) {
      mostrarNotificacion('Nómina guardada correctamente', 'success');
      resultadosNomina = response.data.nomina.empleados;
      mostrarResultados();
    }

  } catch (error) {
    mostrarNotificacion('Error guardando nómina: ' + error.message, 'error');
  } finally {
    ocultarLoader();
  }
}
```

---

#### E. Reemplazar cargar nómina guardada

**BUSCAR** (alrededor de línea 2200-2300):
```javascript
async function cargarNominaGuardada() {
  const doc = await getDoc(doc(db, 'nominas', periodoId));
  // ...
}
```

**REEMPLAZAR CON:**
```javascript
async function cargarNominaGuardada(periodoId) {
  try {
    mostrarLoader('Cargando nómina...');

    const response = await window.apiClient.getPayroll(periodoId);

    if (response.success) {
      const nomina = response.data;
      resultadosNomina = nomina.empleados;
      periodoActual = nomina.periodo;

      mostrarResultados();
    }

  } catch (error) {
    mostrarNotificacion('Error cargando nómina: ' + error.message, 'error');
  } finally {
    ocultarLoader();
  }
}
```

---

#### F. Reemplazar exportar Excel

**BUSCAR** (alrededor de línea 2263-2340):
```javascript
window.exportarExcel = function() {
  // ... todo el código de generación de Excel (~80 líneas)
}
```

**REEMPLAZAR CON:**
```javascript
window.exportarExcel = async function() {
  try {
    if (!periodoActual || !periodoActual.periodoId) {
      mostrarNotificacion('Primero calcula o carga una nómina', 'warning');
      return;
    }

    mostrarLoader('Generando Excel...');

    // La API genera y descarga automáticamente
    await window.apiClient.exportPayrollExcel(periodoActual.periodoId);

    mostrarNotificacion('Excel descargado correctamente', 'success');

  } catch (error) {
    mostrarNotificacion('Error exportando Excel: ' + error.message, 'error');
  } finally {
    ocultarLoader();
  }
}
```

---

## 🗑️ 4. REMOVER CREDENCIALES FIREBASE

### A. En cada archivo `.js`:

**BUSCAR Y ELIMINAR:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "...",
  projectId: "...",
  // ... etc
};
```

**NOTA:** ¡NO eliminar el import y initialize de Firebase Auth! Solo se necesita para autenticación.

---

### B. Mantener solo Auth:

**EN `script.js`, `admin.js`, `nomina.js` MANTENER:**
```javascript
import { initializeApp } from "...firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "...firebase-auth.js";

const firebaseConfig = {
  // ... credenciales (MANTENER para auth)
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

**ELIMINAR:**
```javascript
import { getFirestore, collection, addDoc, getDocs, query, where, ... } from "...firebase-firestore.js";

const db = getFirestore(app);
```

---

## ✅ CHECKLIST DE INTEGRACIÓN

### script.js (Asistencias)
- [ ] Inicializar apiClient después del login
- [ ] Reemplazar `registrarEntrada()` con `apiClient.checkIn()`
- [ ] Reemplazar `cargarHistorial()` con `apiClient.getWeeklyAttendance()`
- [ ] Eliminar imports de Firestore
- [ ] Probar login
- [ ] Probar registro de entrada
- [ ] Probar registro de salida
- [ ] Probar historial

### admin.js (Admin + Ausencias)
- [ ] Inicializar apiClient después del login
- [ ] Reemplazar `cargarUsuarios()` con `apiClient.getUsers()`
- [ ] Reemplazar `crearUsuario()` con `apiClient.createUser()`
- [ ] Reemplazar `actualizarUsuario()` con `apiClient.updateUser()`
- [ ] Reemplazar `eliminarUsuario()` con `apiClient.deleteUser()`
- [ ] Reemplazar `cargarAusencias()` con `apiClient.getAbsences()`
- [ ] Reemplazar `crearAusencia()` con `apiClient.createAbsence()`
- [ ] Reemplazar `aprobarAusencia()` con `apiClient.approveAbsence()`
- [ ] Reemplazar `rechazarAusencia()` con `apiClient.rejectAbsence()`
- [ ] Reemplazar `cargarDashboard()` con `apiClient.getTodayAttendance()`
- [ ] Eliminar imports de Firestore
- [ ] Probar gestión de usuarios
- [ ] Probar gestión de ausencias
- [ ] Probar dashboard

### nomina.js (Nómina)
- [ ] Inicializar apiClient después del login
- [ ] Reemplazar `cargarEmpleados()` con `apiClient.getPayrollEmployees()`
- [ ] Reemplazar `calcularNomina()` con `apiClient.calculatePayroll()`
- [ ] Reemplazar `guardarNomina()` con `apiClient.calculateAndSavePayroll()`
- [ ] Reemplazar `cargarNominaGuardada()` con `apiClient.getPayroll()`
- [ ] Reemplazar `exportarExcel()` con `apiClient.exportPayrollExcel()`
- [ ] Eliminar imports de Firestore
- [ ] Probar cálculo de nómina
- [ ] Probar guardar nómina
- [ ] Probar cargar nómina guardada
- [ ] Probar exportar Excel

### General
- [ ] Remover credenciales Firebase (excepto auth)
- [ ] Verificar que NO queden llamadas directas a Firestore
- [ ] Verificar que backend está corriendo
- [ ] Probar flujo completo E2E

---

## 🚨 ERRORES COMUNES

### 1. "apiClient is not defined"
**Causa:** No se inicializó apiClient
**Solución:** Agregar `window.apiClient.initialize(auth)` después del login

### 2. "Failed to fetch" o "ERR_CONNECTION_REFUSED"
**Causa:** Backend no está corriendo
**Solución:** Iniciar backend con `npm run dev`

### 3. "401 Unauthorized"
**Causa:** Token no está siendo enviado
**Solución:** Verificar que `getToken()` se llama correctamente

### 4. "403 Forbidden"
**Causa:** Usuario no es admin
**Solución:** Verificar que email está en `ADMIN_EMAILS` en `.env`

### 5. "CORS error"
**Causa:** Backend no acepta requests del origen
**Solución:** Verificar configuración de CORS en `backend/src/app.js`

---

## 📊 PROGRESO ESTIMADO

**Tiempo estimado por archivo:**
- script.js: 2-3 horas
- admin.js: 4-5 horas (más complejo)
- nomina.js: 3-4 horas
- **Total: 9-12 horas**

**Recomendación:** Hacer un archivo a la vez y probar antes de continuar.

---

## 🎯 ORDEN RECOMENDADO

1. **script.js primero** (más sencillo, prueba básica del apiClient)
2. **admin.js segundo** (más complejo, múltiples módulos)
3. **nomina.js tercero** (el más grande, pero más directo)

---

**¡Éxito con la integración! 🚀**
