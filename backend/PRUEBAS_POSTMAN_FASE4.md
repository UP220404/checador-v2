# 🧪 Guía de Pruebas - FASE 4: Ausencias y Reportes

**Fecha:** 1 de Diciembre de 2025
**Módulos:** Ausencias + Reportes
**Endpoints nuevos:** 17 (10 ausencias + 7 reportes)

---

## 📋 Índice

1. [Preparación](#preparación)
2. [Módulo de Ausencias (10 endpoints)](#módulo-de-ausencias)
3. [Módulo de Reportes (7 endpoints)](#módulo-de-reportes)
4. [Casos de Prueba](#casos-de-prueba)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Preparación

### 1. Iniciar el servidor

```bash
cd backend
npm run dev
```

Deberías ver:
```
🚀 Servidor corriendo en puerto 3000
✅ Firebase Admin inicializado correctamente
```

### 2. Obtener Token de Administrador

```bash
# Método rápido:
obtener-token-RAPIDO.bat
```

O seguir las instrucciones en: `INSTRUCCIONES-TOKEN.md`

### 3. Configurar Postman

**Crear variable de entorno:**
- Variable: `AUTH_TOKEN`
- Valor: [Tu token de Firebase]

**Usar en headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

---

## 📝 Módulo de Ausencias

### Endpoint 1: Crear Ausencia

**POST** `/api/v1/absences`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body (Permiso con goce):**
```json
{
  "emailUsuario": "lenin.n@cielitohome.com",
  "nombreUsuario": "Lenin Navarro",
  "tipo": "permiso_con_goce",
  "fechaInicio": "2025-12-05",
  "fechaFin": "2025-12-05",
  "motivo": "Cita médica programada",
  "estado": "pendiente"
}
```

**Body (Retardo justificado):**
```json
{
  "emailUsuario": "lenin.n@cielitohome.com",
  "nombreUsuario": "Lenin Navarro",
  "tipo": "retardo_justificado",
  "fechaInicio": "2025-12-01",
  "motivo": "Tráfico por accidente en la vía",
  "estado": "pendiente",
  "correccionHora": {
    "horaCorregida": "08:00",
    "fechaEntrada": "2025-12-01",
    "registroId": "abc123xyz"
  }
}
```

**Respuesta esperada (201):**
```json
{
  "success": true,
  "message": "Ausencia creada correctamente",
  "data": {
    "id": "ausencia123",
    "emailUsuario": "lenin.n@cielitohome.com",
    "nombreUsuario": "Lenin Navarro",
    "tipo": "permiso_con_goce",
    "fechaInicio": "2025-12-05",
    "fechaFin": "2025-12-05",
    "motivo": "Cita médica programada",
    "estado": "pendiente",
    "quincena": {
      "mes": 12,
      "anio": 2025,
      "periodo": "primera",
      "periodoNumero": 1
    },
    "diasJustificados": 1,
    "aplicadaEnNomina": false
  }
}
```

**Tipos de ausencia válidos:**
- `permiso_con_goce` - Cuenta como día trabajado
- `permiso_sin_goce` - Descuenta del salario
- `vacaciones` - Cuenta como día trabajado
- `incapacidad` - Cuenta como día trabajado
- `retardo_justificado` - No cuenta como día (solo corrige hora)
- `falta_justificada` - Cuenta como día trabajado

---

### Endpoint 2: Listar Ausencias

**GET** `/api/v1/absences`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcionales):**
- `emailUsuario` - Filtrar por email
- `estado` - Filtrar por estado (pendiente, aprobado, rechazado)
- `tipo` - Filtrar por tipo de ausencia
- `mes` - Filtrar por mes (1-12)
- `anio` - Filtrar por año
- `periodo` - Filtrar por quincena (primera, segunda)

**Ejemplos:**

1. **Todas las ausencias:**
   ```
   GET /api/v1/absences
   ```

2. **Ausencias pendientes:**
   ```
   GET /api/v1/absences?estado=pendiente
   ```

3. **Ausencias de un usuario:**
   ```
   GET /api/v1/absences?emailUsuario=lenin.n@cielitohome.com
   ```

4. **Ausencias de diciembre 2025:**
   ```
   GET /api/v1/absences?mes=12&anio=2025
   ```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "ausencia1",
      "emailUsuario": "lenin.n@cielitohome.com",
      "nombreUsuario": "Lenin Navarro",
      "tipo": "permiso_con_goce",
      "estado": "pendiente",
      "diasJustificados": 1,
      // ... más campos
    }
  ]
}
```

---

### Endpoint 3: Obtener Ausencia por ID

**GET** `/api/v1/absences/:id`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/absences/ausencia123
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "id": "ausencia123",
    "emailUsuario": "lenin.n@cielitohome.com",
    "nombreUsuario": "Lenin Navarro",
    "tipo": "permiso_con_goce",
    "fechaInicio": "2025-12-05",
    "fechaFin": "2025-12-05",
    "motivo": "Cita médica programada",
    "estado": "pendiente",
    "diasJustificados": 1
  }
}
```

---

### Endpoint 4: Actualizar Ausencia

**PUT** `/api/v1/absences/:id`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "motivo": "Cita médica URGENTE",
  "comentariosAdmin": "Actualizado por solicitud del empleado"
}
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Ausencia actualizada correctamente",
  "data": {
    // Ausencia actualizada
  }
}
```

---

### Endpoint 5: Aprobar Ausencia

**PUT** `/api/v1/absences/:id/approve`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
PUT /api/v1/absences/ausencia123/approve
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Ausencia aprobada correctamente",
  "data": {
    "id": "ausencia123",
    "estado": "aprobado",
    "aprobadoPor": "admin@cielitohome.com",
    "fechaAprobacion": "2025-12-01T10:30:00.000Z"
  }
}
```

**Nota:** Si la ausencia es un retardo justificado, automáticamente aplicará la corrección de hora en el registro de asistencia.

---

### Endpoint 6: Rechazar Ausencia

**PUT** `/api/v1/absences/:id/reject`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "comentarios": "No hay evidencia suficiente para justificar la ausencia"
}
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Ausencia rechazada",
  "data": {
    "id": "ausencia123",
    "estado": "rechazado",
    "rechazadoPor": "admin@cielitohome.com",
    "comentariosAdmin": "No hay evidencia suficiente..."
  }
}
```

---

### Endpoint 7: Eliminar Ausencia

**DELETE** `/api/v1/absences/:id`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
DELETE /api/v1/absences/ausencia123
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Ausencia eliminada correctamente"
}
```

**Nota:** Si la ausencia fue un retardo justificado aplicado, automáticamente revierte la corrección de hora.

---

### Endpoint 8: Estadísticas de Ausencias

**GET** `/api/v1/absences/stats`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcionales):**
- `emailUsuario` - Estadísticas de un usuario
- `mes` - Mes específico
- `anio` - Año específico

**Ejemplo:**
```
GET /api/v1/absences/stats?mes=12&anio=2025
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "pendientes": 3,
    "aprobadas": 10,
    "rechazadas": 2,
    "porTipo": {
      "permiso_con_goce": 5,
      "vacaciones": 3,
      "retardo_justificado": 7
    },
    "diasJustificadosTotales": 12
  }
}
```

---

### Endpoint 9: Obtener Retardos de Usuario

**GET** `/api/v1/absences/retardos/:emailUsuario`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcionales):**
- `fechaInicio` - Fecha inicial (YYYY-MM-DD)
- `fechaFin` - Fecha final (YYYY-MM-DD)

**Ejemplo:**
```
GET /api/v1/absences/retardos/lenin.n@cielitohome.com?fechaInicio=2025-12-01&fechaFin=2025-12-15
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "registro1",
      "fecha": "2025-12-01",
      "hora": "08:15",
      "nombre": "Lenin Navarro"
    },
    {
      "id": "registro2",
      "fecha": "2025-12-05",
      "hora": "08:20",
      "nombre": "Lenin Navarro"
    }
  ]
}
```

**Uso:** Este endpoint se usa para seleccionar qué retardo se va a justificar.

---

### Endpoint 10: Revertir Corrección de Hora

**PUT** `/api/v1/absences/:id/revert-correction`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
PUT /api/v1/absences/ausencia123/revert-correction
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Corrección de hora revertida"
}
```

---

## 📊 Módulo de Reportes

### Endpoint 1: Reporte Diario de Asistencias

**GET** `/api/v1/reports/daily`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params:**
- `fecha` (requerido) - Fecha en formato YYYY-MM-DD

**Ejemplo:**
```
GET /api/v1/reports/daily?fecha=2025-12-01
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "fecha": "2025-12-01",
    "registros": {
      "lenin.n@cielitohome.com": {
        "nombre": "Lenin Navarro",
        "email": "lenin.n@cielitohome.com",
        "entradas": [
          {
            "hora": "08:05",
            "estado": "puntual"
          }
        ],
        "salidas": [
          {
            "hora": "16:30"
          }
        ]
      }
    },
    "estadisticas": {
      "fecha": "2025-12-01",
      "totalEmpleados": 15,
      "totalRegistros": 30,
      "puntuales": 12,
      "retardos": 3,
      "ausentes": 0
    }
  }
}
```

---

### Endpoint 2: Reporte Semanal de Asistencias

**GET** `/api/v1/reports/weekly`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params:**
- `fechaInicio` (requerido) - YYYY-MM-DD
- `fechaFin` (requerido) - YYYY-MM-DD

**Ejemplo:**
```
GET /api/v1/reports/weekly?fechaInicio=2025-12-01&fechaFin=2025-12-07
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "fechaInicio": "2025-12-01",
    "fechaFin": "2025-12-07",
    "totalUsuarios": 15,
    "totalRegistros": 150,
    "usuarios": {
      "lenin.n@cielitohome.com": {
        "nombre": "Lenin Navarro",
        "email": "lenin.n@cielitohome.com",
        "dias": {
          "2025-12-01": {
            "entradas": [{"hora": "08:05", "estado": "puntual"}],
            "salidas": [{"hora": "16:30"}]
          }
        },
        "estadisticas": {
          "diasAsistidos": 5,
          "retardos": 1,
          "diasPuntuales": 4
        }
      }
    }
  }
}
```

---

### Endpoint 3: Reporte de Ausencias

**GET** `/api/v1/reports/absences`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params:**
- `mes` (requerido) - 1-12
- `anio` (requerido) - Año

**Ejemplo:**
```
GET /api/v1/reports/absences?mes=12&anio=2025
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "mes": "12",
    "anio": "2025",
    "ausencias": [
      {
        "id": "ausencia1",
        "nombreUsuario": "Lenin Navarro",
        "tipo": "permiso_con_goce",
        "estado": "aprobado",
        "diasJustificados": 1
      }
    ],
    "estadisticas": {
      "total": 15,
      "porEstado": {
        "pendiente": 3,
        "aprobado": 10,
        "rechazado": 2
      },
      "porTipo": {
        "permiso_con_goce": 5,
        "vacaciones": 3,
        "retardo_justificado": 7
      },
      "diasJustificadosTotales": 12
    }
  }
}
```

---

### Endpoint 4: Reporte de Nómina

**GET** `/api/v1/reports/payroll/:periodoId`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/reports/payroll/2025-12-primera-quincenal
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "nomina": {
      "id": "2025-12-primera-quincenal",
      "periodo": {
        "mes": 12,
        "anio": 2025,
        "tipo": "quincenal"
      },
      "empleados": [
        {
          "nombre": "Lenin Navarro",
          "diasTrabajados": 10,
          "pagoTotal": 7000,
          "pagoFinal": 6700
        }
      ]
    },
    "estadisticas": {
      "totalEmpleados": 15,
      "totalPagar": 105000,
      "totalDescuentos": 4500,
      "totalNeto": 100500,
      "empleadosConDescuentos": 12,
      "empleadosConBonos": 3
    }
  }
}
```

---

### Endpoint 5: Exportar Asistencias a Excel

**GET** `/api/v1/reports/export/attendance-excel`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params:**
- `fechaInicio` (requerido)
- `fechaFin` (requerido)

**Ejemplo:**
```
GET /api/v1/reports/export/attendance-excel?fechaInicio=2025-12-01&fechaFin=2025-12-07
```

**Respuesta esperada:**
- Archivo Excel descargable
- Nombre: `asistencias_2025-12-01_2025-12-07.xlsx`
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Contenido del Excel:**
- Título con rango de fechas
- Tabla con: Nombre, Email, Días Asistidos, Días Puntuales, Retardos, Puntualidad %
- Formato profesional con colores

---

### Endpoint 6: Exportar Nómina a Excel

**GET** `/api/v1/reports/export/payroll-excel/:periodoId`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/reports/export/payroll-excel/2025-12-primera-quincenal
```

**Respuesta esperada:**
- Archivo Excel descargable
- Nombre: `nomina_2025-12-primera-quincenal.xlsx`

**Contenido del Excel:**
- Información del período
- Tabla completa de nómina
- Totales calculados
- Formato de moneda
- Datos bancarios

---

### Endpoint 7: Exportar Ausencias a PDF

**GET** `/api/v1/reports/export/absences-pdf`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params:**
- `mes` (requerido)
- `anio` (requerido)

**Ejemplo:**
```
GET /api/v1/reports/export/absences-pdf?mes=12&anio=2025
```

**Respuesta esperada:**
- Archivo PDF descargable
- Nombre: `ausencias_12_2025.pdf`
- Content-Type: `application/pdf`

**Contenido del PDF:**
- Título con período
- Resumen estadístico
- Listado detallado de ausencias
- Formato profesional

---

## 🧪 Casos de Prueba

### Caso 1: Flujo Completo de Ausencia

1. **Crear ausencia pendiente**
   ```
   POST /api/v1/absences
   - Estado: pendiente
   ```

2. **Listar ausencias pendientes**
   ```
   GET /api/v1/absences?estado=pendiente
   - Verificar que aparece
   ```

3. **Aprobar ausencia**
   ```
   PUT /api/v1/absences/{id}/approve
   - Verificar cambio de estado
   ```

4. **Verificar en estadísticas**
   ```
   GET /api/v1/absences/stats
   - Total aprobadas debe aumentar
   ```

---

### Caso 2: Retardo Justificado

1. **Obtener retardos del usuario**
   ```
   GET /api/v1/absences/retardos/email@example.com
   - Obtener ID del retardo
   ```

2. **Crear ausencia de retardo justificado**
   ```
   POST /api/v1/absences
   - Incluir registroId en correccionHora
   ```

3. **Aprobar retardo**
   ```
   PUT /api/v1/absences/{id}/approve
   - Verificar que se aplicó corrección
   ```

4. **Verificar registro corregido**
   ```
   GET /api/v1/attendance/history/{userId}
   - Registro debe tener estado=puntual
   - Debe tener corregidoPorAusencia=true
   ```

---

### Caso 3: Generación de Reportes

1. **Reporte semanal**
   ```
   GET /api/v1/reports/weekly?fechaInicio=2025-12-01&fechaFin=2025-12-07
   - Verificar datos
   ```

2. **Exportar a Excel**
   ```
   GET /api/v1/reports/export/attendance-excel?...
   - Descargar archivo
   - Abrir en Excel
   - Verificar formato
   ```

3. **Reporte de nómina**
   ```
   GET /api/v1/reports/payroll/2025-12-primera-quincenal
   - Verificar estadísticas
   ```

4. **Exportar nómina**
   ```
   GET /api/v1/reports/export/payroll-excel/...
   - Verificar datos bancarios
   ```

---

## ❌ Troubleshooting

### Error 401: Unauthorized

**Causa:** Token inválido o expirado

**Solución:**
```bash
# Generar nuevo token
obtener-token-RAPIDO.bat
# Actualizar variable AUTH_TOKEN en Postman
```

---

### Error 403: Forbidden

**Causa:** Usuario no es administrador

**Solución:**
- Verificar que el email esté en `ADMIN_EMAILS` en `.env`
- Reiniciar el servidor después de modificar `.env`

---

### Error 400: Campos obligatorios faltantes

**Causa:** Falta información requerida

**Campos obligatorios para crear ausencia:**
- `emailUsuario`
- `tipo`
- `fechaInicio`
- `motivo`

---

### Error 404: Ausencia no encontrada

**Causa:** ID de ausencia inválido

**Solución:**
- Verificar ID con `GET /api/v1/absences`
- Usar el ID correcto

---

### Excel/PDF no se descarga

**Causa:** Error en generación del archivo

**Solución:**
1. Ver logs del servidor
2. Verificar que existen datos para el período
3. Verificar que las dependencias están instaladas:
   ```bash
   npm install exceljs pdfkit
   ```

---

## 📊 Resumen de Endpoints

**Ausencias (10):**
1. POST `/api/v1/absences` - Crear
2. GET `/api/v1/absences` - Listar con filtros
3. GET `/api/v1/absences/:id` - Obtener por ID
4. PUT `/api/v1/absences/:id` - Actualizar
5. PUT `/api/v1/absences/:id/approve` - Aprobar
6. PUT `/api/v1/absences/:id/reject` - Rechazar
7. DELETE `/api/v1/absences/:id` - Eliminar
8. GET `/api/v1/absences/stats` - Estadísticas
9. GET `/api/v1/absences/retardos/:email` - Retardos
10. PUT `/api/v1/absences/:id/revert-correction` - Revertir

**Reportes (7):**
1. GET `/api/v1/reports/daily` - Reporte diario
2. GET `/api/v1/reports/weekly` - Reporte semanal
3. GET `/api/v1/reports/absences` - Reporte ausencias
4. GET `/api/v1/reports/payroll/:id` - Reporte nómina
5. GET `/api/v1/reports/export/attendance-excel` - Excel asistencias
6. GET `/api/v1/reports/export/payroll-excel/:id` - Excel nómina
7. GET `/api/v1/reports/export/absences-pdf` - PDF ausencias

---

**¡Fase 4 completa y lista para pruebas! 📊✨**
