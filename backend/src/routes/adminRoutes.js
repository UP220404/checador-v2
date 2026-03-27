import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, CONFIG } from '../config/constants.js';
import { getTodayString, evaluarPuntualidad } from '../utils/dateUtils.js';

const router = express.Router();

// Middleware de seguridad: Solo permitir en DESARROLLO
const localOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: '⛔ Acceso denegado: Esta herramienta solo está disponible en el entorno local de administración.' 
  });
};

/**
 * GET /api/v1/admin/users-simple
 * Retorna lista simplificada de usuarios para el dropdown del backdoor
 */
router.get('/users-simple', localOnly, async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTIONS.USUARIOS).get();
    
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        nombre: data.nombre,
        correo: data.correo || data.email,
        tipo: data.tipo || 'empleado'
      };
    });

    // Ordenar por nombre
    users.sort((a, b) => a.nombre.localeCompare(b.nombre));

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error en admin/users-simple:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/admin/manual-attendance
 * Inyecta un registro de asistencia manualmente
 */
router.post('/manual-attendance', localOnly, async (req, res) => {
  try {
    const { uid, email, nombre, tipo, fecha, horaEntrada, horaSalida } = req.body;
    const db = getFirestore();
    const results = [];

    // 1. Inyectar ENTRADA (si se proporcionó)
    if (horaEntrada) {
      const [h, m] = horaEntrada.split(':').map(Number);
      const timestampEntrada = new Date(`${fecha}T${horaEntrada}`);
      
      // Lógica de retardo (límite 8:10 AM)
      const esRetardo = (h > 8) || (h === 8 && m > 10);
      const estadoEntrada = (tipo === 'especial' || tipo === 'horario_especial') ? 'puntual' : (esRetardo ? 'retardo' : 'puntual');

      const registroEntrada = {
        uid,
        nombre,
        email,
        tipo,
        fecha,
        hora: horaEntrada,
        tipoEvento: 'entrada',
        estado: estadoEntrada,
        ubicacion: null,
        timestamp: timestampEntrada,
        metodo: 'manual_backdoor'
      };

      await db.collection(COLLECTIONS.REGISTROS).add(registroEntrada);
      results.push('Entrada');
    }

    // 2. Inyectar SALIDA (si se proporcionó)
    if (horaSalida) {
      const timestampSalida = new Date(`${fecha}T${horaSalida}`);
      const registroSalida = {
        uid,
        nombre,
        email,
        tipo,
        fecha,
        hora: horaSalida,
        tipoEvento: 'salida',
        estado: 'salida',
        ubicacion: null,
        timestamp: timestampSalida,
        metodo: 'manual_backdoor'
      };
      await db.collection(COLLECTIONS.REGISTROS).add(registroSalida);
      results.push('Salida');
    }

    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'Debes proporcionar al menos una hora (Entrada o Salida)' });
    }

    res.json({ 
      success: true, 
      message: `${results.join(' y ')} inyectada(s) correctamente para ${nombre}` 
    });

  } catch (error) {
    console.error('Error en admin/manual-attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
