/**
 * Script de Migración: Firestore V1 → V2
 *
 * IMPORTANTE: Ejecutar en ambiente de desarrollo primero
 *
 * Uso:
 *   node backend/scripts/migration/migrate-firestore.js --dry-run    (simular sin escribir)
 *   node backend/scripts/migration/migrate-firestore.js --backup     (crear backup primero)
 *   node backend/scripts/migration/migrate-firestore.js --execute    (ejecutar migración)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar Firebase Admin
const serviceAccountPath = join(__dirname, '../../../firebase-service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  createBackup: process.argv.includes('--backup'),
  execute: process.argv.includes('--execute'),
  batchSize: 50 // Firestore batch limit is 500, usamos 50 para seguridad
};

// ============================================
// ESTADÍSTICAS
// ============================================
const stats = {
  employees: { total: 0, migrated: 0, errors: 0 },
  attendance_events: { total: 0, migrated: 0, errors: 0 },
  attendance_daily: { total: 0, created: 0, errors: 0 },
  leave_requests: { total: 0, migrated: 0, errors: 0 },
  leave_balances: { total: 0, created: 0, errors: 0 },
  payroll_periods: { total: 0, migrated: 0, errors: 0 },
  payroll_items: { total: 0, migrated: 0, errors: 0 },
  holidays: { total: 0, migrated: 0, errors: 0 },
  audit_log: { total: 0, created: 0, errors: 0 }
};

// ============================================
// UTILIDADES
// ============================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📘',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍'
  }[type] || '📘';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ESTADÍSTICAS DE MIGRACIÓN');
  console.log('='.repeat(60));

  Object.entries(stats).forEach(([collection, data]) => {
    console.log(`\n${collection}:`);
    Object.entries(data).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });

  console.log('\n' + '='.repeat(60));
}

async function createBackup() {
  log('🔄 Creando backup de colecciones actuales...', 'info');

  const collections = [
    'usuarios',
    'registros',
    'ausencias',
    'nominas',
    'dias_festivos',
    'qr_tokens'
  ];

  for (const collectionName of collections) {
    log(`  Backing up: ${collectionName}`, 'debug');

    const snapshot = await db.collection(collectionName).get();
    const backupData = [];

    snapshot.forEach(doc => {
      backupData.push({
        id: doc.id,
        data: doc.data()
      });
    });

    // Guardar en una colección de backup
    const backupRef = db.collection('_backup_' + collectionName);

    let batch = db.batch();
    let count = 0;

    for (const item of backupData) {
      batch.set(backupRef.doc(item.id), item.data);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    log(`  ✅ Backed up ${backupData.length} documents from ${collectionName}`, 'success');
  }

  log('✅ Backup completado', 'success');
}

// ============================================
// MIGRACIÓN 1: USUARIOS → EMPLOYEES
// ============================================

async function migrateEmployees() {
  log('🔄 Migrando usuarios → employees', 'info');

  const usuariosSnapshot = await db.collection('usuarios').get();
  stats.employees.total = usuariosSnapshot.size;

  let batch = db.batch();
  let count = 0;

  for (const doc of usuariosSnapshot.docs) {
    const oldData = doc.data();
    const employeeId = doc.id; // Mantener el mismo UID

    // Transformar estructura
    const newEmployee = {
      uid: employeeId,
      employeeNumber: `EMP-${String(count + 1).padStart(3, '0')}`, // Generar número

      // Datos personales
      personalInfo: {
        firstName: extractFirstName(oldData.nombre || ''),
        lastName: extractLastName(oldData.nombre || ''),
        fullName: oldData.nombre || '',
        email: oldData.correo || '',
        phone: oldData.telefono || '',
        dateOfBirth: oldData.fechaNacimiento || null,
        curp: oldData.curp || '',
        rfc: oldData.rfc || '',
        address: {
          street: oldData.direccion || '',
          city: oldData.ciudad || 'Aguascalientes',
          state: oldData.estado || 'Aguascalientes',
          zipCode: oldData.codigoPostal || ''
        }
      },

      // Datos laborales
      employment: {
        status: oldData.activo === false ? 'inactive' : 'active',
        hireDate: oldData.fechaIngreso || oldData.fechaCreacion?.toDate?.()?.toISOString().split('T')[0] || null,
        terminationDate: oldData.fechaBaja || null,
        position: oldData.puesto || 'Sin especificar',
        department: oldData.area || oldData.departamento || 'General',
        employeeType: normalizeEmployeeType(oldData.tipo),

        schedule: {
          type: oldData.horarioEspecial ? 'special' : 'standard',
          startTime: '08:00',
          endTime: '17:00',
          toleranceMinutes: 10,
          weeklyHours: oldData.tipo === 'becario' ? 25 : 45
        },

        reportsTo: {
          employeeId: oldData.jefeId || null,
          name: oldData.jefeNombre || '',
          email: oldData.jefeEmail || ''
        }
      },

      // Compensación
      compensation: {
        payrollType: oldData.tipoNomina || 'biweekly',
        baseSalary: oldData.salarioQuincenal || 0,
        expectedHours: oldData.horasQuincenal || 90,
        payPerDay: oldData.salarioQuincenal ? (oldData.salarioQuincenal / 10) : 0,

        benefits: {
          hasIMSS: oldData.tieneIMSS || false,
          imssDeduction: 300,
          hasSavingsFund: oldData.tieneCajaAhorro || false,
          savingsFundAmount: oldData.montoCajaAhorro || 0
        },

        bankAccount: {
          bank: oldData.nombreBanco || '',
          accountNumber: oldData.cuentaBancaria || '',
          clabe: oldData.clabe || ''
        }
      },

      // Permisos especiales
      specialPermissions: {
        canWorkRemote: isRemoteUser(oldData.correo),
        canCheckMultipleTimes: isMultiRegisterUser(oldData.correo),
        bypassLocationCheck: isRemoteUser(oldData.correo),
        bypassScheduleCheck: isTestModeUser(oldData.correo)
      },

      // Metadata
      metadata: {
        createdAt: oldData.fechaCreacion || admin.firestore.FieldValue.serverTimestamp(),
        createdBy: oldData.creadoPor || 'migration-script',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'migration-script',
        version: 1,
        isActive: oldData.activo !== false,
        notes: oldData.notas || ''
      }
    };

    if (!CONFIG.dryRun) {
      batch.set(db.collection('employees').doc(employeeId), newEmployee);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        log(`  Migrados ${count} empleados...`, 'debug');
        batch = db.batch();
        count = 0;
      }
    }

    stats.employees.migrated++;
  }

  if (count > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`✅ Empleados migrados: ${stats.employees.migrated} de ${stats.employees.total}`, 'success');
}

// ============================================
// MIGRACIÓN 2: REGISTROS → ATTENDANCE_EVENTS
// ============================================

async function migrateAttendanceEvents() {
  log('🔄 Migrando registros → attendance_events', 'info');

  const registrosSnapshot = await db.collection('registros').get();
  stats.attendance_events.total = registrosSnapshot.size;

  let batch = db.batch();
  let count = 0;

  for (const doc of registrosSnapshot.docs) {
    const oldData = doc.data();

    const newEvent = {
      // Identificación
      employeeId: oldData.uid || oldData.usuarioId,
      employeeEmail: oldData.correo || oldData.email,
      employeeName: oldData.nombre || oldData.nombreUsuario,

      // Evento
      eventType: oldData.tipo === 'entrada' ? 'check_in' : 'check_out',
      eventDate: oldData.fecha || extractDate(oldData.timestamp),
      eventTime: oldData.hora || extractTime(oldData.timestamp),
      timestamp: oldData.timestamp || admin.firestore.FieldValue.serverTimestamp(),

      // Validaciones
      validation: {
        isOnTime: oldData.puntual !== false,
        minutesLate: oldData.minutosRetardo || 0,
        isWithinSchedule: oldData.dentroHorario !== false,
        isWeekend: oldData.finDeSemana || false,

        qrValidated: oldData.qrValidado !== false,
        qrCode: oldData.codigoQR || oldData.qrCode || '',
        qrToken: oldData.token || '',

        locationValidated: oldData.ubicacionValidada !== false,
        location: {
          lat: oldData.ubicacion?.lat || oldData.latitude || null,
          lng: oldData.ubicacion?.lng || oldData.longitude || null,
          accuracy: oldData.ubicacion?.accuracy || oldData.precision || null,
          distanceFromOffice: oldData.distanciaOficina || null
        }
      },

      // Metadata
      metadata: {
        createdAt: oldData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        source: oldData.origen || 'web',
        ipAddress: oldData.ip || null,
        userAgent: oldData.userAgent || null,
        testMode: oldData.modoPruebas || false
      }
    };

    if (!CONFIG.dryRun) {
      const newDocRef = db.collection('attendance_events').doc();
      batch.set(newDocRef, newEvent);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        log(`  Migrados ${count} eventos...`, 'debug');
        batch = db.batch();
        count = 0;
      }
    }

    stats.attendance_events.migrated++;
  }

  if (count > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`✅ Eventos migrados: ${stats.attendance_events.migrated} de ${stats.attendance_events.total}`, 'success');
}

// ============================================
// MIGRACIÓN 3: GENERAR ATTENDANCE_DAILY
// ============================================

async function generateAttendanceDaily() {
  log('🔄 Generando attendance_daily (consolidación)...', 'info');

  // Obtener todos los eventos
  const eventsSnapshot = await db.collection('attendance_events').get();

  // Agrupar por empleado + fecha
  const dailyRecords = new Map();

  eventsSnapshot.forEach(doc => {
    const event = doc.data();
    const key = `${event.employeeId}_${event.eventDate}`;

    if (!dailyRecords.has(key)) {
      dailyRecords.set(key, {
        employeeId: event.employeeId,
        employeeEmail: event.employeeEmail,
        employeeName: event.employeeName,
        date: event.eventDate,
        checkIn: null,
        checkOut: null
      });
    }

    const record = dailyRecords.get(key);

    if (event.eventType === 'check_in') {
      if (!record.checkIn || event.timestamp.toDate() < record.checkIn.timestamp.toDate()) {
        record.checkIn = {
          time: event.eventTime,
          timestamp: event.timestamp,
          isOnTime: event.validation.isOnTime,
          minutesLate: event.validation.minutesLate,
          eventId: doc.id
        };
      }
    } else if (event.eventType === 'check_out') {
      if (!record.checkOut || event.timestamp.toDate() > record.checkOut.timestamp.toDate()) {
        record.checkOut = {
          time: event.eventTime,
          timestamp: event.timestamp,
          isEarlyDeparture: false, // TODO: calcular
          eventId: doc.id
        };
      }
    }
  });

  log(`  Generando ${dailyRecords.size} registros diarios...`, 'debug');

  let batch = db.batch();
  let count = 0;

  for (const [key, record] of dailyRecords) {
    const hoursWorked = calculateHoursWorked(record.checkIn, record.checkOut);

    const dailyDoc = {
      employeeId: record.employeeId,
      employeeEmail: record.employeeEmail,
      employeeName: record.employeeName,
      date: record.date,
      dayOfWeek: getDayOfWeek(record.date),

      period: {
        year: parseInt(record.date.split('-')[0]),
        month: parseInt(record.date.split('-')[1]),
        week: getWeekNumber(record.date),
        payrollPeriod: calculatePayrollPeriod(record.date),
        payrollType: 'biweekly' // Por defecto
      },

      attendance: {
        status: record.checkIn ? 'present' : 'absent',
        checkIn: record.checkIn,
        checkOut: record.checkOut,

        hoursWorked: hoursWorked,
        expectedHours: 9,
        overtimeHours: Math.max(0, hoursWorked - 9),

        issues: {
          wasLate: record.checkIn?.minutesLate > 0,
          wasAbsent: !record.checkIn,
          leftEarly: false, // TODO
          missingCheckOut: record.checkIn && !record.checkOut
        }
      },

      leave: {
        hasLeave: false,
        leaveRequestId: null,
        leaveType: null,
        isApproved: null
      },

      payroll: {
        shouldPay: record.checkIn !== null,
        paymentStatus: 'pending',
        dayValue: 800, // TODO: obtener del empleado
        deductions: record.checkIn?.minutesLate > 0 ? 50 : 0,
        netPay: record.checkIn ? 800 - (record.checkIn?.minutesLate > 0 ? 50 : 0) : 0,
        notes: ''
      },

      metadata: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        calculatedBy: 'migration-script',
        locked: false,
        version: 1
      }
    };

    if (!CONFIG.dryRun) {
      batch.set(db.collection('attendance_daily').doc(key), dailyDoc);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        log(`  Creados ${count} registros diarios...`, 'debug');
        batch = db.batch();
        count = 0;
      }
    }

    stats.attendance_daily.created++;
  }

  if (count > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`✅ Registros diarios creados: ${stats.attendance_daily.created}`, 'success');
}

// ============================================
// MIGRACIÓN 4: AUSENCIAS → LEAVE_REQUESTS
// ============================================

async function migrateLeaveRequests() {
  log('🔄 Migrando ausencias → leave_requests', 'info');

  const ausenciasSnapshot = await db.collection('ausencias').get();
  stats.leave_requests.total = ausenciasSnapshot.size;

  let batch = db.batch();
  let count = 0;

  for (const doc of ausenciasSnapshot.docs) {
    const oldData = doc.data();

    const newRequest = {
      employeeId: oldData.uid || oldData.empleadoId,
      employeeEmail: oldData.emailUsuario || oldData.correo,
      employeeName: oldData.nombreUsuario || oldData.nombre,

      request: {
        type: normalizeLeaveType(oldData.tipo),
        startDate: oldData.fechaInicio,
        endDate: oldData.fechaFin || oldData.fechaInicio,
        totalDays: oldData.diasJustificados || 1,
        reason: oldData.motivo || '',
        attachments: oldData.adjuntos || [],

        vacationDetails: oldData.tipo === 'vacaciones' ? {
          yearEarned: oldData.anioAntiguedad || new Date().getFullYear() - 1,
          daysRequested: oldData.diasJustificados || 1,
          remainingAfter: 0 // TODO: calcular
        } : null
      },

      approval: {
        status: oldData.estado || 'pending',

        managerApproval: {
          approved: oldData.aprobadoPorJefe || null,
          approvedBy: oldData.jefeAprobador || null,
          approvedAt: oldData.fechaAprobacionJefe || null,
          comments: oldData.comentariosJefe || ''
        },

        hrApproval: {
          approved: oldData.aprobadoPorRH || null,
          approvedBy: oldData.rhAprobador || null,
          approvedAt: oldData.fechaAprobacionRH || null,
          comments: oldData.comentariosAdmin || ''
        },

        finalStatus: oldData.estado || 'pending',
        finalApprovedBy: oldData.aprobadoPor || null,
        finalApprovedAt: oldData.fechaAprobacion || null,
        rejectionReason: oldData.motivoRechazo || null
      },

      integration: {
        appliedToAttendance: oldData.aplicadaEnAsistencia || false,
        appliedToPayroll: oldData.aplicadaEnNomina || false,
        payrollPeriods: oldData.periodosNomina || [],
        attendanceDaysAffected: oldData.diasAfectados || []
      },

      metadata: {
        createdAt: oldData.fechaCreacion || admin.firestore.FieldValue.serverTimestamp(),
        createdBy: oldData.emailUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: 1,
        notes: oldData.notas || ''
      }
    };

    if (!CONFIG.dryRun) {
      const newDocRef = db.collection('leave_requests').doc();
      batch.set(newDocRef, newRequest);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        log(`  Migradas ${count} solicitudes...`, 'debug');
        batch = db.batch();
        count = 0;
      }
    }

    stats.leave_requests.migrated++;
  }

  if (count > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`✅ Solicitudes migradas: ${stats.leave_requests.migrated} de ${stats.leave_requests.total}`, 'success');
}

// ============================================
// MIGRACIÓN 5: DIAS_FESTIVOS → HOLIDAYS
// ============================================

async function migrateHolidays() {
  log('🔄 Migrando dias_festivos → holidays', 'info');

  const festivosSnapshot = await db.collection('dias_festivos').get();
  stats.holidays.total = festivosSnapshot.size;

  let batch = db.batch();
  let count = 0;

  for (const doc of festivosSnapshot.docs) {
    const oldData = doc.data();

    const newHoliday = {
      name: oldData.nombre || oldData.name,
      date: oldData.fecha || oldData.date,
      year: oldData.año || oldData.year || parseInt(oldData.fecha?.split('-')[0]),
      isOfficial: oldData.oficial !== false,
      isPaid: oldData.pagado !== false,
      isActive: oldData.activo !== false,

      metadata: {
        createdAt: oldData.fechaCreacion || admin.firestore.FieldValue.serverTimestamp(),
        createdBy: oldData.creadoPor || 'migration-script'
      }
    };

    if (!CONFIG.dryRun) {
      const newDocRef = db.collection('holidays').doc();
      batch.set(newDocRef, newHoliday);
      count++;

      if (count >= CONFIG.batchSize) {
        await batch.commit();
        log(`  Migrados ${count} días festivos...`, 'debug');
        batch = db.batch();
        count = 0;
      }
    }

    stats.holidays.migrated++;
  }

  if (count > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`✅ Días festivos migrados: ${stats.holidays.migrated} de ${stats.holidays.total}`, 'success');
}

// ============================================
// HELPERS
// ============================================

function extractFirstName(fullName) {
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

function extractLastName(fullName) {
  const parts = fullName.trim().split(' ');
  return parts.slice(1).join(' ') || '';
}

function normalizeEmployeeType(tipo) {
  const map = {
    'becario': 'intern',
    'tiempo_completo': 'full_time',
    'especial': 'contractor',
    'horario_especial': 'part_time'
  };
  return map[tipo] || 'full_time';
}

function normalizeLeaveType(tipo) {
  const map = {
    'permiso_con_goce': 'paid_leave',
    'permiso_sin_goce': 'unpaid_leave',
    'vacaciones': 'vacation',
    'incapacidad': 'sick_leave',
    'viaje_negocios': 'business_trip',
    'retardo_justificado': 'excused_late',
    'falta_justificada': 'excused_absence'
  };
  return map[tipo] || 'unpaid_leave';
}

function isRemoteUser(email) {
  const remoteUsers = [
    'sistemas20cielitoh@gmail.com',
    'operacionescielitoh@gmail.com',
    'atencionmedicacielitoh@gmail.com'
  ];
  return remoteUsers.includes(email);
}

function isMultiRegisterUser(email) {
  return email === 'sistemas16ch@gmail.com';
}

function isTestModeUser(email) {
  return false; // Ninguno por defecto
}

function extractDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0];
}

function extractTime(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toTimeString().split(' ')[0];
}

function calculateHoursWorked(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  const checkInTime = checkIn.timestamp.toDate ? checkIn.timestamp.toDate() : new Date(checkIn.timestamp);
  const checkOutTime = checkOut.timestamp.toDate ? checkOut.timestamp.toDate() : new Date(checkOut.timestamp);

  const diff = (checkOutTime - checkInTime) / 1000 / 60 / 60; // Horas
  return Math.max(0, Math.round(diff * 100) / 100);
}

function getDayOfWeek(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  return date.getDay(); // 0 = Domingo
}

function getWeekNumber(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function calculatePayrollPeriod(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const day = date.getDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  if (day <= 15) {
    return `${year}-${month}-01_${year}-${month}-15`;
  } else {
    const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    return `${year}-${month}-16_${year}-${month}-${lastDay}`;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 MIGRACIÓN FIRESTORE V1 → V2');
  console.log('='.repeat(60));
  console.log(`Modo: ${CONFIG.dryRun ? '🔍 DRY RUN (simulación)' : '⚡ EJECUCIÓN REAL'}`);
  console.log(`Backup: ${CONFIG.createBackup ? '✅ Sí' : '❌ No'}`);
  console.log('='.repeat(60) + '\n');

  if (!CONFIG.execute && !CONFIG.dryRun) {
    console.error('❌ Error: Debes especificar --execute o --dry-run');
    console.log('\nUso:');
    console.log('  node migrate-firestore.js --dry-run    (simular)');
    console.log('  node migrate-firestore.js --backup --execute    (ejecutar con backup)');
    process.exit(1);
  }

  try {
    // Paso 1: Backup (opcional)
    if (CONFIG.createBackup && !CONFIG.dryRun) {
      await createBackup();
    }

    // Paso 2: Migrar colecciones
    await migrateEmployees();
    await migrateAttendanceEvents();
    await generateAttendanceDaily();
    await migrateLeaveRequests();
    await migrateHolidays();

    // Paso 3: Mostrar estadísticas
    logStats();

    // Paso 4: Resumen
    console.log('\n' + '='.repeat(60));
    if (CONFIG.dryRun) {
      log('✅ SIMULACIÓN COMPLETADA - No se escribió nada en Firestore', 'success');
      log('Para ejecutar la migración real, usa: --execute', 'info');
    } else {
      log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE', 'success');
      log('Verifica los datos en Firestore Console antes de eliminar colecciones antiguas', 'warning');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    log(`Error fatal en migración: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar
main();
