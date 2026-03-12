import dotenv from 'dotenv';
import cron from 'node-cron';
import app from './app.js';
import ContractEvaluationService from './services/ContractEvaluationService.js';

// Cargar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// ===== CRON JOBS =====

// Verificar evaluaciones de contrato pendientes todos los días a las 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('');
  console.log('⏰ [CRON] Ejecutando verificación de evaluaciones de contrato...');

  // Sincronizar datos y fechas de evaluaciones pendientes
  try {
    const syncResult = await ContractEvaluationService.syncPendingEvaluations();
    console.log(`🔄 [CRON] Evaluaciones sincronizadas. ${syncResult.updated} de ${syncResult.total} actualizadas.`);
  } catch (error) {
    console.error('❌ [CRON] Error sincronizando evaluaciones:', error);
  }

  try {
    const result = await ContractEvaluationService.checkPendingEvaluations();
    console.log(`✅ [CRON] Verificación completada. ${result.checked} evaluaciones revisadas.`);
  } catch (error) {
    console.error('❌ [CRON] Error en verificación de evaluaciones:', error);
  }

  // Verificar contratos próximos a vencer
  try {
    const result = await ContractEvaluationService.checkExpiringContracts();
    console.log(`📋 [CRON] Contratos verificados. ${result.checked} usuarios revisados, ${result.notified} notificaciones enviadas.`);
  } catch (error) {
    console.error('❌ [CRON] Error verificando contratos por vencer:', error);
  }
}, {
  timezone: 'America/Mexico_City'
});

console.log('📅 Cron job configurado: Verificación de evaluaciones de contrato (8:00 AM diario)');

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║        🏢 CHECADOR CIELITO HOME - API BACKEND            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📡 Servidor corriendo en puerto: ${PORT}`);
  console.log(`🌍 Entorno: ${ENV}`);
  console.log(`🕐 Iniciado: ${new Date().toLocaleString('es-MX')}`);
  console.log('');
  console.log('📋 Endpoints disponibles:');
  console.log(`   • Health check: http://localhost:${PORT}/health`);
  console.log(`   • API root: http://localhost:${PORT}/api/v1`);
  console.log('');
  console.log('✅ Servidor listo para recibir peticiones');
  console.log('');
});

// Manejo de errores del servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Error: Puerto ${PORT} ya está en uso`);
  } else {
    console.error('❌ Error del servidor:', error);
  }
  process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('');
  console.log('⚠️  Señal SIGTERM recibida. Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('');
  console.log('⚠️  Señal SIGINT recibida. Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

export default server;
