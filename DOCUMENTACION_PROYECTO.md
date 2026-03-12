123# DOCUMENTACION COMPLETA - SISTEMA DE CHECADOR v2

> Documento de referencia para desarrollo y mantenimiento del sistema.
> Ultima actualizacion: 30 de enero de 2026

---

## 1. RESUMEN EJECUTIVO

Sistema profesional de **control de asistencia y nomina** para Cielito Home con:
- **Backend**: Node.js + Express + Firebase
- **Frontend**: React 19 + Vite + Bootstrap
- **Base de datos**: Firestore (NoSQL)
- **Autenticacion**: Firebase Auth (Google OAuth 2.0)

---

## 2. ARQUITECTURA DEL PROYECTO

```
Checador Version 2/
├── backend/                    # API REST con Node.js + Express
│   └── src/
│       ├── config/             # Firebase y constantes
│       ├── routes/             # Definicion de endpoints
│       ├── controllers/        # Logica de control HTTP
│       ├── services/           # Logica de negocio
│       ├── middleware/         # Auth y roles
│       └── utils/              # Funciones auxiliares
├── frontend/                   # React + Vite SPA
│   └── src/
│       ├── pages/              # 13 paginas principales
│       ├── components/         # Componentes reutilizables
│       ├── services/           # Cliente API (axios)
│       ├── config/             # Firebase cliente
│       └── styles/             # CSS
├── Codigo antiguo/             # Sistema legacy (referencia)
└── Documentacion/              # Guias adicionales
```

---

## 3. TECNOLOGIAS UTILIZADAS

### Backend
| Tecnologia | Version | Uso |
|------------|---------|-----|
| Node.js | ES6 modules | Runtime |
| Express.js | 4.18.2 | Framework HTTP |
| Firebase Admin | 12.0.0 | BD y Auth servidor |
| Helmet.js | 7.1.0 | Seguridad headers |
| Nodemailer | 6.10.1 | Envio de emails |
| ExcelJS | 4.4.0 | Generacion Excel |
| PDFKit | 0.14.0 | Generacion PDF |
| Joi | 17.11.0 | Validacion datos |

### Frontend
| Tecnologia | Version | Uso |
|------------|---------|-----|
| React | 19.2.0 | Framework UI |
| Vite | 7.2.4 | Build tool |
| React Router | 7.10.0 | Routing |
| Bootstrap | 5.3.8 | Estilos |
| Chart.js | - | Graficos |
| Axios | - | Cliente HTTP |
| Firebase SDK | 11.7.1 | Auth cliente |

---

## 4. SISTEMA DE ROLES Y PERMISOS

### Roles Disponibles
```javascript
ROLES = {
  EMPLEADO: 'empleado',       // Usuario normal
  ADMIN_AREA: 'admin_area',   // Admin de departamento
  ADMIN_RH: 'admin_rh'        // Admin total
}
```

### Matriz de Permisos
| Funcionalidad | Empleado | Admin Area | Admin RH |
|---------------|----------|------------|----------|
| Registrar asistencia | ✅ | ✅ | ✅ |
| Ver su perfil | ✅ | ✅ | ✅ |
| Solicitar ausencias | ✅ | ✅ | ✅ |
| Ver usuarios | ❌ | Su depto | ✅ |
| Crear usuarios | ❌ | ❌ | ✅ |
| Ver reportes | ❌ | Su depto | ✅ |
| Gestionar nomina | ❌ | ❌ | ✅ |
| Aprobar ausencias | ❌ | Su depto | ✅ |
| Configuracion sistema | ❌ | ❌ | ✅ |

---

## 5. ENDPOINTS DEL BACKEND

### Base URL: `http://localhost:3001/api/v1`

### Usuarios
```
GET    /users                    # Listar usuarios
GET    /users/:uid               # Obtener usuario
POST   /users                    # Crear usuario (admin)
PUT    /users/:uid               # Actualizar usuario
DELETE /users/:uid               # Eliminar usuario
GET    /users/me/role            # Mi rol
PUT    /users/:uid/profile       # Actualizar mi perfil
GET    /users/:uid/payroll-config # Config nomina
PUT    /users/:uid/payroll-config # Actualizar config nomina
```

### Asistencias
```
POST   /attendance/check-in      # Registrar entrada/salida
GET    /attendance/history/:userId # Historial
GET    /attendance/weekly/:userId  # Semanal
GET    /attendance/today         # Hoy (admin)
```

### QR
```
GET    /qr/current               # Token actual
POST   /qr/generate              # Generar nuevo (admin)
POST   /qr/validate              # Validar token
GET    /qr/stats                 # Estadisticas
```

### Ausencias
```
# Empleados
POST   /absences/request         # Crear solicitud
GET    /absences/my-requests     # Mis solicitudes
DELETE /absences/my-requests/:id # Cancelar

# Admins
GET    /absences                 # Listar todas
GET    /absences/:id             # Obtener una
POST   /absences                 # Crear
PUT    /absences/:id             # Actualizar
PUT    /absences/:id/approve     # Aprobar
PUT    /absences/:id/reject      # Rechazar
DELETE /absences/:id             # Eliminar
GET    /absences/stats           # Estadisticas
```

### Nomina
```
POST   /payroll/validate-password # Validar acceso
POST   /payroll/calculate        # Calcular (preview)
POST   /payroll/calculate-and-save # Calcular y guardar
POST   /payroll/save             # Guardar
GET    /payroll/employees        # Empleados con config
GET    /payroll/period/:mes/:anio # Nominas del periodo
GET    /payroll/:periodoId       # Obtener nomina
PUT    /payroll/:periodoId/employee/:empleadoId/concept # Editar concepto
POST   /payroll/holidays         # Crear festivo
GET    /payroll/holidays/:anio   # Festivos del año
DELETE /payroll/holidays/:festivoId # Eliminar festivo
POST   /payroll/send-emails      # Enviar por email
```

### Reportes
```
GET    /reports/daily            # Reporte diario
GET    /reports/weekly           # Reporte semanal
GET    /reports/absences         # Reporte ausencias
GET    /reports/payroll/:periodoId # Reporte nomina
GET    /reports/export/attendance-excel # Excel asistencias
GET    /reports/export/payroll-excel/:periodoId # Excel nomina
GET    /reports/export/absences-pdf # PDF ausencias
POST   /reports/generate-rankings # Rankings
GET    /reports/analytics        # Analytics
```

### Configuracion
```
GET    /settings                 # Todas las configs
GET    /settings/:category       # Config por categoria
PUT    /settings/:category       # Actualizar config
```

---

## 6. MODELO DE DATOS (FIRESTORE)

### Coleccion: `usuarios`
```javascript
{
  uid: string,                  // Firebase UID (doc ID)
  correo: string,               // Email unico
  nombre: string,
  departamento: string,
  tipo: 'becario|tiempo_completo|especial|horario_especial',
  role: 'empleado|admin_area|admin_rh',

  // Compensacion
  salarioQuincenal: number,
  horasQuincenal: number,
  tipoNomina: 'quincenal|semanal',
  tieneIMSS: boolean,
  tieneCajaAhorro: boolean,
  montoCajaAhorro: number,

  // Datos bancarios
  cuentaBancaria: string,
  nombreBanco: string,

  // Contacto
  telefono: string,
  direccion: string,
  contactoEmergencia: string,

  fechaCreacion: Timestamp,
  activo: boolean
}
```

### Coleccion: `registros`
```javascript
{
  uid: string,                  // Usuario UID
  fechaRegistro: string,        // YYYY-MM-DD
  horaRegistro: string,         // HH:MM:SS
  tipo: 'entrada|salida',
  puntualidad: 'puntual|retardo',
  minutosRetardo: number,

  qrValido: boolean,
  ubicacionValida: boolean,

  ubicacion: {
    lat: number,
    lng: number,
    accuracy: number,
    distancia: number
  },

  timestamp: Timestamp
}
```

### Coleccion: `ausencias`
```javascript
{
  emailUsuario: string,
  nombreUsuario: string,
  tipo: 'permiso_con_goce|permiso_sin_goce|vacaciones|incapacidad|retardo_justificado|falta_justificada',
  fechaInicio: string,          // YYYY-MM-DD
  fechaFin: string,
  motivo: string,

  estado: 'pendiente|aprobada|rechazada',
  comentariosAdmin: string,

  quincena: { periodo, mes, anio },
  diasJustificados: number,

  aplicadaEnNomina: boolean,
  fechaCreacion: Timestamp
}
```

### Coleccion: `nominas`
```javascript
{
  periodo: {
    mes: number,
    anio: number,
    quincena: 'primera|segunda'
  },

  tipoNomina: 'quincenal|semanal',
  estado: 'borrador|calculada|guardada|pagada',

  empleados: [{
    uid: string,
    nombre: string,
    diasLaborados: number,
    retardos: number,
    descuentoRetardos: number,
    salarioBruto: number,
    descuentoIMSS: number,
    descuentoCajaAhorro: number,
    conceptosAdicionales: [{ nombre, valor }],
    salarioNeto: number
  }],

  totalPagar: number,
  fechaCalculo: Timestamp
}
```

### Coleccion: `qr_tokens`
```javascript
{
  token: string,                // Token unico
  qrCode: string,               // Prefijo 'OFICINA2025'
  modo: 'dinamico|estatico',
  fechaCreacion: Timestamp,
  expiracion: Timestamp,        // 5 minutos
  estadisticas: { usos, bloqueados }
}
```

### Coleccion: `dias_festivos`
```javascript
{
  fecha: string,                // YYYY-MM-DD
  nombre: string,
  tipo: 'federal|corporativo',
  fechaCreacion: Timestamp
}
```

---

## 7. RUTAS DEL FRONTEND

```
/                               # Checador (check-in/out)
/login                          # Autenticacion Google
/empleado/portal                # Portal del empleado

# Rutas Admin (requieren auth + rol admin)
/admin/dashboard                # Dashboard principal
/admin/usuarios                 # Gestionar usuarios
/admin/registros                # Ver asistencias
/admin/reportes                 # Generar reportes
/admin/analisis                 # Analisis estadisticos
/admin/ausencias                # Gestionar ausencias
/admin/nomina                   # Nomina
/admin/qr                       # Generador QR
/admin/seguridad                # Configuracion seguridad
/admin/configuracion            # Configuracion general
```

---

## 8. CONSTANTES DE CONFIGURACION

```javascript
// backend/src/config/constants.js

CONFIG = {
  MODO_PRUEBAS: false,

  // Horarios
  HORA_LIMITE_ENTRADA: { hours: 8, minutes: 10 },
  HORA_LIMITE_SALIDA_EMPLEADO: { hours: 16, minutes: 0 },
  HORA_INICIO_REGISTRO: { hours: 7, minutes: 0 },
  HORA_FIN_REGISTRO: { hours: 22, minutes: 0 },

  // Geolocalizacion - Oficina Aguascalientes
  OFICINA: {
    lat: 21.92545657925517,
    lng: -102.31327431392519,
    radio_metros: 40
  },

  // QR
  QR_TOKEN_EXPIRATION_MINUTES: 5,
  QR_CODE_PREFIX: 'OFICINA2025',

  // Nomina
  DESCUENTO_POR_RETARDO: 50,    // Pesos
  RETARDOS_PARA_DESCUENTO: 3,
  DESCUENTO_IMSS: 300
};

// Tipos de usuario
TIPOS_USUARIO = ['becario', 'tiempo_completo', 'especial', 'horario_especial'];

// Tipos de ausencia
TIPOS_AUSENCIA = ['permiso', 'vacaciones', 'incapacidad', 'viaje_negocios', 'retardo_justificado', 'justificante'];

// Usuarios remotos (sin validacion de ubicacion)
USUARIOS_REMOTOS = [
  'sistemas20cielitoh@gmail.com',
  'operacionescielitoh@gmail.com',
  'atencionmedicacielitoh@gmail.com'
];

// Usuarios con multi-registro permitido
USUARIOS_MULTI_REGISTRO = ['sistemas16ch@gmail.com'];
```

---

## 9. VARIABLES DE ENTORNO

### Backend (.env)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,...
ADMIN_EMAILS=sistemas16ch@gmail.com,leticia@cielitohome.com
PAYROLL_PASSWORD=CielitoNomina2025!
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<password>
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api/v1
```

---

## 10. MODULOS IMPLEMENTADOS

| Modulo | Estado | Descripcion |
|--------|--------|-------------|
| Autenticacion | ✅ | Google OAuth 2.0 via Firebase |
| Check-in/out | ✅ | QR + Geolocalizacion + Horarios |
| Usuarios | ✅ | CRUD completo con roles |
| Asistencias | ✅ | Historial, filtros, reportes |
| Ausencias | ✅ | Solicitudes, aprobaciones, integracion nomina |
| Nomina | ✅ | Calculo automatico, conceptos, export |
| Reportes | ✅ | Excel, PDF, analytics |
| QR | ✅ | Tokens dinamicos, validacion |
| Seguridad | ✅ | Geoloc, RBAC, rate limiting |

---

## 11. FLUJOS DE TRABAJO

### Registro de Asistencia
1. Usuario accede a `/` (Checador)
2. Autentica con Google
3. Escanea codigo QR
4. Sistema valida: token QR + ubicacion + horario
5. Registra entrada/salida en Firestore
6. Muestra confirmacion

### Solicitud de Ausencia
1. Empleado va a Portal del Empleado
2. Crea nueva solicitud (tipo, fechas, motivo)
3. Admin recibe notificacion
4. Admin aprueba/rechaza
5. Se aplica automaticamente en nomina

### Calculo de Nomina
1. Admin va a `/admin/nomina`
2. Selecciona periodo (mes/quincena)
3. Valida contrasena de acceso
4. Sistema calcula: dias laborados, retardos, descuentos, ausencias
5. Admin revisa y guarda
6. Opcionalmente envia por email

---

## 12. ARCHIVOS CLAVE

### Backend
```
backend/src/app.js              # Configuracion Express
backend/src/server.js           # Entry point
backend/src/config/firebase.js  # Firebase Admin SDK
backend/src/config/constants.js # Constantes del sistema
backend/src/middleware/auth.middleware.js    # Autenticacion
backend/src/middleware/role.middleware.js    # Autorizacion
backend/src/services/           # Logica de negocio
backend/src/controllers/        # Controladores HTTP
backend/src/routes/             # Definicion endpoints
```

### Frontend
```
frontend/src/App.jsx            # Router principal
frontend/src/main.jsx           # Entry point
frontend/src/services/api.js    # Cliente HTTP
frontend/src/config/firebase.js # Firebase cliente
frontend/src/pages/             # Todas las paginas
frontend/src/components/        # Componentes reutilizables
```

---

## 13. COMANDOS UTILES

### Backend
```bash
cd backend
npm install          # Instalar dependencias
npm run dev          # Desarrollo (nodemon)
npm start            # Produccion
```

### Frontend
```bash
cd frontend
npm install          # Instalar dependencias
npm run dev          # Desarrollo (Vite)
npm run build        # Build produccion
npm run preview      # Preview del build
```

### Ambos (desarrollo)
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 14. PROXIMOS PASOS / PENDIENTES

> Esta seccion se actualiza segun avance el desarrollo

### Portal del Empleado (en desarrollo)
- [ ] Vista de mis asistencias
- [ ] Vista de mis ausencias
- [ ] Solicitud de permisos mejorada
- [ ] Notificaciones
- [ ] Dashboard personal

---

## 15. CONTACTO Y SOPORTE

- **Email sistemas**: sistemas16ch@gmail.com
- **Repositorio**: [Pendiente configurar Git]

---

*Documento generado el 30 de enero de 2026*
