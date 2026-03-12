# 📊 COMPARACIÓN: ESTRUCTURA ANTIGUA VS NUEVA

## ANTES (V1) vs DESPUÉS (V2)

---

## 1️⃣ USUARIOS / EMPLEADOS

### ❌ ANTES: `usuarios` (Estructura plana y desorganizada)

```javascript
{
  uid: "ABC123",
  nombre: "Juan Pérez García",
  correo: "juan@cielitohome.com",
  tipo: "tiempo_completo",
  activo: true,

  // Todo mezclado sin organización
  telefono: "4491234567",
  puesto: "Desarrollador",
  area: "Tecnología",
  salarioQuincenal: 8000,
  horasQuincenal: 90,
  tipoNomina: "quincenal",
  tieneIMSS: true,
  tieneCajaAhorro: true,
  montoCajaAhorro: 500,
  cuentaBancaria: "123456",
  nombreBanco: "BBVA",

  fechaCreacion: Timestamp,
  fechaIngreso: "2023-01-15"
}
```

**Problemas:**
- ❌ Todo mezclado en un solo nivel
- ❌ Sin separación entre datos personales y laborales
- ❌ Sin historial de cambios (salario, puesto)
- ❌ Sin permisos estructurados
- ❌ Sin versionado

---

### ✅ DESPUÉS: `employees` (Estructura organizada y clara)

```javascript
{
  uid: "ABC123",
  employeeNumber: "EMP-001",  // ← Nuevo: número de empleado

  // ===== DATOS PERSONALES (SEPARADOS) =====
  personalInfo: {
    firstName: "Juan",
    lastName: "Pérez García",
    fullName: "Juan Pérez García",
    email: "juan@cielitohome.com",
    phone: "4491234567",
    dateOfBirth: "1995-03-15",
    curp: "PEGJ950315HASRXN01",
    rfc: "PEGJ950315ABC",
    address: { ... }
  },

  // ===== DATOS LABORALES (SEPARADOS) =====
  employment: {
    status: "active",  // ← Nuevo: estado laboral
    hireDate: "2023-01-15",
    terminationDate: null,
    position: "Desarrollador",
    department: "Tecnología",
    employeeType: "full_time",
    schedule: { ... },
    reportsTo: { ... }  // ← Nuevo: jefatura
  },

  // ===== COMPENSACIÓN (SEPARADA) =====
  compensation: {
    payrollType: "biweekly",
    baseSalary: 8000,
    expectedHours: 90,
    payPerDay: 800,  // ← Nuevo: calculado
    benefits: { ... },
    bankAccount: { ... }
  },

  // ===== PERMISOS ESPECIALES =====
  specialPermissions: {  // ← Nuevo
    canWorkRemote: false,
    canCheckMultipleTimes: false,
    bypassLocationCheck: false,
    bypassScheduleCheck: false
  },

  // ===== METADATA =====
  metadata: {  // ← Nuevo
    createdAt: Timestamp,
    createdBy: "admin@...",
    updatedAt: Timestamp,
    updatedBy: "admin@...",
    version: 1,  // ← Versionado
    isActive: true,
    notes: ""
  }
}

// ===== SUBCOLLECTION: PERMISOS =====
// /employees/{employeeId}/permissions/{roleId}
{
  employeeId: "ABC123",
  role: "hr_manager",  // ← Nuevo: roles estructurados
  grantedBy: "admin@...",
  grantedAt: Timestamp,
  expiresAt: null,
  isActive: true
}
```

**Mejoras:**
- ✅ Datos organizados por categorías claras
- ✅ Separación entre personal, laboral y compensación
- ✅ Roles y permisos estructurados (subcollection)
- ✅ Versionado y metadata completa
- ✅ Historial de quién creó/modificó

---

## 2️⃣ ASISTENCIA

### ❌ ANTES: Solo `registros` (Eventos crudos, sin consolidación)

```javascript
// Colección: registros
{
  uid: "ABC123",
  nombre: "Juan Pérez",
  correo: "juan@...",
  tipo: "entrada",  // o "salida"
  fecha: "2026-01-02",
  hora: "08:05:23",
  timestamp: Timestamp,
  puntual: true,
  minutosRetardo: 0,
  // ... validaciones mezcladas
}
```

**Problemas:**
- ❌ Solo eventos crudos (entrada/salida)
- ❌ NO hay consolidación diaria
- ❌ Difícil calcular horas trabajadas
- ❌ Sin separación entre eventos y resumen
- ❌ La nómina tiene que calcular todo desde cero cada vez

---

### ✅ DESPUÉS: `attendance_events` + `attendance_daily` (Dos niveles)

#### Nivel 1: Eventos crudos (inmutables)

```javascript
// Colección: attendance_events
{
  employeeId: "ABC123",
  employeeEmail: "juan@...",
  employeeName: "Juan Pérez",

  eventType: "check_in",  // ← Renombrado
  eventDate: "2026-01-02",
  eventTime: "08:05:23",
  timestamp: Timestamp,

  validation: {  // ← Separado
    isOnTime: true,
    minutesLate: 0,
    isWithinSchedule: true,
    isWeekend: false,
    qrValidated: true,
    qrCode: "...",
    locationValidated: true,
    location: { ... }
  },

  metadata: {  // ← Nuevo
    createdAt: Timestamp,
    source: "web",
    ipAddress: "...",
    testMode: false
  }
}
```

#### Nivel 2: Consolidación diaria (calculada automáticamente)

```javascript
// Colección: attendance_daily
// ID: {employeeId}_{date} ej: "ABC123_2026-01-02"
{
  employeeId: "ABC123",
  employeeEmail: "juan@...",
  employeeName: "Juan Pérez",
  date: "2026-01-02",
  dayOfWeek: 4,

  period: {  // ← Nuevo: referencia al período de nómina
    year: 2026,
    month: 1,
    week: 1,
    payrollPeriod: "2026-01-01_2026-01-15",
    payrollType: "biweekly"
  },

  attendance: {
    status: "present",  // ← present | absent | leave | holiday

    checkIn: {
      time: "08:05:23",
      timestamp: Timestamp,
      isOnTime: true,
      minutesLate: 0,
      eventId: "evt_123"  // ← Referencia al evento
    },

    checkOut: {
      time: "17:10:15",
      timestamp: Timestamp,
      isEarlyDeparture: false,
      eventId: "evt_124"
    },

    // ← NUEVO: Cálculos automáticos
    hoursWorked: 9.08,
    expectedHours: 9,
    overtimeHours: 0.08,

    issues: {
      wasLate: false,
      wasAbsent: false,
      leftEarly: false,
      missingCheckOut: false
    }
  },

  leave: {  // ← Nuevo: integración con permisos
    hasLeave: false,
    leaveRequestId: null,
    leaveType: null,
    isApproved: null
  },

  payroll: {  // ← Nuevo: pre-cálculo para nómina
    shouldPay: true,
    paymentStatus: "pending",
    dayValue: 800,
    deductions: 0,
    netPay: 800,
    notes: ""
  },

  metadata: {
    createdAt: Timestamp,
    updatedAt: Timestamp,
    calculatedBy: "system",
    locked: false,  // ← true cuando está en nómina cerrada
    version: 1
  }
}
```

**Mejoras:**
- ✅ Separación clara: eventos vs consolidación
- ✅ Horas calculadas automáticamente
- ✅ Listo para nómina (pre-calculado)
- ✅ Referencia directa al período de nómina
- ✅ Integración con permisos/vacaciones
- ✅ Bloqueo cuando está en nómina cerrada

---

## 3️⃣ PERMISOS Y VACACIONES

### ❌ ANTES: `ausencias` (Todo mezclado, índices complejos)

```javascript
{
  emailUsuario: "juan@...",
  nombreUsuario: "Juan Pérez",
  tipo: "vacaciones",  // o permiso_con_goce, etc.
  fechaInicio: "2026-02-10",
  fechaFin: "2026-02-14",
  motivo: "Vacaciones familiares",
  estado: "pendiente",

  // ❌ Campos anidados que requieren índices complejos
  quincena: {
    periodo: 1,
    mes: 2,
    anio: 2026
  },

  diasJustificados: 5,
  aplicadaEnNomina: false,
  comentariosAdmin: ""
}
```

**Problemas:**
- ❌ No hay flujo de aprobación claro
- ❌ No hay saldo de vacaciones
- ❌ Campos anidados (`quincena.*`) requieren índices compuestos
- ❌ No separa permisos de vacaciones
- ❌ No hay validación de días disponibles

---

### ✅ DESPUÉS: `leave_requests` + `leave_balances` (Separadas)

#### Solicitudes (con flujo de aprobación)

```javascript
// Colección: leave_requests
{
  employeeId: "ABC123",
  employeeEmail: "juan@...",
  employeeName: "Juan Pérez",

  request: {
    type: "vacation",  // ← Renombrado
    startDate: "2026-02-10",
    endDate: "2026-02-14",
    totalDays: 5,
    reason: "Vacaciones familiares",
    attachments: [],

    vacationDetails: {  // ← Solo para vacaciones
      yearEarned: 2025,
      daysRequested: 5,
      remainingAfter: 1
    }
  },

  approval: {  // ← Nuevo: flujo de aprobación completo
    status: "pending",

    // Primer nivel: jefe
    managerApproval: {
      approved: null,
      approvedBy: null,
      approvedAt: null,
      comments: ""
    },

    // Segundo nivel: RH
    hrApproval: {
      approved: null,
      approvedBy: null,
      approvedAt: null,
      comments: ""
    },

    finalStatus: "pending",
    finalApprovedBy: null,
    finalApprovedAt: null,
    rejectionReason: null
  },

  integration: {  // ← Nuevo: integración con otros módulos
    appliedToAttendance: false,
    appliedToPayroll: false,
    payrollPeriods: [],
    attendanceDaysAffected: []
  },

  metadata: { ... }
}
```

#### Saldos (calculados automáticamente)

```javascript
// Colección: leave_balances
// ID: {employeeId}_{year} ej: "ABC123_2026"
{
  employeeId: "ABC123",
  employeeEmail: "juan@...",
  employeeName: "Juan Pérez",
  year: 2026,

  calculation: {  // ← Nuevo: cálculo de días
    hireDate: "2023-01-15",
    yearsOfService: 3,
    daysEarnedPerYear: 10,
    totalDaysEarned: 10,
    carryOverFromPreviousYear: 2,
    totalAvailable: 12
  },

  usage: {  // ← Nuevo: seguimiento de uso
    daysUsed: 5,
    daysPending: 2,
    daysAvailable: 5,

    requests: [  // Referencias
      {
        requestId: "req_123",
        startDate: "2026-02-10",
        endDate: "2026-02-14",
        days: 5,
        status: "approved"
      }
    ]
  },

  expiration: {  // ← Nuevo: vencimiento
    expiresAt: "2026-12-31",
    willExpire: 5,
    allowCarryOver: true,
    maxCarryOverDays: 5
  },

  metadata: { ... }
}
```

**Mejoras:**
- ✅ Flujo de aprobación estructurado (jefe → RH)
- ✅ Saldo de vacaciones separado y calculado
- ✅ Validación automática de días disponibles
- ✅ Integración clara con asistencia y nómina
- ✅ Sin campos anidados complejos
- ✅ Expiración y carry-over controlados

---

## 4️⃣ NÓMINA

### ❌ ANTES: `nominas` (Plana, sin detalles por empleado)

```javascript
{
  periodo: "2026-01-01_2026-01-15",
  fechaInicio: "2026-01-01",
  fechaFin: "2026-01-15",
  tipo: "quincenal",
  estado: "calculada",

  // ❌ Empleados como array (difícil de consultar)
  empleados: [
    {
      uid: "ABC123",
      nombre: "Juan Pérez",
      diasTrabajados: 9,
      sueldoBase: 8000,
      descuentos: 350,
      total: 7650
    },
    // ...
  ],

  totalEmpleados: 25,
  totalNomina: 185000
}
```

**Problemas:**
- ❌ Empleados como array (no queryable individualmente)
- ❌ Difícil obtener nómina de un empleado específico
- ❌ Sin detalles de cálculo
- ❌ Sin auditoría de cambios
- ❌ Sin recibos individuales

---

### ✅ DESPUÉS: `payroll_periods` + `payroll_items` (Separadas)

#### Períodos (resumen)

```javascript
// Colección: payroll_periods
// ID: período ej: "2026-01-01_2026-01-15"
{
  periodId: "2026-01-01_2026-01-15",
  payrollType: "biweekly",

  period: {
    startDate: "2026-01-01",
    endDate: "2026-01-15",
    year: 2026,
    month: 1,
    periodNumber: 1,
    paymentDate: "2026-01-16",

    totalCalendarDays: 15,
    totalWorkDays: 10,
    holidays: ["2026-01-01"],
    weekends: 4
  },

  status: {  // ← Nuevo: estado con timeline
    current: "draft",  // draft | calculated | approved | paid | closed
    isLocked: false,

    timeline: {
      createdAt: Timestamp,
      calculatedAt: null,
      approvedAt: null,
      paidAt: null,
      closedAt: null
    }
  },

  summary: {  // ← Nuevo: resumen
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

  metadata: { ... }
}
```

#### Items (detalle por empleado)

```javascript
// Colección: payroll_items
// ID: {periodId}_{employeeId} ej: "2026-01-01_2026-01-15_ABC123"
{
  periodId: "2026-01-01_2026-01-15",
  employeeId: "ABC123",
  employeeNumber: "EMP-001",
  employeeName: "Juan Pérez",

  period: { ... },

  attendance: {  // ← Nuevo: detalle de asistencia
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

  calculations: {  // ← Nuevo: cálculos detallados
    baseSalary: 8000,
    payPerDay: 800,

    grossPay: 7200,  // 9 días
    overtimePay: 0,
    bonuses: 0,
    totalPerceptions: 7200,

    deductions: {
      lateArrivals: 50,
      absences: 800,
      imss: 300,
      savingsFund: 500,
      other: 0,
      totalDeductions: 1650
    },

    netPay: 5550,

    // ← Referencias a datos originales
    attendanceRecords: [
      "ABC123_2026-01-01",
      "ABC123_2026-01-02",
      // ...
    ],
    leaveRequests: []
  },

  adjustments: [  // ← Nuevo: ajustes manuales auditados
    {
      type: "bonus",
      amount: 500,
      reason: "Bono por desempeño",
      authorizedBy: "admin@...",
      authorizedAt: Timestamp
    }
  ],

  status: {
    current: "calculated",
    isLocked: false,
    hasIssues: false,
    issues: [],

    paymentStatus: "pending",
    paymentDate: null,
    paymentMethod: "transfer",
    paymentReference: null
  },

  metadata: { ... }
}
```

**Mejoras:**
- ✅ Separación: período vs items individuales
- ✅ Queryable por empleado fácilmente
- ✅ Cálculos detallados y trazables
- ✅ Ajustes manuales auditados
- ✅ Estados claros con timeline
- ✅ Referencias a asistencia y permisos
- ✅ Recibos individuales fáciles de generar

---

## 5️⃣ NUEVAS COLECCIONES (NO EXISTÍAN ANTES)

### ✅ `audit_log` - Auditoría completa

```javascript
{
  action: "payroll.approve",
  entity: "payroll_periods",
  entityId: "2026-01-01_2026-01-15",

  actor: {
    employeeId: "ABC123",
    email: "admin@...",
    name: "Admin User",
    role: "hr_manager"
  },

  details: {
    before: { status: "calculated" },
    after: { status: "approved" },
    reason: "Aprobación de nómina",
    ipAddress: "192.168.1.100",
    userAgent: "...",
    additionalData: { ... }
  },

  timestamp: Timestamp,
  category: "payroll",
  severity: "high"
}
```

**Beneficios:**
- ✅ Trazabilidad completa
- ✅ Protección legal
- ✅ Detectar fraudes
- ✅ Cumplimiento normativo

---

### ✅ `roles` - Roles estructurados

```javascript
{
  roleId: "hr_manager",
  name: "Gerente de RH",
  description: "...",
  permissions: [
    "employees.read",
    "employees.write",
    "payroll.approve",
    // ...
  ],
  priority: 90,
  isActive: true
}
```

**Beneficios:**
- ✅ Sin emails hardcoded
- ✅ Permisos granulares
- ✅ Fácil de mantener
- ✅ Escalable

---

### ✅ `settings` - Configuración central

```javascript
{
  attendance: {
    standardStartTime: "08:00",
    standardEndTime: "17:00",
    toleranceMinutes: 10,
    // ...
  },

  location: {
    office: { lat: ..., lng: ..., radiusMeters: 40 },
    requireLocation: true
  },

  payroll: {
    lateArrivalDeduction: 50,
    imssDeduction: 300,
    // ...
  },

  leaves: {
    vacationDaysByYear: {
      1: 6,
      2: 8,
      3: 10,
      // ...
    }
  }
}
```

**Beneficios:**
- ✅ Sin valores hardcoded
- ✅ Configurable sin código
- ✅ Centralizado
- ✅ Versionado

---

### ✅ `incidents` - Incidencias disciplinarias

```javascript
{
  employeeId: "ABC123",

  incident: {
    type: "warning",
    category: "attendance",
    severity: "medium",
    date: "2026-01-15",
    description: "Retardos repetidos",
    relatedEvents: [ ... ]
  },

  document: {
    generated: true,
    pdfUrl: "...",
    documentNumber: "ACTA-2026-001",
    signedBy: [ ... ]
  },

  resolution: {
    status: "active",
    action: "written_warning",
    followUpRequired: true,
    followUpDate: "2026-02-15"
  }
}
```

**Beneficios:**
- ✅ Historial disciplinario
- ✅ Actas administrativas digitales
- ✅ Seguimiento de acciones
- ✅ Protección legal

---

## 📊 RESUMEN DE MEJORAS

| Aspecto | Antes (V1) | Después (V2) | Mejora |
|---------|-----------|--------------|--------|
| **Estructura de datos** | Plana, desorganizada | Jerárquica, clara | 🔥🔥🔥 |
| **Auditoría** | ❌ No existe | ✅ Completa | 🔥🔥🔥 |
| **Roles y permisos** | Hardcoded | Estructurado | 🔥🔥🔥 |
| **Consolidación asistencia** | ❌ No existe | ✅ Automática | 🔥🔥🔥 |
| **Flujo de aprobación** | ❌ Básico | ✅ Completo | 🔥🔥 |
| **Nómina por empleado** | Array (difícil) | Colección separada | 🔥🔥🔥 |
| **Saldo de vacaciones** | ❌ No existe | ✅ Automático | 🔥🔥 |
| **Incidencias** | ❌ No existe | ✅ Con actas | 🔥🔥 |
| **Configuración** | Hardcoded | Centralizada | 🔥🔥 |
| **Versionado** | ❌ No existe | ✅ Sí | 🔥🔥 |
| **Índices complejos** | ❌ Necesarios | ✅ Simples | 🔥 |
| **Queryability** | Difícil | Fácil | 🔥🔥 |
| **Escalabilidad** | Limitada | Alta | 🔥🔥🔥 |

---

## 🎯 CONCLUSIÓN

La nueva estructura V2 es:

✅ **Más organizada** - Datos jerárquicos y claros
✅ **Más completa** - Auditoría, roles, incidencias
✅ **Más eficiente** - Consolidación automática
✅ **Más segura** - Versionado, auditoría, permisos granulares
✅ **Más escalable** - Fácil de mantener y extender
✅ **Más profesional** - Lista para compliance y auditorías

**La migración vale totalmente la pena.** 🚀
