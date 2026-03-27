import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, CONFIG } from '../config/constants.js';
import { getTodayString, evaluarPuntualidad } from '../utils/dateUtils.js';

const router = express.Router();

/**
 * GET /api/v1/admin/users-simple
 * Retorna lista simplificada de usuarios para el dropdown del backdoor
 */
router.get('/users-simple', async (req, res) => {
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
router.post('/manual-attendance', async (req, res) => {
  try {
    const { uid, email, nombre, tipo, fecha, horaEntrada, horaSalida } = req.body;

    if (!uid || !fecha || !horaEntrada) {
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }

    const db = getFirestore();

    // 1. Inyectar ENTRADA
    const [h, m] = horaEntrada.split(':').map(Number);
    const timestampEntrada = new Date(`${fecha}T${horaEntrada}`);
    
    // Lógica de retardo
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

    // 2. Inyectar SALIDA (opcional)
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
    }

    res.json({ 
      success: true, 
      message: `Registro(s) inyectado(s) correctamente para ${nombre}` 
    });

  } catch (error) {
    console.error('Error en admin/manual-attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
