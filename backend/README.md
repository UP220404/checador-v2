# Checador Cielito Home - Backend API

Backend API para el sistema de control de asistencia y nómina de Cielito Home.

## 🚀 Tecnologías

- Node.js + Express
- Firebase Admin SDK (Firestore + Auth)
- EmailJS / Nodemailer
- PDFKit (generación de PDFs)
- Excel4Node (exportación Excel)

## 📋 Requisitos Previos

- Node.js >= 18.x
- npm >= 9.x
- Cuenta Firebase con proyecto configurado
- Service Account Key de Firebase

## 🔧 Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

3. **Obtener Service Account Key de Firebase:**
   - Ir a: Firebase Console → Project Settings → Service Accounts
   - Generar nueva clave privada
   - Guardar como `firebase-service-account.json` en la raíz del proyecto

4. **Iniciar servidor de desarrollo:**
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/           # Configuraciones (Firebase, Email, etc.)
│   ├── routes/           # Rutas de la API
│   ├── controllers/      # Controladores
│   ├── services/         # Lógica de negocio
│   ├── middleware/       # Middlewares (auth, validation, etc.)
│   ├── models/           # Schemas y validaciones
│   ├── utils/            # Utilidades y helpers
│   ├── app.js            # Configuración de Express
│   └── server.js         # Entry point
├── .env                  # Variables de entorno (NO SUBIR A GIT)
├── .env.example          # Ejemplo de variables de entorno
├── package.json
└── README.md
```

## 🔐 Autenticación

La API usa Firebase Authentication con tokens JWT.

**Headers requeridos:**
```
Authorization: Bearer <firebase_id_token>
```

## 📡 Endpoints Principales

### Autenticación
- `POST /api/auth/verify` - Verificar token de Firebase

### Usuarios
- `GET /api/users` - Listar usuarios (admin)
- `GET /api/users/:id` - Obtener usuario específico
- `POST /api/users` - Crear usuario (admin)
- `PUT /api/users/:id` - Actualizar usuario (admin)

### Asistencias
- `POST /api/attendance/check-in` - Registrar entrada/salida
- `GET /api/attendance/history/:userId` - Historial de asistencias
- `GET /api/attendance/today` - Asistencias del día (admin)

### Nómina
- `POST /api/payroll/calculate` - Calcular nómina (admin)
- `GET /api/payroll/:id` - Obtener nómina específica
- `PUT /api/payroll/:id` - Editar nómina manualmente (admin)

### Ausencias
- `POST /api/absences` - Crear ausencia (admin)
- `PUT /api/absences/:id/approve` - Aprobar ausencia (admin)
- `GET /api/absences` - Listar ausencias (admin)

### Reportes
- `GET /api/reports/daily` - Reporte diario (admin)
- `GET /api/reports/payroll/:period` - Reporte de nómina (admin)

### QR
- `GET /api/qr/token` - Obtener token QR actual
- `POST /api/qr/generate` - Generar nuevo token (admin)
- `POST /api/qr/validate` - Validar token QR

## 🧪 Testing

```bash
npm test
```

## 🚢 Deployment

### Opción 1: Cloud Run (Recomendado)
```bash
# Build Docker image
docker build -t checador-backend .

# Deploy to Cloud Run
gcloud run deploy checador-backend --image gcr.io/PROJECT_ID/checador-backend
```

### Opción 2: Cloud Functions
```bash
firebase deploy --only functions
```

## 📄 Licencia

Propietario: Cielito Home
