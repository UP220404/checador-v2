# 🧪 GUÍA DE PRUEBAS POSTMAN - FASE 3
## Módulo de Nómina

---

## 📋 ÍNDICE

1. [Configuración Inicial](#configuración-inicial)
2. [Endpoints de Consulta](#endpoints-de-consulta)
3. [Cálculo de Nómina](#cálculo-de-nómina)
4. [Guardado y Recuperación](#guardado-y-recuperación)
5. [Edición Manual](#edición-manual)
6. [Casos de Prueba](#casos-de-prueba)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Configuración Inicial

### Variables de Entorno en Postman

Asegúrate de tener configuradas estas variables:

```
BASE_URL: http://localhost:3000
API_VERSION: /api/v1
AUTH_TOKEN: [tu_firebase_token_admin]
```

**IMPORTANTE:** Para todos los endpoints de nómina necesitas:
- ✅ Token de autenticación válido
- ✅ Usuario con privilegios de **ADMIN**

---

## 📊 ENDPOINTS DE CONSULTA

### 1. Obtener Empleados con Configuración de Nómina

**Endpoint:** `GET /api/v1/payroll/employees`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcional):**
```
tipoNomina=quincenal
```

**Ejemplo:**
```
GET /api/v1/payroll/employees?tipoNomina=quincenal
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "uid": "abc123",
      "nombre": "Lenin Navarro",
      "email": "sistemas16ch@gmail.com",
      "tipo": "tiempo_completo",
      "tipoNomina": "quincenal",
      "salarioQuincenal": 7000,
      "horasQuincenal": 80,
      "pagoPorDia": 700,
      "tieneIMSS": true,
      "tieneCajaAhorro": false,
      "montoCajaAhorro": 0,
      "cuentaBancaria": "1234567890",
      "nombreBanco": "BBVA"
    }
    // ... más empleados
  ]
}
```

**Uso:** Ver qué empleados tienen configuración de nómina antes de calcular.

---

### 2. Obtener Semanas del Mes (para nómina semanal)

**Endpoint:** `GET /api/v1/payroll/weeks/:anio/:mes`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/payroll/weeks/2025/12
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "numero": 1,
      "inicio": 1,
      "fin": 5,
      "label": "Semana 1 (1-5)"
    },
    {
      "numero": 2,
      "inicio": 6,
      "fin": 12,
      "label": "Semana 2 (6-12)"
    },
    {
      "numero": 3,
      "inicio": 13,
      "fin": 19,
      "label": "Semana 3 (13-19)"
    },
    {
      "numero": 4,
      "inicio": 20,
      "fin": 26,
      "label": "Semana 4 (20-26)"
    },
    {
      "numero": 5,
      "inicio": 27,
      "fin": 31,
      "label": "Semana 5 (27-31)"
    }
  ]
}
```

**Uso:** Determinar qué semanas usar para calcular nómina semanal.

---

## 💰 CÁLCULO DE NÓMINA

### 3. Calcular Nómina Quincenal (sin guardar)

**Endpoint:** `POST /api/v1/payroll/calculate`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body (Primera Quincena):**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "primera",
  "tipoNomina": "quincenal"
}
```

**Body (Segunda Quincena):**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "segunda",
  "tipoNomina": "quincenal"
}
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "data": {
    "periodo": {
      "mes": 12,
      "anio": 2025,
      "periodo": "primera",
      "tipoNomina": "quincenal",
      "diasLaborales": 10
    },
    "resumen": {
      "totalEmpleados": 12,
      "totalRetardos": 5,
      "empleadosConDescuento": 2,
      "totalNominaFinal": 84000
    },
    "empleados": [
      {
        "empleado": {
          "uid": "abc123",
          "nombre": "Lenin Navarro",
          "email": "sistemas16ch@gmail.com",
          "tipo": "tiempo_completo",
          "tipoNomina": "quincenal"
        },
        "salarioQuincenal": 7000,
        "diasLaboralesEsperados": 10,
        "diasLaboralesReales": 10,
        "diasTrabajados": 10,
        "diasTrabajadosReales": 10,
        "diasFaltantes": 0,
        "retardos": 0,
        "retardosCorregidos": 0,
        "diasDescuento": 0,
        "diasEfectivos": 10,
        "diasJustificados": 0,
        "justificacionesDetalle": [],
        "tieneAusencias": false,
        "tieneCorrecciones": false,
        "pagoPorDia": 700,
        "pagoTotal": 7000,
        "descuentoIMSS": 300,
        "descuentoCaja": 0,
        "totalDescuentos": 300,
        "pagoFinal": 6700,
        "status": "Sin penalizaciones",
        "statusClass": "status-ok",
        "detalleRetardos": [],
        "diasAsistidos": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
        "diasFaltantesDetalle": []
      }
      // ... más empleados
    ],
    "calculadoEn": "2025-12-01T10:30:00.000Z"
  }
}
```

**Uso:** Pre-visualizar la nómina antes de guardarla.

---

### 4. Calcular Nómina Semanal

**Endpoint:** `POST /api/v1/payroll/calculate`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "semana_1",
  "tipoNomina": "semanal"
}
```

**Nota:** El período puede ser `semana_1`, `semana_2`, `semana_3`, `semana_4`, o `semana_5` (según el mes).

**Respuesta:** Similar a la nómina quincenal, pero con `diasLaboralesEsperados: 5`.

---

### 5. Calcular y Guardar en un Solo Paso

**Endpoint:** `POST /api/v1/payroll/calculate-and-save`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "primera",
  "tipoNomina": "quincenal"
}
```

**Respuesta (201 CREATED):**
```json
{
  "success": true,
  "message": "Nómina calculada y guardada exitosamente",
  "data": {
    "periodo": { /* ... */ },
    "resumen": { /* ... */ },
    "empleados": [ /* ... */ ],
    "calculadoEn": "2025-12-01T10:30:00.000Z",
    "guardadoEn": "2025-12-primera-quincenal"
  }
}
```

**Uso:** Método rápido para calcular y guardar la nómina en un solo paso.

---

## 💾 GUARDADO Y RECUPERACIÓN

### 6. Guardar Nómina Previamente Calculada

**Endpoint:** `POST /api/v1/payroll/save`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "primera",
  "tipoNomina": "quincenal",
  "resultados": [ /* array de empleados con cálculos */ ],
  "resumen": {
    "totalEmpleados": 12,
    "totalRetardos": 5,
    "empleadosConDescuento": 2,
    "totalNominaFinal": 84000
  }
}
```

**Respuesta (201 CREATED):**
```json
{
  "success": true,
  "message": "Nómina guardada exitosamente",
  "data": {
    "id": "2025-12-primera-quincenal"
  }
}
```

**Uso:** Guardar una nómina que ya fue calculada y revisada.

---

### 7. Obtener Nómina Guardada por ID

**Endpoint:** `GET /api/v1/payroll/:periodoId`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Ejemplo:**
```
GET /api/v1/payroll/2025-12-primera-quincenal
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "2025-12-primera-quincenal",
    "periodo": {
      "mes": 12,
      "anio": 2025,
      "periodo": "primera",
      "tipoNomina": "quincenal"
    },
    "resumen": { /* ... */ },
    "empleados": [ /* ... */ ],
    "calculadoPor": "abc123-user-id",
    "calculadoEn": "2025-12-01T10:30:00.000Z",
    "ultimaActualizacion": "2025-12-01T10:30:00.000Z"
  }
}
```

**Errores:**
- **404 Not Found:** Nómina no existe

---

### 8. Obtener Nóminas por Período (mes/año)

**Endpoint:** `GET /api/v1/payroll/period/:mes/:anio`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
```

**Query Params (opcional):**
```
tipoNomina=quincenal
```

**Ejemplo:**
```
GET /api/v1/payroll/period/12/2025?tipoNomina=quincenal
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "2025-12-primera-quincenal",
      "periodo": { /* ... */ },
      "resumen": { /* ... */ }
    },
    {
      "id": "2025-12-segunda-quincenal",
      "periodo": { /* ... */ },
      "resumen": { /* ... */ }
    }
  ]
}
```

**Uso:** Ver todas las nóminas guardadas de un mes específico.

---

## ✏️ EDICIÓN MANUAL

### 9. Actualizar Concepto Manual (bonos, deducciones)

**Endpoint:** `PUT /api/v1/payroll/:periodoId/employee/:empleadoId/concept`

**Headers:**
```
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
```

**Body (agregar bono):**
```json
{
  "concepto": "bono",
  "valor": 500
}
```

**Body (agregar deducción):**
```json
{
  "concepto": "descuento_especial",
  "valor": -200
}
```

**Ejemplo:**
```
PUT /api/v1/payroll/2025-12-primera-quincenal/employee/abc123/concept
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "message": "Concepto actualizado exitosamente",
  "data": {
    "empleado": { /* ... */ },
    "pagoFinal": 6700,
    "conceptosManuales": {
      "bono": {
        "valor": 500,
        "actualizadoPor": "xyz789-user-id",
        "actualizadoEn": "2025-12-01T11:00:00.000Z"
      }
    },
    "pagoFinalAjustado": 7200
  }
}
```

**Uso:** Agregar bonos, deducciones o ajustes manuales a la nómina de un empleado.

**Errores:**
- **404 Not Found:** Nómina o empleado no encontrado
- **400 Bad Request:** Valor no es un número

---

## 🧪 CASOS DE PRUEBA

### Caso 1: Nómina con Retardos

**Escenario:**
- Empleado tiene 4 retardos en la quincena
- Se debe descontar 1 día

**Body de cálculo:**
```json
{
  "mes": 12,
  "anio": 2025,
  "periodo": "primera",
  "tipoNomina": "quincenal"
}
```

**Verificar en la respuesta:**
```json
{
  "retardos": 4,
  "diasDescuento": 1,
  "diasEfectivos": 9,
  "status": "Descuento: 1 día",
  "statusClass": "status-penalty"
}
```

---

### Caso 2: Nómina con Ausencias Justificadas

**Requisitos previos:**
- Empleado debe tener ausencias aprobadas en el período
- Ausencias deben estar en la colección `ausencias` en Firestore

**Verificar en la respuesta:**
```json
{
  "diasTrabajados": 10,
  "diasTrabajadosReales": 8,
  "diasJustificados": 2,
  "tieneAusencias": true,
  "justificacionesDetalle": [
    {
      "tipo": "permiso_con_goce",
      "dias": 2,
      "motivo": "Cita médica",
      "nombreTipo": "Permiso con goce",
      "fechaInicio": "2025-12-05",
      "fechaFin": "2025-12-06"
    }
  ]
}
```

---

### Caso 3: Nómina con IMSS y Caja de Ahorro

**Configuración del empleado:**
- `tieneIMSS: true`
- `tieneCajaAhorro: true`
- `montoCajaAhorro: 200`

**Verificar en la respuesta (quincenal):**
```json
{
  "pagoTotal": 7000,
  "descuentoIMSS": 300,
  "descuentoCaja": 200,
  "totalDescuentos": 500,
  "pagoFinal": 6500
}
```

**Para nómina semanal, descuentos se reducen a la mitad:**
```json
{
  "descuentoIMSS": 150,
  "descuentoCaja": 100,
  "totalDescuentos": 250
}
```

---

### Caso 4: Empleado Sin Configuración de Salario

**Escenario:**
- Empleado existe en `usuarios` pero no tiene `salarioQuincenal` o `horasQuincenal`

**Resultado:**
- No aparece en la nómina calculada
- No genera error

**Solución:**
- Ir a `POST /api/v1/users/:uid` o actualizar directamente en Firestore

---

### Caso 5: Período Sin Registros de Asistencia

**Escenario:**
- Mes/período sin registros en la colección `registros`

**Verificar en la respuesta:**
```json
{
  "diasTrabajados": 0,
  "diasFaltantes": 10,
  "retardos": 0,
  "pagoTotal": 0,
  "pagoFinal": -300,  // Solo descuentos (IMSS/Caja)
  "status": "10 faltas • 0 retardos",
  "statusClass": "status-penalty"
}
```

---

### Caso 6: Días Festivos Excluidos

**Requisitos previos:**
- Agregar días festivos a Firestore en la colección `diasFestivos`

**Formato del documento:**
```json
{
  "año": 2025,
  "fecha": "2025-12-25",
  "nombre": "Navidad",
  "tipo": "federal"
}
```

**Resultado:**
- Días festivos NO cuentan como días laborales
- Se excluyen del cálculo de faltas

---

## 🔍 TROUBLESHOOTING

### Error: "Faltan parámetros requeridos"

**Problema:** No enviaste mes, año o período

**Solución:** Verifica el body:
```json
{
  "mes": 12,        // requerido
  "anio": 2025,     // requerido
  "periodo": "primera",  // requerido
  "tipoNomina": "quincenal"  // opcional (default: quincenal)
}
```

---

### Error: "El mes debe estar entre 1 y 12"

**Problema:** Valor de mes inválido

**Solución:**
- Mes debe ser número entre 1 (enero) y 12 (diciembre)
- No usar 0 ni 13

---

### Error: "Para nómina quincenal, el período debe ser 'primera' o 'segunda'"

**Problema:** Período incorrecto para nómina quincenal

**Solución:** Usa:
```json
{
  "periodo": "primera"  // o "segunda"
}
```

---

### Error: "Para nómina semanal, el período debe ser 'semana_1', 'semana_2', etc."

**Problema:** Formato de período incorrecto

**Solución:**
1. Primero obtener semanas: `GET /api/v1/payroll/weeks/2025/12`
2. Usar el número de semana: `"periodo": "semana_1"`

---

### Error: "No hay empleados configurados con nómina quincenal"

**Problema:** Ningún empleado tiene configuración de salario

**Solución:**
1. Verificar: `GET /api/v1/payroll/employees?tipoNomina=quincenal`
2. Si está vacío, configurar salarios usando:
   - `PUT /api/v1/users/:uid/payroll-config`
3. O directamente en Firestore en la colección `usuarios`

---

### Error: "No se encontraron días laborales para el período seleccionado"

**Problema:** Todos los días del período son fin de semana o festivos

**Solución:**
- Verificar el mes/año seleccionado
- Revisar días festivos configurados
- Usar otro período

---

### Error: "Se requieren privilegios de administrador"

**Problema:** Token de usuario no-admin

**Solución:**
- Usar token de un usuario en `ADMIN_EMAILS` (ver `.env`)
- Emails autorizados:
  - sistemas16ch@gmail.com
  - leticia@cielitohome.com
  - direcciongeneral@cielitohome.com

---

### Error: "Nómina no encontrada"

**Problema:** periodoId incorrecto o nómina no guardada

**Solución:**
1. Verificar formato: `YYYY-MM-periodo-tipoNomina`
   - Ejemplo: `2025-12-primera-quincenal`
2. Listar nóminas del período: `GET /api/v1/payroll/period/12/2025`
3. Si no existe, calcular y guardar primero

---

## 📊 FLUJO COMPLETO DE PRUEBA

### Secuencia Recomendada:

**1. Verificar Empleados**
```
GET /api/v1/payroll/employees?tipoNomina=quincenal
```

**2. (Opcional) Ver Semanas del Mes**
```
GET /api/v1/payroll/weeks/2025/12
```

**3. Calcular Nómina (vista previa)**
```
POST /api/v1/payroll/calculate
Body: { "mes": 12, "anio": 2025, "periodo": "primera", "tipoNomina": "quincenal" }
```

**4. Revisar Resultados**
- Verificar totales
- Verificar empleados
- Verificar descuentos

**5. Guardar Nómina**
```
POST /api/v1/payroll/calculate-and-save
Body: { "mes": 12, "anio": 2025, "periodo": "primera", "tipoNomina": "quincenal" }
```

**6. (Opcional) Editar Conceptos Manuales**
```
PUT /api/v1/payroll/2025-12-primera-quincenal/employee/abc123/concept
Body: { "concepto": "bono", "valor": 500 }
```

**7. Recuperar Nómina Guardada**
```
GET /api/v1/payroll/2025-12-primera-quincenal
```

**8. Ver Todas las Nóminas del Mes**
```
GET /api/v1/payroll/period/12/2025
```

---

## ✅ CHECKLIST DE PRUEBAS

### Consultas:
- [ ] Obtener empleados con nómina quincenal
- [ ] Obtener empleados con nómina semanal
- [ ] Obtener semanas del mes

### Cálculo:
- [ ] Calcular nómina quincenal (primera quincena)
- [ ] Calcular nómina quincenal (segunda quincena)
- [ ] Calcular nómina semanal
- [ ] Calcular y guardar en un paso

### Guardado/Recuperación:
- [ ] Guardar nómina calculada
- [ ] Obtener nómina por ID
- [ ] Obtener nóminas por período

### Edición:
- [ ] Agregar bono manual
- [ ] Agregar deducción manual
- [ ] Actualizar concepto existente

### Casos Especiales:
- [ ] Nómina con retardos (descuento de 1 día)
- [ ] Nómina con ausencias justificadas
- [ ] Nómina con IMSS y caja de ahorro
- [ ] Período sin registros de asistencia
- [ ] Días festivos excluidos

---

## 📝 NOTAS IMPORTANTES

1. **Todos los endpoints requieren autenticación de ADMIN**

2. **Formato de IDs de período:**
   - Quincenal: `YYYY-MM-primera-quincenal` o `YYYY-MM-segunda-quincenal`
   - Semanal: `YYYY-MM-semana_N-semanal`

3. **Descuentos predeterminados:**
   - IMSS Quincenal: $300
   - IMSS Semanal: $150
   - Caja de Ahorro: Monto configurado por empleado

4. **Regla de retardos:**
   - 4+ retardos = descuento de 1 día completo

5. **Días laborales:**
   - Se excluyen fines de semana automáticamente
   - Se excluyen días festivos (si están configurados en Firestore)
   - Quincenal: max 10 días
   - Semanal: max 5 días

---

**¿Listo para calcular nóminas! 💰**
