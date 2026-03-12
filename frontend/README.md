# Frontend - Sistema de Checador QR Cielito Home

Frontend moderno desarrollado con **React + Vite** para el sistema de control de asistencia.

## 🚀 Tecnologías Utilizadas

- **React 18** - Librería UI
- **Vite** - Build tool y dev server
- **React Router DOM** - Enrutamiento
- **Firebase** - Autenticación y Firestore
- **Axios** - Cliente HTTP
- **Bootstrap 5** - Framework CSS
- **Chart.js** - Gráficas y visualizaciones
- **QRious** - Generación de códigos QR

## 📁 Estructura del Proyecto

```
front/
├── src/
│   ├── pages/          # Páginas principales
│   │   ├── QRGenerator.jsx      # Generador de QR (página principal)
│   │   ├── Login.jsx             # Login de administrador
│   │   ├── Dashboard.jsx         # Panel de control admin
│   │   ├── Usuarios.jsx          # Gestión de usuarios
│   │   ├── Registros.jsx         # Historial de asistencias
│   │   └── Reportes.jsx          # Generación de reportes
│   ├── components/     # Componentes reutilizables
│   │   └── Sidebar.jsx           # Barra lateral de navegación
│   ├── services/       # Servicios y API
│   │   └── api.js                # Cliente API axios
│   ├── config/         # Configuraciones
│   │   └── firebase.js           # Configuración de Firebase
│   ├── styles/         # Estilos CSS
│   │   ├── QRGenerator.css
│   │   ├── Login.css
│   │   ├── Dashboard.css
│   │   └── Sidebar.css
│   ├── App.jsx         # Componente principal con rutas
│   └── main.jsx        # Punto de entrada
├── .env                # Variables de entorno
└── package.json        # Dependencias del proyecto
```

## 🛠️ Instalación y Configuración

### 1. Instalar Dependencias

```bash
cd front
npm install
```

### 2. Configurar Variables de Entorno

El archivo `.env` ya está configurado:

```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Ejecutar en Modo Desarrollo

```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

### 4. Compilar para Producción

```bash
npm run build
```

Los archivos compilados estarán en la carpeta `dist/`

## 🎯 Funcionalidades

### Página Principal (QR Generator)
- **Generación automática de QR** según horario:
  - **7-10 AM**: QR dinámico (se regenera cada 2 minutos)
  - **10 AM-6 PM**: QR estático (fijo hasta las 6 PM)
  - **6 PM-7 AM**: Sistema inactivo
- **Estadísticas en tiempo real**:
  - QRs generados
  - Usos exitosos
  - Intentos bloqueados
- **Visualización del token encriptado**
- **Cuenta regresiva** para expiración del QR

### Panel de Administración

#### Dashboard
- Métricas del día (entradas, salidas, usuarios activos)
- Gráfica de actividad semanal
- Últimos registros
- Accesos rápidos a otras secciones

#### Usuarios
- Lista de todos los usuarios del sistema
- Ver estado (activo/inactivo) y rol (admin/empleado)
- Botones para editar y eliminar

#### Registros
- Historial completo de asistencias
- Filtros por rango de fechas
- Vista detallada con tipo (entrada/salida), fecha, hora, ubicación

#### Reportes
- Generación de reportes semanales y mensuales
- Exportación en múltiples formatos (Excel, CSV, PDF)
- Configuración flexible de períodos

## 🔐 Autenticación

El sistema usa **Firebase Authentication**:

```javascript
// Iniciar sesión
signInWithEmailAndPassword(auth, email, password)

// Cerrar sesión
signOut(auth)
```

El token de autenticación se guarda en `localStorage` y se incluye automáticamente en todas las peticiones al backend mediante un interceptor de Axios.

## 🎨 Diseño

- **Colores principales**:
  - Verde: `#155d27`
  - Dorado: `#c1a35f`
- **Tipografía**: Inter (Google Fonts)
- **Componentes**: Bootstrap 5
- **Iconos**: Bootstrap Icons

## 📡 Conexión con el Backend

El archivo `services/api.js` contiene todos los endpoints:

```javascript
import { api } from './services/api';

// Ejemplos de uso
api.getUsers()                              // GET /usuarios
api.getTodayAttendance()                   // GET /asistencias/hoy
api.getAttendanceRecords({fechaInicio, fechaFin})  // GET /asistencias
api.getWeeklyReport(fechaInicio, fechaFin) // GET /reportes/semanal
```

## 🚦 Rutas de la Aplicación

```
/                      → QR Generator (página pública)
/login                 → Login de administrador
/admin/dashboard       → Panel de control
/admin/usuarios        → Gestión de usuarios
/admin/registros       → Historial de asistencias
/admin/reportes        → Generación de reportes
```

## 📦 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Compilar para producción
npm run build

# Preview de producción
npm run preview

# Linting
npm run lint
```

## 🔄 Integración con Firebase

El frontend se conecta a Firebase para:
- **Autenticación** de administradores
- **Firestore** para gestión de tokens QR
- **Estadísticas en tiempo real**

Configuración en `src/config/firebase.js`

## ⚠️ Notas Importantes

1. **El backend debe estar corriendo** en `http://localhost:3000` para que el frontend funcione correctamente
2. **Firebase debe estar configurado** con las credenciales correctas
3. El diseño está basado en el **código antiguo** pero con una arquitectura moderna React
4. Todos los estilos son **responsivos** y funcionan en dispositivos móviles

## 🐛 Troubleshooting

### Error: Cannot find module 'firebase'
```bash
npm install firebase
```

### Error: API connection refused
Verifica que el backend esté corriendo en el puerto 3000

### Error: Firebase configuration
Verifica las credenciales de Firebase en `src/config/firebase.js`

---

**Desarrollado con ❤️ para Cielito Home**
