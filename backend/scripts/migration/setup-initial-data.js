/**
 * Script para crear datos iniciales después de la migración
 *
 * Crea:
 * - Roles del sistema
 * - Configuración (settings)
 * - Permisos para admins
 *
 * Uso:
 *   node backend/scripts/migration/setup-initial-data.js
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
// ROLES
// ============================================

const ROLES = [
  {
    roleId: 'super_admin',
    name: 'Super Administrador',
    description: 'Acceso total al sistema',
    permissions: [
      '*' // Acceso total
    ],
    priority: 100,
    isActive: true
  },
  {
    roleId: 'hr_manager',
    name: 'Gerente de RH',
    description: 'Gestión completa de Recursos Humanos',
    permissions: [
      'employees.read',
      'employees.write',
      'attendance.read',
      'attendance.write',
      'leave_requests.read',
      'leave_requests.approve',
      'payroll.read',
      'payroll.write',
      'payroll.approve',
      'reports.read',
      'reports.export',
      'incidents.read',
      'incidents.write',
      'settings.read'
    ],
    priority: 90,
    isActive: true
  },
  {
    roleId: 'hr_staff',
    name: 'Staff de RH',
    description: 'Operación de Recursos Humanos',
    permissions: [
      'employees.read',
      'attendance.read',
      'leave_requests.read',
      'leave_requests.approve',
      'payroll.read',
      'reports.read',
      'reports.export'
    ],
    priority: 80,
    isActive: true
  },
  {
    roleId: 'department_manager',
    name: 'Jefe de Área',
    description: 'Gestión de equipo',
    permissions: [
      'employees.read', // Solo su equipo
      'attendance.read', // Solo su equipo
      'leave_requests.read', // Solo su equipo
      'leave_requests.approve', // Solo su equipo
      'reports.read' // Solo su equipo
    ],
    priority: 70,
    isActive: true
  },
  {
    roleId: 'employee',
    name: 'Empleado',
    description: 'Acceso básico de empleado',
    permissions: [
      'attendance.own.read',
      'attendance.own.checkin',
      'leave_requests.own.read',
      'leave_requests.own.create',
      'payroll.own.read'
    ],
    priority: 10,
    isActive: true
  }
];

async function createRoles() {
  console.log('🔧 Creando roles del sistema...');

  for (const role of ROLES) {
    const roleDoc = {
      ...role,
      metadata: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    await db.collection('roles').doc(role.roleId).set(roleDoc);
    console.log(`  ✅ Rol creado: ${role.name}`);
  }

  console.log('✅ Roles creados exitosamente\n');
}

// ============================================
// SETTINGS
// ============================================

const SYSTEM_SETTINGS = {
  // Asistencia
  attendance: {
    standardStartTime: '08:00',
    standardEndTime: '17:00',
    toleranceMinutes: 10,
    minimumCheckOutTimeIntern: '13:00',
    minimumCheckOutTimeFullTime: '16:00',
    registrationWindowStart: '07:00',
    registrationWindowEnd: '22:00'
  },

  // Geolocalización
  location: {
    office: {
      lat: 21.92545657925517,
      lng: -102.31327431392519,
      radiusMeters: 40
    },
    requireLocation: true
  },

  // Nómina
  payroll: {
    defaultPayrollType: 'biweekly',
    lateArrivalDeduction: 50,
    lateArrivalsBeforeDeduction: 3,
    imssDeduction: 300,
    paymentDay: 16
  },

  // Vacaciones
  leaves: {
    requireApproval: true,
    requireManagerApproval: true,
    requireHRApproval: true,
    maxCarryOverDays: 5,

    // Días por año de antigüedad (Ley Federal del Trabajo México)
    vacationDaysByYear: {
      1: 6,
      2: 8,
      3: 10,
      4: 12,
      5: 14,
      6: 16,
      7: 18,
      8: 20,
      9: 22,
      10: 24
    }
  },

  // Seguridad
  security: {
    requireQRValidation: true,
    qrTokenExpirationMinutes: 5,
    sessionTimeoutMinutes: 480,
    maxLoginAttempts: 5
  },

  // Metadata
  metadata: {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'setup-script',
    version: 1
  }
};

async function createSettings() {
  console.log('🔧 Creando configuración del sistema...');

  await db.collection('settings').doc('system').set(SYSTEM_SETTINGS);

  console.log('✅ Configuración creada exitosamente\n');
}

// ============================================
// PERMISOS PARA ADMINS
// ============================================

async function assignAdminPermissions() {
  console.log('🔧 Asignando permisos a administradores...');

  // Lista de emails de admins (actualizar según tu caso)
  const ADMINS = [
    'sistemas16ch@gmail.com',
    'administrador@cielitohome.com'
  ];

  for (const adminEmail of ADMINS) {
    try {
      // Buscar el empleado por email
      const employeesSnapshot = await db.collection('employees')
        .where('personalInfo.email', '==', adminEmail)
        .limit(1)
        .get();

      if (employeesSnapshot.empty) {
        console.log(`  ⚠️  Empleado no encontrado: ${adminEmail}`);
        continue;
      }

      const employeeDoc = employeesSnapshot.docs[0];
      const employeeId = employeeDoc.id;

      // Asignar rol super_admin
      const permissionDoc = {
        employeeId: employeeId,
        role: 'super_admin',
        grantedBy: 'setup-script',
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
        isActive: true
      };

      await db.collection('employees')
        .doc(employeeId)
        .collection('permissions')
        .doc('super_admin')
        .set(permissionDoc);

      console.log(`  ✅ Permisos asignados: ${adminEmail}`);

    } catch (error) {
      console.log(`  ❌ Error asignando permisos a ${adminEmail}: ${error.message}`);
    }
  }

  console.log('✅ Permisos asignados exitosamente\n');
}

// ============================================
// ÍNDICES (RECORDATORIO)
// ============================================

function showIndexReminder() {
  console.log('\n' + '='.repeat(60));
  console.log('📝 RECORDATORIO: CREAR ÍNDICES EN FIRESTORE CONSOLE');
  console.log('='.repeat(60));
  console.log('\nDebes crear estos índices compuestos en Firestore Console:\n');

  const indices = [
    {
      collection: 'employees',
      fields: [
        { field: 'employment.status', order: 'ASCENDING' },
        { field: 'personalInfo.fullName', order: 'ASCENDING' }
      ]
    },
    {
      collection: 'attendance_events',
      fields: [
        { field: 'employeeId', order: 'ASCENDING' },
        { field: 'eventDate', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'attendance_daily',
      fields: [
        { field: 'employeeId', order: 'ASCENDING' },
        { field: 'date', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'attendance_daily',
      fields: [
        { field: 'attendance.status', order: 'ASCENDING' },
        { field: 'date', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'leave_requests',
      fields: [
        { field: 'employeeId', order: 'ASCENDING' },
        { field: 'approval.status', order: 'ASCENDING' }
      ]
    },
    {
      collection: 'audit_log',
      fields: [
        { field: 'actor.employeeId', order: 'ASCENDING' },
        { field: 'timestamp', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'audit_log',
      fields: [
        { field: 'category', order: 'ASCENDING' },
        { field: 'timestamp', order: 'DESCENDING' }
      ]
    }
  ];

  indices.forEach((index, i) => {
    console.log(`${i + 1}. Colección: ${index.collection}`);
    console.log(`   Campos: ${index.fields.map(f => `${f.field} (${f.order})`).join(', ')}`);
    console.log('');
  });

  console.log('Crea estos índices en:');
  console.log('https://console.firebase.google.com/project/_/firestore/indexes');
  console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SETUP DE DATOS INICIALES - FIRESTORE V2');
  console.log('='.repeat(60) + '\n');

  try {
    await createRoles();
    await createSettings();
    await assignAdminPermissions();
    showIndexReminder();

    console.log('='.repeat(60));
    console.log('✅ SETUP COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error en setup:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar
main();
