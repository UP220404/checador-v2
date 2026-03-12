# 🗄️ ESTRUCTURA FIRESTORE V2 - HRIS CIELITO HOME

**Fecha de especificación:** 2026-01-02
**Versión:** 2.0

---

## 📋 ÍNDICE DE COLECCIONES

### Core (Críticas)
1. `employees` - Empleados (master data)
2. `attendance_events` - Eventos de checador (crudo)
3. `attendance_daily` - Asistencia consolidada (diaria)
4. `leave_requests` - Solicitudes de permisos/vacaciones
5. `leave_balances` - Saldos de vacaciones
6. `payroll_periods` - Períodos de nómina
7. `payroll_items` - Detalles de nómina por empleado

### Seguridad y Configuración
8. `roles` - Roles del sistema
9. `permissions` - Permisos por rol
10. `audit_log` - Log de auditoría

### Soporte
11. `qr_tokens` - Tokens QR temporales
12. `holidays` - Días festivos
13. `incidents` - Incidencias disciplinarias
14. `settings` - Configuración del sistema

---

## 1️⃣ EMPLOYEES (empleados)

**Colección principal de empleados. Source of truth de datos laborales.**

### Documento: `/employees/{employeeId}`

```javascript
{
  // === IDENTIFICACIÓN ===
  uid: "firebaseAuthUid",              // UID de Firebase Auth
  employeeNumber: "EMP-001",           // Número de empleado (único)

  // === DATOS PERSONALES ===
  personalInfo: {
    firstName: "Juan",
    lastName: "Pérez García",
    fullName: "Juan Pérez García",     // Nombre completo indexable
    email: "juan@cielitohome.com",
    phone: "4491234567",
    dateOfBirth: "1995-03-15",         // String YYYY-MM-DD
    curp: "PEGJ950315HASRXN01",
    rfc: "PEGJ950315ABC",
    address: {
      street: "Calle Principal 123",
      city: "Aguascalientes",
      state: "Aguascalientes",
      zipCode: "20000"
    }
  },

  // === DATOS LABORALES ===
  employment: {
    status: "active",                  // active | inactive | suspended | terminated
    hireDate: "2023-01-15",           // Fecha de contratación
    terminationDate: null,            // null si está activo
    position: "Desarrollador",
    department: "Tecnología",
    employeeType: "full_time",        // full_time | intern | contractor | part_time

    // Horario
    schedule: {
      type: "standard",               // standard | flexible | special
      startTime: "08:00",
      endTime: "17:00",
      toleranceMinutes: 10,           // Tolerancia de entrada (8:10)
      weeklyHours: 45
    },

    // Jefatura
    reportsTo: {
      employeeId: "ABC123",
      name: "María López",
      email: "maria@cielitohome.com"
    }
  },

  // === COMPENSACIÓN ===
  compensation: {
    payrollType: "biweekly",          // biweekly | weekly
    baseSalary: 8000,                 // Salario quincenal/semanal
    expectedHours: 90,                // Horas esperadas por período
    payPerDay: 800,                   // Calculado: baseSalary / días laborales

    // Prestaciones
    benefits: {
      hasIMSS: true,
      imssDeduction: 300,
      hasSavingsFund: true,
      savingsFundAmount: 500
    },

    // Datos bancarios
    bankAccount: {
      bank: "BBVA",
      accountNumber: "012345678901234567",
      clabe: "012345678901234567"
    }
  },

  // === PERMISOS ESPECIALES ===
  specialPermissions: {
    canWorkRemote: false,
    canCheckMultipleTimes: false,     // Para usuarios especiales
    bypassLocationCheck: false,
    bypassScheduleCheck: false        // Modo pruebas
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    createdBy: "admin@cielitohome.com",
    updatedAt: Timestamp,
    updatedBy: "admin@cielitohome.com",
    version: 1,                       // Versionado del documento
    isActive: true,
    notes: "Notas administrativas"
  }
}
```

### Índices necesarios:
- `personalInfo.email` (único)
- `employeeNumber` (único)
- `employment.status`
- `employment.department`
- Compuesto: `employment.status` + `personalInfo.fullName`

---

## 2️⃣ ATTENDANCE_EVENTS (eventos de asistencia - crudo)

**Cada entrada/salida genera un evento. NO se modifican después de crearse.**

### Documento: `/attendance_events/{eventId}`

```javascript
{
  // === IDENTIFICACIÓN ===
  employeeId: "ABC123",
  employeeEmail: "juan@cielitohome.com",
  employeeName: "Juan Pérez",

  // === EVENTO ===
  eventType: "check_in",              // check_in | check_out
  eventDate: "2026-01-02",           // String YYYY-MM-DD
  eventTime: "08:05:23",             // String HH:MM:SS
  timestamp: Timestamp,              // Fecha/hora completa

  // === VALIDACIONES ===
  validation: {
    isOnTime: true,                  // ¿Puntual?
    minutesLate: 0,                  // Minutos de retardo
    isWithinSchedule: true,
    isWeekend: false,

    // QR
    qrValidated: true,
    qrCode: "OFICINA2025_ABC",
    qrToken: "token123",

    // Ubicación
    locationValidated: true,
    location: {
      lat: 21.92545,
      lng: -102.31327,
      accuracy: 15,
      distanceFromOffice: 12         // Metros
    }
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    source: "web",                   // web | mobile | admin
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla...",
    testMode: false
  }
}
```

### Índices necesarios:
- `employeeId` + `eventDate`
- `eventDate`
- `employeeId` + `timestamp`

---

## 3️⃣ ATTENDANCE_DAILY (asistencia consolidada - diaria)

**Se genera automáticamente al final del día o al registrar salida. Es el resumen que usa nómina.**

### Documento: `/attendance_daily/{employeeId}_{date}`

Ejemplo ID: `ABC123_2026-01-02`

```javascript
{
  // === IDENTIFICACIÓN ===
  employeeId: "ABC123",
  employeeEmail: "juan@cielitohome.com",
  employeeName: "Juan Pérez",
  date: "2026-01-02",                // String YYYY-MM-DD
  dayOfWeek: 4,                      // 0=Domingo, 6=Sábado

  // === PERÍODO ===
  period: {
    year: 2026,
    month: 1,
    week: 1,
    payrollPeriod: "2026-01-01_2026-01-15",  // ID del período de nómina
    payrollType: "biweekly"
  },

  // === ASISTENCIA ===
  attendance: {
    status: "present",               // present | absent | leave | holiday | weekend

    // Eventos
    checkIn: {
      time: "08:05:23",
      timestamp: Timestamp,
      isOnTime: true,
      minutesLate: 0,
      eventId: "evt_123"
    },

    checkOut: {
      time: "17:10:15",
      timestamp: Timestamp,
      isEarlyDeparture: false,
      eventId: "evt_124"
    },

    // Cálculos
    hoursWorked: 9.08,               // Horas reales trabajadas
    expectedHours: 9,                // Horas esperadas
    overtimeHours: 0.08,

    // Problemas
    issues: {
      wasLate: false,
      wasAbsent: false,
      leftEarly: false,
      missingCheckOut: false
    }
  },

  // === AUSENCIAS (si aplica) ===
  leave: {
    hasLeave: false,
    leaveRequestId: null,
    leaveType: null,                 // paid_leave | unpaid_leave | vacation | sick_leave
    isApproved: null
  },

  // === NÓMINA ===
  payroll: {
    shouldPay: true,                 // ¿Se paga este día?
    paymentStatus: "pending",        // pending | calculated | paid
    dayValue: 800,                   // Valor del día
    deductions: 0,                   // Descuentos por retardos/faltas
    netPay: 800,
    notes: ""
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    updatedAt: Timestamp,
    calculatedBy: "system",          // system | admin
    locked: false,                   // true cuando está en nómina cerrada
    version: 1
  }
}
```

### Índices necesarios:
- `employeeId` + `date`
- `period.payrollPeriod`
- `date`
- Compuesto: `attendance.status` + `date`

---

## 4️⃣ LEAVE_REQUESTS (solicitudes de permisos/vacaciones)

**Solicitudes de ausencias con flujo de aprobación.**

### Documento: `/leave_requests/{requestId}`

```javascript
{
  // === IDENTIFICACIÓN ===
  employeeId: "ABC123",
  employeeEmail: "juan@cielitohome.com",
  employeeName: "Juan Pérez",

  // === SOLICITUD ===
  request: {
    type: "vacation",                // vacation | paid_leave | unpaid_leave | sick_leave | business_trip
    startDate: "2026-02-10",         // String YYYY-MM-DD
    endDate: "2026-02-14",
    totalDays: 5,                    // Días laborales
    reason: "Vacaciones familiares",
    attachments: [],                 // URLs de Firebase Storage

    // Solo para vacaciones
    vacationDetails: {
      yearEarned: 2025,              // Año de antigüedad que se usa
      daysRequested: 5,
      remainingAfter: 1              // Días que quedarán
    }
  },

  // === APROBACIÓN ===
  approval: {
    status: "pending",               // pending | approved | rejected | cancelled

    // Primer nivel (jefe directo)
    managerApproval: {
      approved: null,
      approvedBy: null,
      approvedAt: null,
      comments: ""
    },

    // Segundo nivel (RH)
    hrApproval: {
      approved: null,
      approvedBy: null,
      approvedAt: null,
      comments: ""
    },

    // Final
    finalStatus: "pending",
    finalApprovedBy: null,
    finalApprovedAt: null,
    rejectionReason: null
  },

  // === INTEGRACIÓN ===
  integration: {
    appliedToAttendance: false,      // ¿Ya se aplicó a attendance_daily?
    appliedToPayroll: false,         // ¿Ya se incluyó en nómina?
    payrollPeriods: [],              // IDs de períodos afectados
    attendanceDaysAffected: []       // Fechas afectadas
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    createdBy: "juan@cielitohome.com",
    updatedAt: Timestamp,
    version: 1,
    notes: ""
  }
}
```

### Índices necesarios:
- `employeeId` + `request.startDate`
- `approval.status`
- `request.type`
- Compuesto: `employeeId` + `approval.status`

---

## 5️⃣ LEAVE_BALANCES (saldos de vacaciones)

**Saldo de vacaciones por empleado por año. Se actualiza automáticamente.**

### Documento: `/leave_balances/{employeeId}_{year}`

Ejemplo ID: `ABC123_2026`

```javascript
{
  // === IDENTIFICACIÓN ===
  employeeId: "ABC123",
  employeeEmail: "juan@cielitohome.com",
  employeeName: "Juan Pérez",
  year: 2026,

  // === CÁLCULO ===
  calculation: {
    hireDate: "2023-01-15",
    yearsOfService: 3,               // Años de antigüedad
    daysEarnedPerYear: 8,            // Según ley/política
    totalDaysEarned: 8,              // Total generado este año

    // Períodos previos
    carryOverFromPreviousYear: 2,    // Días no usados del año anterior
    totalAvailable: 10               // Total disponible
  },

  // === USO ===
  usage: {
    daysUsed: 3,                     // Días ya usados
    daysPending: 2,                  // En solicitudes pendientes
    daysAvailable: 5,                // Disponibles para solicitar

    requests: [                      // Referencias a solicitudes
      {
        requestId: "req_123",
        startDate: "2026-02-10",
        endDate: "2026-02-14",
        days: 5,
        status: "approved"
      }
    ]
  },

  // === EXPIRACIÓN ===
  expiration: {
    expiresAt: "2026-12-31",         // Fin del año
    willExpire: 5,                   // Días que expirarán si no se usan
    allowCarryOver: true,
    maxCarryOverDays: 5              // Máximo de días transferibles
  },

  // === METADATA ===
  metadata: {
    lastCalculated: Timestamp,
    calculatedBy: "system",
    updatedAt: Timestamp,
    version: 1
  }
}
```

### Índices necesarios:
- `employeeId` + `year`
- `year`

---

## 6️⃣ PAYROLL_PERIODS (períodos de nómina)

**Períodos de nómina (quincenal/semanal). Uno por período.**

### Documento: `/payroll_periods/{periodId}`

Ejemplo ID: `2026-01-01_2026-01-15`

```javascript
{
  // === IDENTIFICACIÓN ===
  periodId: "2026-01-01_2026-01-15",
  payrollType: "biweekly",           // biweekly | weekly

  // === FECHAS ===
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-15",
    year: 2026,
    month: 1,
    periodNumber: 1,                 // 1ra o 2da quincena, o semana del año
    paymentDate: "2026-01-16",       // Fecha de pago

    // Días laborales
    totalCalendarDays: 15,
    totalWorkDays: 10,               // Excluyendo fines de semana y festivos
    holidays: ["2026-01-01"],        // Días festivos en el período
    weekends: 4                      // Días de fin de semana
  },

  // === ESTADO ===
  status: {
    current: "draft",                // draft | calculated | approved | paid | closed
    isLocked: false,                 // true = no se puede editar

    timeline: {
      createdAt: Timestamp,
      calculatedAt: null,
      approvedAt: null,
      paidAt: null,
      closedAt: null
    }
  },

  // === RESUMEN ===
  summary: {
    totalEmployees: 25,
    totalGrossPay: 200000,
    totalDeductions: 15000,
    totalNetPay: 185000,

    breakdown: {
      fullTimeEmployees: 20,
      interns: 5,
      activeEmployees: 25,
      employeesWithIssues: 2
    }
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    createdBy: "admin@cielitohome.com",
    updatedAt: Timestamp,
    calculatedBy: null,
    approvedBy: null,
    version: 1,
    notes: ""
  }
}
```

### Índices necesarios:
- `period.year` + `period.month`
- `status.current`
- `payrollType`

---

## 7️⃣ PAYROLL_ITEMS (detalles de nómina por empleado)

**Detalle de nómina de cada empleado en cada período.**

### Documento: `/payroll_items/{periodId}_{employeeId}`

Ejemplo ID: `2026-01-01_2026-01-15_ABC123`

```javascript
{
  // === IDENTIFICACIÓN ===
  periodId: "2026-01-01_2026-01-15",
  employeeId: "ABC123",
  employeeNumber: "EMP-001",
  employeeName: "Juan Pérez",
  employeeEmail: "juan@cielitohome.com",

  // === PERÍODO ===
  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-15",
    payrollType: "biweekly",
    paymentDate: "2026-01-16"
  },

  // === ASISTENCIA ===
  attendance: {
    expectedDays: 10,
    daysWorked: 9,
    daysAbsent: 1,
    daysOnLeave: 0,

    totalHours: 81,
    expectedHours: 90,
    overtimeHours: 0,

    incidents: {
      lateArrivals: 1,
      earlyDepartures: 0,
      unexcusedAbsences: 1
    }
  },

  // === CÁLCULOS ===
  calculations: {
    // Base
    baseSalary: 8000,
    payPerDay: 800,

    // Percepciones
    grossPay: 7200,                  // 9 días trabajados
    overtimePay: 0,
    bonuses: 0,
    totalPerceptions: 7200,

    // Deducciones
    deductions: {
      lateArrivals: 50,              // 1 retardo
      absences: 800,                 // 1 falta
      imss: 300,
      savingsFund: 500,
      other: 0,
      totalDeductions: 1650
    },

    // Neto
    netPay: 5550,

    // Referencias
    attendanceRecords: [             // IDs de attendance_daily
      "ABC123_2026-01-01",
      "ABC123_2026-01-02",
      // ...
    ],
    leaveRequests: []                // IDs de leave_requests aplicadas
  },

  // === AJUSTES MANUALES ===
  adjustments: [
    {
      type: "bonus",                 // bonus | deduction | correction
      amount: 500,
      reason: "Bono por desempeño",
      authorizedBy: "admin@cielitohome.com",
      authorizedAt: Timestamp
    }
  ],

  // === ESTADO ===
  status: {
    current: "calculated",           // draft | calculated | approved | paid
    isLocked: false,
    hasIssues: false,
    issues: [],

    // Pago
    paymentStatus: "pending",        // pending | paid | failed
    paymentDate: null,
    paymentMethod: "transfer",       // transfer | cash | check
    paymentReference: null
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    calculatedAt: Timestamp,
    calculatedBy: "system",
    updatedAt: Timestamp,
    version: 1,
    notes: ""
  }
}
```

### Índices necesarios:
- `periodId` + `employeeId`
- `employeeId`
- `status.current`

---

## 8️⃣ ROLES (roles del sistema)

**Roles disponibles en el sistema.**

### Documento: `/roles/{roleId}`

```javascript
{
  roleId: "hr_manager",
  name: "Gerente de RH",
  description: "Acceso completo a funciones de Recursos Humanos",

  permissions: [
    "employees.read",
    "employees.write",
    "attendance.read",
    "payroll.read",
    "payroll.write",
    "payroll.approve",
    "reports.read",
    "leave_requests.approve"
  ],

  priority: 90,                      // Mayor = más permisos
  isActive: true,

  metadata: {
    createdAt: Timestamp,
    updatedAt: Timestamp
  }
}
```

### Roles predefinidos:
- `super_admin` - Acceso total
- `hr_manager` - Gerente de RH
- `hr_staff` - Staff de RH
- `department_manager` - Jefe de área
- `employee` - Empleado estándar

---

## 9️⃣ PERMISSIONS (permisos de usuarios)

**Asignación de roles a usuarios. Subcollection de employees.**

### Documento: `/employees/{employeeId}/permissions/{permissionId}`

```javascript
{
  employeeId: "ABC123",
  role: "hr_manager",
  grantedBy: "admin@cielitohome.com",
  grantedAt: Timestamp,
  expiresAt: null,                   // null = no expira
  isActive: true
}
```

---

## 🔟 AUDIT_LOG (log de auditoría)

**Registro de TODAS las acciones importantes. CRÍTICO para compliance.**

### Documento: `/audit_log/{logId}`

```javascript
{
  // === IDENTIFICACIÓN ===
  action: "payroll.approve",         // Tipo de acción
  entity: "payroll_periods",         // Colección afectada
  entityId: "2026-01-01_2026-01-15", // ID del documento

  // === USUARIO ===
  actor: {
    employeeId: "ABC123",
    email: "admin@cielitohome.com",
    name: "Admin User",
    role: "hr_manager"
  },

  // === ACCIÓN ===
  details: {
    before: { status: "calculated" },
    after: { status: "approved" },
    reason: "Aprobación de nómina quincenal",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla...",

    // Metadata adicional según el tipo
    additionalData: {
      totalAmount: 185000,
      employeesAffected: 25
    }
  },

  // === TIMESTAMP ===
  timestamp: Timestamp,
  date: "2026-01-02",

  // === CATEGORÍA ===
  category: "payroll",               // payroll | attendance | employees | leaves | security
  severity: "high",                  // low | medium | high | critical

  // === METADATA ===
  metadata: {
    success: true,
    errorMessage: null,
    duration: 234                    // Milisegundos
  }
}
```

### Índices necesarios:
- `actor.employeeId` + `timestamp`
- `entity` + `entityId`
- `category` + `timestamp`
- `timestamp`

---

## 1️⃣1️⃣ QR_TOKENS (tokens QR temporales)

**Mantener estructura actual, solo renombrar campos para consistencia.**

```javascript
{
  qrCode: "OFICINA2025_ABC",
  token: "randomToken123",
  createdAt: Timestamp,
  expiresAt: Timestamp,
  used: false,
  usedBy: null,
  usedAt: null
}
```

---

## 1️⃣2️⃣ HOLIDAYS (días festivos)

**Renombrar de `dias_festivos` a `holidays` para consistencia.**

```javascript
{
  name: "Año Nuevo",
  date: "2026-01-01",
  year: 2026,
  isOfficial: true,                  // Oficial vs. empresa
  isPaid: true,
  isActive: true,

  metadata: {
    createdAt: Timestamp,
    createdBy: "admin@cielitohome.com"
  }
}
```

---

## 1️⃣3️⃣ INCIDENTS (incidencias disciplinarias)

**Nueva colección para actas administrativas e incidencias.**

```javascript
{
  // === IDENTIFICACIÓN ===
  employeeId: "ABC123",
  employeeEmail: "juan@cielitohome.com",
  employeeName: "Juan Pérez",

  // === INCIDENCIA ===
  incident: {
    type: "warning",                 // warning | suspension | termination | other
    category: "attendance",          // attendance | conduct | performance | policy
    severity: "medium",              // low | medium | high | critical

    date: "2026-01-15",
    description: "Retardos repetidos en enero",

    relatedEvents: [                 // Referencias a eventos relacionados
      {
        type: "attendance_event",
        id: "evt_123",
        date: "2026-01-05"
      }
    ]
  },

  // === ACTA ADMINISTRATIVA ===
  document: {
    generated: true,
    pdfUrl: "gs://bucket/actas/acta_123.pdf",
    documentNumber: "ACTA-2026-001",
    signedBy: ["admin@cielitohome.com", "juan@cielitohome.com"],
    signedAt: Timestamp
  },

  // === RESOLUCIÓN ===
  resolution: {
    status: "active",                // active | resolved | appealed
    action: "written_warning",       // verbal_warning | written_warning | suspension | termination
    followUpRequired: true,
    followUpDate: "2026-02-15",
    notes: "Seguimiento en un mes"
  },

  // === METADATA ===
  metadata: {
    createdAt: Timestamp,
    createdBy: "admin@cielitohome.com",
    updatedAt: Timestamp,
    version: 1
  }
}
```

---

## 1️⃣4️⃣ SETTINGS (configuración del sistema)

**Configuración global del sistema.**

### Documento: `/settings/system`

```javascript
{
  // === HORARIOS ===
  attendance: {
    standardStartTime: "08:00",
    standardEndTime: "17:00",
    toleranceMinutes: 10,
    minimumCheckOutTimeIntern: "13:00",
    minimumCheckOutTimeFullTime: "16:00",
    registrationWindowStart: "07:00",
    registrationWindowEnd: "22:00"
  },

  // === GEOLOCALIZACIÓN ===
  location: {
    office: {
      lat: 21.92545657925517,
      lng: -102.31327431392519,
      radiusMeters: 40
    },
    requireLocation: true
  },

  // === NÓMINA ===
  payroll: {
    defaultPayrollType: "biweekly",
    lateArrivalDeduction: 50,
    lateArrivalsBeforeDeduction: 3,
    imssDeduction: 300,
    paymentDay: 16                   // Día del mes para pago
  },

  // === VACACIONES ===
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
      5: 14
      // ...
    }
  },

  // === SEGURIDAD ===
  security: {
    requireQRValidation: true,
    qrTokenExpirationMinutes: 5,
    sessionTimeoutMinutes: 480,
    maxLoginAttempts: 5
  },

  // === METADATA ===
  metadata: {
    updatedAt: Timestamp,
    updatedBy: "admin@cielitohome.com",
    version: 1
  }
}
```

---

## 📊 COMPARACIÓN: ESTRUCTURA VIEJA VS NUEVA

| Aspecto | Estructura Vieja | Estructura Nueva |
|---------|-----------------|------------------|
| **Usuarios** | Todo mezclado en `usuarios` | Separado en `employees` con estructura clara |
| **Asistencia** | Solo `registros` (eventos) | `attendance_events` + `attendance_daily` (consolidado) |
| **Auditoría** | ❌ No existe | ✅ `audit_log` completo |
| **Roles** | Hardcoded en código | ✅ `roles` + `permissions` (subcollection) |
| **Vacaciones** | Mezclado con permisos | `leave_requests` + `leave_balances` |
| **Nómina** | `nominas` (plana) | `payroll_periods` + `payroll_items` |
| **Nombres** | Inconsistentes (español/inglés) | ✅ Consistentes (inglés) |
| **Versionado** | ❌ No existe | ✅ Campo `version` en docs críticos |
| **Datos anidados** | ❌ Requieren índices complejos | ✅ Estructura plana indexable |

---

## 🔐 REGLAS DE SEGURIDAD (FIRESTORE RULES)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Usuario autenticado
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: Es el mismo empleado
    function isOwner(employeeId) {
      return request.auth.uid == employeeId;
    }

    // Helper: Tiene rol específico
    function hasRole(role) {
      return exists(/databases/$(database)/documents/employees/$(request.auth.uid)/permissions/$(role));
    }

    // Helper: Es admin o HR
    function isAdminOrHR() {
      return hasRole('super_admin') || hasRole('hr_manager') || hasRole('hr_staff');
    }

    // === EMPLOYEES ===
    match /employees/{employeeId} {
      // Leer: el mismo usuario o admin/HR
      allow read: if isAuthenticated() && (isOwner(employeeId) || isAdminOrHR());

      // Escribir: solo admin/HR
      allow write: if isAdminOrHR();

      // Permisos (subcollection)
      match /permissions/{permissionId} {
        allow read: if isAuthenticated();
        allow write: if hasRole('super_admin');
      }
    }

    // === ATTENDANCE_EVENTS ===
    match /attendance_events/{eventId} {
      // Crear: cualquier usuario autenticado (para su propio check-in)
      allow create: if isAuthenticated() && request.resource.data.employeeId == request.auth.uid;

      // Leer: el mismo usuario o admin/HR
      allow read: if isAuthenticated() && (
        resource.data.employeeId == request.auth.uid || isAdminOrHR()
      );

      // No se puede modificar o eliminar (son inmutables)
      allow update, delete: if false;
    }

    // === ATTENDANCE_DAILY ===
    match /attendance_daily/{dailyId} {
      // Leer: el mismo usuario o admin/HR
      allow read: if isAuthenticated() && (
        resource.data.employeeId == request.auth.uid || isAdminOrHR()
      );

      // Crear/Actualizar: sistema o admin/HR (no empleados normales)
      allow create, update: if isAdminOrHR();

      // No se puede eliminar
      allow delete: if false;
    }

    // === LEAVE_REQUESTS ===
    match /leave_requests/{requestId} {
      // Crear: cualquier empleado para sí mismo
      allow create: if isAuthenticated() && request.resource.data.employeeId == request.auth.uid;

      // Leer: el mismo usuario, su jefe, o admin/HR
      allow read: if isAuthenticated() && (
        resource.data.employeeId == request.auth.uid ||
        isAdminOrHR() ||
        hasRole('department_manager')
      );

      // Actualizar: admin/HR (para aprobar/rechazar)
      allow update: if isAdminOrHR() || hasRole('department_manager');

      // Eliminar: solo si está pendiente y es el creador
      allow delete: if isAuthenticated() &&
        resource.data.employeeId == request.auth.uid &&
        resource.data.approval.status == 'pending';
    }

    // === PAYROLL (períodos e items) ===
    match /payroll_periods/{periodId} {
      allow read: if isAdminOrHR();
      allow write: if hasRole('super_admin') || hasRole('hr_manager');
    }

    match /payroll_items/{itemId} {
      // Leer: el mismo empleado (su recibo) o admin/HR
      allow read: if isAuthenticated() && (
        resource.data.employeeId == request.auth.uid || isAdminOrHR()
      );

      // Escribir: solo admin/HR
      allow write: if isAdminOrHR();
    }

    // === AUDIT_LOG ===
    match /audit_log/{logId} {
      // Solo lectura para admin
      allow read: if hasRole('super_admin');

      // Crear: backend (no frontend)
      allow create: if false;

      // No se puede modificar o eliminar
      allow update, delete: if false;
    }

    // === SETTINGS ===
    match /settings/{doc} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }

    // === ROLES ===
    match /roles/{roleId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin');
    }

    // === QR_TOKENS ===
    match /qr_tokens/{tokenId} {
      allow read, write: if isAuthenticated();
    }

    // === HOLIDAYS ===
    match /holidays/{holidayId} {
      allow read: if isAuthenticated();
      allow write: if isAdminOrHR();
    }

    // === INCIDENTS ===
    match /incidents/{incidentId} {
      // Leer: el mismo empleado o admin/HR
      allow read: if isAuthenticated() && (
        resource.data.employeeId == request.auth.uid || isAdminOrHR()
      );

      // Escribir: solo admin/HR
      allow write: if isAdminOrHR();
    }
  }
}
```

---

## ✅ CHECKLIST DE MIGRACIÓN

### Fase 1: Preparación
- [ ] Backup completo de Firestore actual
- [ ] Crear nuevo proyecto Firebase (opcional, para testing)
- [ ] Documentar estructura actual completa
- [ ] Crear scripts de migración
- [ ] Definir plan de rollback

### Fase 2: Infraestructura
- [ ] Crear índices en Firestore Console
- [ ] Aplicar reglas de seguridad nuevas
- [ ] Configurar colección `settings`
- [ ] Crear roles base (`super_admin`, `hr_manager`, etc.)

### Fase 3: Migración de Datos (colección por colección)
- [ ] Migrar `usuarios` → `employees`
- [ ] Migrar `registros` → `attendance_events`
- [ ] Generar `attendance_daily` desde eventos históricos
- [ ] Migrar `ausencias` → `leave_requests`
- [ ] Crear `leave_balances` por empleado
- [ ] Migrar `nominas` → `payroll_periods` + `payroll_items`
- [ ] Migrar `dias_festivos` → `holidays`
- [ ] Crear `audit_log` (empezar desde cero con nuevos eventos)
- [ ] Migrar `qr_tokens` (renombrar campos si es necesario)

### Fase 4: Código
- [ ] Actualizar constants.js con nuevos nombres
- [ ] Actualizar servicios (UserService, AttendanceService, etc.)
- [ ] Crear AuditService
- [ ] Crear RoleService
- [ ] Actualizar controladores
- [ ] Actualizar frontend

### Fase 5: Testing
- [ ] Probar creación de empleados
- [ ] Probar check-in/check-out
- [ ] Probar consolidación diaria
- [ ] Probar solicitudes de vacaciones
- [ ] Probar cálculo de nómina
- [ ] Probar auditoría
- [ ] Probar roles y permisos

### Fase 6: Producción
- [ ] Ejecutar migración en producción (horario de baja demanda)
- [ ] Validar datos migrados
- [ ] Monitorear errores
- [ ] Limpiar colecciones viejas (después de validación completa)

---

## 🚀 PRÓXIMOS PASOS

1. **Revisar esta especificación** y aprobarla
2. **Crear scripts de migración** automatizados
3. **Probar en ambiente de desarrollo** primero
4. **Ejecutar migración incremental** en producción

---

**¿Listo para empezar? Confirma y empezamos con los scripts de migración.**
