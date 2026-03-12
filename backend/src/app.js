import express from 'express';
import 'express-async-errors'; // Captura global de errores de promesas asíncronas
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeFirebase } from './config/firebase.js';
import { HTTP_STATUS } from './config/constants.js';

// Importar rutas
import usersRoutes from './routes/users.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import qrRoutes from './routes/qr.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import absenceRoutes from './routes/absence.routes.js';
import reportRoutes from './routes/report.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import evaluationsRoutes from './routes/evaluations.routes.js';
import trainingRoutes from './routes/training.routes.js';
import auditRoutes from './routes/audit.routes.js';
import contractEvaluationsRoutes from './routes/contractEvaluations.routes.js';

const app = express();

// ===== INICIALIZAR FIREBASE =====
initializeFirebase();

// ===== MIDDLEWARES GLOBALES =====

// Seguridad (configurado para permitir Firebase Auth en /get-token)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://*.google.com", "https://www.gstatic.com"],
      frameSrc: ["https://*.firebaseapp.com", "https://*.google.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

    // Sin origin (mobile/postman) → rechazar en producción
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('No permitido por CORS'));
      }
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting — límite generoso para uso interno de empresa
// (todos los empleados pueden compartir la misma IP corporativa)
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutos

const limiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health', // health check sin límite
});
app.use('/api/', limiter);

// Logging de requests (desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ===== RUTAS =====

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Ruta de bienvenida — sin exponer endpoints internos
app.get('/', (req, res) => {
  res.json({
    name: 'Checador API',
    status: 'ok'
  });
});

// ===== RUTAS =====
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/absences', absenceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/evaluations', evaluationsRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/contract-evaluations', contractEvaluationsRoutes);

// ===== MANEJO DE ERRORES =====

// Ruta no encontrada
app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.path
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error(`[ErrorHandler] ${req.method} ${req.path}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Error de CORS
  if (err.message === 'No permitido por CORS') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Acceso no permitido por política CORS'
    });
  }

  // Error de validación
  if (err.name === 'ValidationError') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Error de validación',
      details: err.details
    });
  }

  // Error de autenticación
  if (err.name === 'UnauthorizedError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'No autorizado'
    });
  }

  // Errores comunes de Firebase / Base de datos
  if (err.code && typeof err.code === 'string' && (err.code.startsWith('auth/') || err.code.startsWith('firestore/'))) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Error en servicio de nube: ' + (process.env.NODE_ENV === 'development' ? err.message : 'Solicitud no procesable.')
    });
  }

  if (err.name === 'FirebaseError') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Error de validación en base de datos externa.'
    });
  }

  // Error genérico
  res.status(err.status || HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;
