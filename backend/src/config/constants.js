/**
 * Constantes de configuración del sistema
 */

// Horarios y límites
export const CONFIG = {
  // Modo de pruebas (desactiva validaciones)
  MODO_PRUEBAS: false,

  // Horarios de entrada
  HORA_LIMITE_ENTRADA: { hours: 8, minutes: 10 }, // 8:10 AM

  // Horarios de salida
  HORA_LIMITE_SALIDA_BECARIO: { hours: 13, minutes: 0 }, // 1:00 PM
  HORA_LIMITE_SALIDA_EMPLEADO: { hours: 16, minutes: 0 }, // 4:00 PM

  // Ventana de registro
  HORA_INICIO_REGISTRO: { hours: 7, minutes: 0 }, // 7:00 AM
  HORA_FIN_REGISTRO: { hours: 22, minutes: 0 }, // 10:00 PM

  // Geolocalización (oficina)
  OFICINA: {
    lat: 21.92545657925517,
    lng: -102.31327431392519,
    radio_metros: 40
  },

  // QR
  QR_TOKEN_EXPIRATION_MINUTES: 5,
  QR_CODE_PREFIX: 'OFICINA2025',

  // Nómina
  DESCUENTO_POR_RETARDO: 50, // Pesos
  RETARDOS_PARA_DESCUENTO: 3, // Número de retardos que generan descuento
  DESCUENTO_IMSS: 300, // Pesos

  // Tipos de usuario
  TIPOS_USUARIO: {
    BECARIO: 'becario',
    TIEMPO_COMPLETO: 'tiempo_completo',
    ESPECIAL: 'especial',
    HORARIO_ESPECIAL: 'horario_especial'
  },

  // Tipos de ausencia
  TIPOS_AUSENCIA: {
    PERMISO: 'permiso',
    VACACIONES: 'vacaciones',
    INCAPACIDAD: 'incapacidad',
    VIAJE_NEGOCIOS: 'viaje_negocios',
    RETARDO_JUSTIFICADO: 'retardo_justificado',
    JUSTIFICANTE: 'justificante'
  },

  // Estados de ausencia
  ESTADOS_AUSENCIA: {
    PENDIENTE: 'pendiente',
    APROBADA: 'aprobada',
    RECHAZADA: 'rechazada'
  }
};

// Usuarios con permisos especiales — leídos de variables de entorno para no exponer emails en código
export const USUARIOS_MODO_PRUEBAS = [];

// Usuarios que pueden registrar múltiples veces al día (e.g. "sistemas16ch@gmail.com,otro@...")
export const USUARIOS_MULTI_REGISTRO = (process.env.USUARIOS_MULTI_REGISTRO || '')
  .split(',').map(e => e.trim()).filter(Boolean);

// Usuarios que trabajan de forma remota (sin validación de geolocalización)
export const USUARIOS_REMOTOS = (process.env.USUARIOS_REMOTOS || '')
  .split(',').map(e => e.trim()).filter(Boolean);

// Colecciones de Firestore
export const COLLECTIONS = {
  USUARIOS: 'usuarios',
  REGISTROS: 'registros',
  AUSENCIAS: 'ausencias',
  NOMINAS: 'nominas',
  CONFIG_NOMINA: 'configuracion_nomina',
  QR_TOKENS: 'qr_tokens',
  QR_STATS: 'qr_stats',
  ACCESOS_SOSPECHOSOS: 'accesos_sospechosos',
  DIAS_FESTIVOS: 'dias_festivos',
  RANKINGS: 'rankings-mensuales',
  CAMBIOS_MANUALES: 'nominas_cambios_manuales',
  // Nuevas colecciones para Portal Empleado v2
  DOCUMENTOS_EMPLEADO: 'documentos_empleado',
  NOTIFICACIONES: 'notificaciones',
  // Nuevas colecciones para Sistema de Administración
  EVALUACIONES: 'evaluaciones',
  CAPACITACIONES: 'capacitaciones',
  AUDITORIA: 'auditoria',
  // Evaluaciones de contrato
  EVALUACIONES_CONTRATO: 'evaluaciones_contrato'
};

// Tipos de contrato
export const TIPOS_CONTRATO = {
  INICIAL_1_MES: 'inicial_1_mes',
  EXTENSION_2_MESES: 'extension_2_meses',
  INDEFINIDO: 'indefinido'
};

// Estados de contrato
export const ESTADOS_CONTRATO = {
  ACTIVO: 'activo',
  PENDIENTE_EVALUACION: 'pendiente_evaluacion',
  TERMINADO: 'terminado'
};

// Tipos de evaluación de contrato
export const TIPOS_EVALUACION_CONTRATO = {
  EVALUACION_1_MES: 'evaluacion_1_mes',
  EVALUACION_2_MESES: 'evaluacion_2_meses'
};

// Estados de evaluación de contrato
export const ESTADOS_EVALUACION_CONTRATO = {
  PENDIENTE: 'pendiente',
  COMPLETADA: 'completada',
  VENCIDA: 'vencida'
};

// Resultados de evaluación
export const RESULTADOS_EVALUACION = {
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado'
};

// Acciones tomadas después de evaluación
export const ACCIONES_EVALUACION = {
  EXTENSION_CONTRATO: 'extension_contrato',
  CONVERSION_INDEFINIDO: 'conversion_indefinido',
  TERMINACION: 'terminacion'
};

// Tipos de documentos de empleado
export const TIPOS_DOCUMENTO = {
  CONTRATO: 'contrato',
  RECIBO_NOMINA: 'recibo_nomina',
  CERTIFICADO: 'certificado',
  CONSTANCIA: 'constancia',
  ACTA_ADMINISTRATIVA: 'acta_administrativa',
  CARTA_RECOMENDACION: 'carta_recomendacion',
  IDENTIFICACION: 'identificacion',
  COMPROBANTE_DOMICILIO: 'comprobante_domicilio',
  OTRO: 'otro'
};

// Tipos de notificaciones
export const TIPOS_NOTIFICACION = {
  PERMISO_APROBADO: 'permiso_aprobado',
  PERMISO_RECHAZADO: 'permiso_rechazado',
  CUMPLEANOS: 'cumpleanos',
  RECORDATORIO: 'recordatorio',
  DOCUMENTO_NUEVO: 'documento_nuevo',
  SISTEMA: 'sistema',
  // Notificaciones de evaluación de contrato
  EVALUACION_CONTRATO_PENDIENTE: 'evaluacion_contrato_pendiente',
  EVALUACION_CONTRATO_PROXIMA: 'evaluacion_contrato_proxima',
  CONTRATO_EXTENDIDO: 'contrato_extendido',
  CONTRATO_INDEFINIDO: 'contrato_indefinido',
  CONTRATO_TERMINADO: 'contrato_terminado',
  CONTRATO_POR_VENCER: 'contrato_por_vencer',
  // Notificaciones de capacitaciones
  CAPACITACION_INSCRIPCION: 'capacitacion_inscripcion',
  CAPACITACION_DESINSCRIPCION: 'capacitacion_desinscripcion',
  CAPACITACION_COMPLETADA: 'capacitacion_completada',
  CAPACITACION_REPROBADA: 'capacitacion_reprobada',
  CAPACITACION_NUEVA: 'capacitacion_nueva',
  // Notificaciones de evaluaciones de desempeño
  EVALUACION_CREADA: 'evaluacion_creada',
  EVALUACION_COMPLETADA: 'evaluacion_completada',
  // Notificaciones de usuarios
  USUARIO_BIENVENIDA: 'usuario_bienvenida',
  CAMBIO_ROL: 'cambio_rol',
  // Notificaciones de ausencias (para admins)
  NUEVA_SOLICITUD_AUSENCIA: 'nueva_solicitud_ausencia',
  SOLICITUD_AUSENCIA_CONFIRMACION: 'solicitud_ausencia_confirmacion'
};

// Tipos de fechas importantes
export const TIPOS_FECHA_IMPORTANTE = {
  CUMPLEANOS: 'cumpleanos',
  ANIVERSARIO: 'aniversario',
  PERSONAL: 'personal'
};

// Mensajes de error
export const ERROR_MESSAGES = {
  AUTH: {
    NO_TOKEN: 'Token de autenticación no proporcionado',
    INVALID_TOKEN: 'Token de autenticación inválido',
    EXPIRED_TOKEN: 'Token de autenticación expirado',
    NOT_AUTHORIZED: 'No autorizado para realizar esta acción',
    NOT_ADMIN: 'Se requieren privilegios de administrador'
  },
  QR: {
    INVALID: 'Código QR inválido',
    EXPIRED: 'Código QR expirado',
    ALREADY_USED: 'Código QR ya utilizado',
    OUT_OF_HOURS: 'Fuera del horario de registro'
  },
  ATTENDANCE: {
    ALREADY_REGISTERED: 'Ya registraste entrada y salida hoy',
    LOCATION_REQUIRED: 'Se requiere ubicación para registrar asistencia',
    OUT_OF_RANGE: 'Debes estar dentro de la oficina para registrar',
    WEEKEND: 'No se puede registrar asistencia en fin de semana',
    INVALID_TIME: 'Horario inválido para registro'
  },
  PAYROLL: {
    INVALID_PERIOD: 'Período de nómina inválido',
    NOT_FOUND: 'Nómina no encontrada',
    ALREADY_CALCULATED: 'Nómina ya calculada para este período'
  },
  GENERAL: {
    INTERNAL_ERROR: 'Error interno del servidor',
    INVALID_DATA: 'Datos inválidos',
    NOT_FOUND: 'Recurso no encontrado',
    VALIDATION_ERROR: 'Error de validación'
  }
};

// Códigos de estado HTTP
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};

// Roles del sistema
export const ROLES = {
  EMPLEADO: 'empleado',
  ADMIN_AREA: 'admin_area',
  ADMIN_RH: 'admin_rh'
};

// Departamentos
export const DEPARTAMENTOS = [
  'Direccion',
  'Recursos Humanos',
  'Ventas',
  'Operaciones',
  'Tecnologia',
  'Atencion Medica',
  'Almacen'
];

export default {
  CONFIG,
  USUARIOS_MODO_PRUEBAS,
  USUARIOS_MULTI_REGISTRO,
  USUARIOS_REMOTOS,
  COLLECTIONS,
  ERROR_MESSAGES,
  HTTP_STATUS,
  ROLES,
  DEPARTAMENTOS,
  TIPOS_DOCUMENTO,
  TIPOS_NOTIFICACION,
  TIPOS_FECHA_IMPORTANTE,
  TIPOS_CONTRATO,
  ESTADOS_CONTRATO,
  TIPOS_EVALUACION_CONTRATO,
  ESTADOS_EVALUACION_CONTRATO,
  RESULTADOS_EVALUACION,
  ACCIONES_EVALUACION
};
