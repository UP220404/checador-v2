import PayrollService from '../services/PayrollService.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Controlador de Nómina
 *
 * Maneja las peticiones HTTP relacionadas con el cálculo y gestión de nóminas
 */
class PayrollController {
  /**
   * Validar contraseña de acceso a nómina
   * POST /api/v1/payroll/validate-password
   *
   * Body: { "password": "..." }
   */
  static async validatePassword(req, res) {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Contraseña es requerida'
        });
      }

      const PAYROLL_PASSWORD = process.env.PAYROLL_PASSWORD;
      if (!PAYROLL_PASSWORD) {
        console.error('❌ PAYROLL_PASSWORD no está configurada en las variables de entorno');
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
          success: false,
          message: 'Servicio no disponible temporalmente'
        });
      }

      if (password === PAYROLL_PASSWORD) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Acceso autorizado'
        });
      } else {
        // NO usar 401 para evitar que el interceptor cierre la sesión
        return res.status(HTTP_STATUS.OK).json({
          success: false,
          message: 'Contraseña incorrecta'
        });
      }
    } catch (error) {
      console.error('❌ Error validando contraseña:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al validar contraseña'
      });
    }
  }
  /**
   * Calcular nómina completa
   * POST /api/v1/payroll/calculate
   *
   * Body:
   * {
   *   "mes": 11,
   *   "anio": 2025,
   *   "periodo": "primera",  // "primera" | "segunda" | "semana_1" | "semana_2" | etc.
   *   "tipoNomina": "quincenal"  // "quincenal" | "semanal"
   * }
   */
  static async calculatePayroll(req, res) {
    try {
      const { mes, anio, periodo, tipoNomina = 'quincenal' } = req.body;

      // Validaciones
      if (!mes || !anio || !periodo) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan parámetros requeridos: mes, anio, periodo'
        });
      }

      if (mes < 1 || mes > 12) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El mes debe estar entre 1 y 12'
        });
      }

      if (tipoNomina === 'quincenal') {
        if (periodo !== 'primera' && periodo !== 'segunda') {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Para nómina quincenal, el período debe ser "primera" o "segunda"'
          });
        }
      } else if (tipoNomina === 'semanal') {
        if (!periodo.startsWith('semana_')) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Para nómina semanal, el período debe ser "semana_1", "semana_2", etc.'
          });
        }
      }

      console.log(`📊 Solicitud de cálculo de nómina: ${tipoNomina} - ${mes}/${anio} - ${periodo}`);

      const resultado = await PayrollService.calculatePayroll({
        mes,
        anio,
        periodo,
        tipoNomina
      });

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error calculando nómina:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al calcular la nómina'
      });
    }
  }

  /**
   * Guardar nómina calculada
   * POST /api/v1/payroll/save
   *
   * Body:
   * {
   *   "mes": 11,
   *   "anio": 2025,
   *   "periodo": "primera",
   *   "tipoNomina": "quincenal",
   *   "resultados": [...],
   *   "resumen": {...}
   * }
   */
  static async savePayroll(req, res) {
    try {
      const { mes, anio, periodo, tipoNomina, resultados, resumen } = req.body;
      const userId = req.user.uid;

      if (!mes || !anio || !periodo || !tipoNomina || !resultados || !resumen) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan parámetros requeridos'
        });
      }

      const resultado = await PayrollService.savePayroll({
        mes,
        anio,
        periodo,
        tipoNomina,
        resultados,
        resumen,
        userId
      });

      return res.status(HTTP_STATUS.CREATED).json(resultado);

    } catch (error) {
      console.error('❌ Error guardando nómina:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al guardar la nómina'
      });
    }
  }

  /**
   * Calcular y guardar nómina en un solo paso
   * POST /api/v1/payroll/calculate-and-save
   */
  static async calculateAndSave(req, res) {
    try {
      const { mes, anio, periodo, tipoNomina = 'quincenal' } = req.body;
      const userId = req.user.uid;

      // Validaciones
      if (!mes || !anio || !periodo) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan parámetros requeridos: mes, anio, periodo'
        });
      }

      // 1. Calcular nómina
      const calculoResultado = await PayrollService.calculatePayroll({
        mes,
        anio,
        periodo,
        tipoNomina
      });

      if (!calculoResultado.success) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json(calculoResultado);
      }

      // 2. Guardar nómina
      const guardadoResultado = await PayrollService.savePayroll({
        mes,
        anio,
        periodo,
        tipoNomina,
        resultados: calculoResultado.data.empleados,
        resumen: calculoResultado.data.resumen,
        userId
      });

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Nómina calculada y guardada exitosamente',
        data: {
          ...calculoResultado.data,
          guardadoEn: guardadoResultado.data.id
        }
      });

    } catch (error) {
      console.error('❌ Error en calcular y guardar:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al calcular y guardar la nómina'
      });
    }
  }

  /**
   * Obtener nómina guardada por ID
   * GET /api/v1/payroll/:periodoId
   */
  static async getPayroll(req, res) {
    try {
      const { periodoId } = req.params;

      if (!periodoId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID de período es requerido'
        });
      }

      const resultado = await PayrollService.getPayroll(periodoId);

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error obteniendo nómina:', error);

      if (error.message === 'Nómina no encontrada') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Nómina no encontrada'
        });
      }

      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener la nómina'
      });
    }
  }

  /**
   * Obtener nóminas por período
   * GET /api/v1/payroll/period/:mes/:anio
   *
   * Query params:
   *   ?tipoNomina=quincenal
   */
  static async getPayrollsByPeriod(req, res) {
    try {
      const { mes, anio } = req.params;
      const { tipoNomina } = req.query;

      if (!mes || !anio) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Mes y año son requeridos'
        });
      }

      const resultado = await PayrollService.getPayrollsByPeriod({
        mes: parseInt(mes),
        anio: parseInt(anio),
        tipoNomina
      });

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error obteniendo nóminas:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener las nóminas'
      });
    }
  }

  /**
   * Actualizar concepto manual en nómina
   * PUT /api/v1/payroll/:periodoId/employee/:empleadoId/concept
   *
   * Body:
   * {
   *   "concepto": "bono",
   *   "valor": 500
   * }
   */
  static async updateManualConcept(req, res) {
    try {
      const { periodoId, empleadoId } = req.params;
      const { concepto, valor } = req.body;
      const userId = req.user.uid;

      if (!periodoId || !empleadoId || !concepto || valor === undefined) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Faltan parámetros requeridos: periodoId, empleadoId, concepto, valor'
        });
      }

      if (typeof valor !== 'number') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'El valor debe ser un número'
        });
      }

      const resultado = await PayrollService.updateManualConcept({
        periodoId,
        empleadoId,
        concepto,
        valor,
        userId
      });

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error actualizando concepto:', error);

      if (error.message === 'Nómina no encontrada' || error.message === 'Empleado no encontrado en la nómina') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: error.message
        });
      }

      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al actualizar el concepto'
      });
    }
  }

  /**
   * Obtener empleados con configuración de nómina
   * GET /api/v1/payroll/employees
   *
   * Query params:
   *   ?tipoNomina=quincenal
   */
  static async getEmployeesWithPayrollConfig(req, res) {
    try {
      const { tipoNomina = 'quincenal' } = req.query;

      const empleados = await PayrollService.getEmployeesWithPayrollConfig(tipoNomina);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        count: empleados.length,
        data: empleados
      });

    } catch (error) {
      console.error('❌ Error obteniendo empleados:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener empleados'
      });
    }
  }

  /**
   * Obtener semanas del mes
   * GET /api/v1/payroll/weeks/:anio/:mes
   */
  static async getWeeksOfMonth(req, res) {
    try {
      const { anio, mes } = req.params;

      if (!anio || !mes) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Año y mes son requeridos'
        });
      }

      const semanas = PayrollService.getWeeksOfMonth(parseInt(anio), parseInt(mes));

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: semanas
      });

    } catch (error) {
      console.error('❌ Error obteniendo semanas:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener semanas'
      });
    }
  }

  /**
   * Obtener días festivos de un año
   * GET /api/v1/payroll/holidays/:anio
   */
  static async getHolidays(req, res) {
    try {
      const { anio } = req.params;

      if (!anio) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Año es requerido'
        });
      }

      const resultado = await PayrollService.obtenerDiasFestivos(parseInt(anio));

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error obteniendo días festivos:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener días festivos'
      });
    }
  }

  /**
   * Guardar día festivo
   * POST /api/v1/payroll/holidays
   *
   * Body:
   * {
   *   "fecha": "2025-12-25",
   *   "nombre": "Navidad",
   *   "tipo": "federal"
   * }
   */
  static async saveHoliday(req, res) {
    try {
      const { fecha, nombre, tipo = 'federal' } = req.body;

      if (!fecha || !nombre) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Fecha y nombre son requeridos'
        });
      }

      // Validar formato de fecha
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(fecha)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }

      const resultado = await PayrollService.guardarDiaFestivo(fecha, nombre, tipo);

      return res.status(HTTP_STATUS.CREATED).json(resultado);

    } catch (error) {
      console.error('❌ Error guardando día festivo:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al guardar día festivo'
      });
    }
  }

  /**
   * Eliminar día festivo
   * DELETE /api/v1/payroll/holidays/:festivoId
   */
  static async deleteHoliday(req, res) {
    try {
      const { festivoId } = req.params;

      if (!festivoId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'ID de festivo es requerido'
        });
      }

      const resultado = await PayrollService.eliminarDiaFestivo(festivoId);

      return res.status(HTTP_STATUS.OK).json(resultado);

    } catch (error) {
      console.error('❌ Error eliminando día festivo:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al eliminar día festivo'
      });
    }
  }

  /**
   * Obtener proyección de nómina del periodo actual para el empleado autenticado
   * GET /api/v1/payroll/my-projection
   * Query params: ?mes=2&anio=2026&periodo=primera
   */
  static async getMyProjection(req, res) {
    try {
      const empleadoUid = req.user.uid;
      const { mes, anio, periodo, tipoNomina } = req.query;

      const resultado = await PayrollService.calculateEmployeeProjection(empleadoUid, {
        mes: mes ? parseInt(mes) : undefined,
        anio: anio ? parseInt(anio) : undefined,
        periodo,
        tipoNomina
      });

      return res.status(HTTP_STATUS.OK).json(resultado);
    } catch (error) {
      console.error('❌ Error obteniendo proyección:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener proyección de nómina'
      });
    }
  }

  /**
   * Obtener historial de nóminas del empleado autenticado
   * GET /api/v1/payroll/my-history
   * Query params: ?anio=2026&mes=1
   */
  static async getMyPayrollHistory(req, res) {
    try {
      const empleadoUid = req.user.uid;
      const { anio, mes } = req.query;

      const resultado = await PayrollService.getEmployeePayrollHistory(empleadoUid, { anio, mes });

      return res.status(HTTP_STATUS.OK).json(resultado);
    } catch (error) {
      console.error('❌ Error obteniendo historial de nóminas:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al obtener historial de nóminas'
      });
    }
  }

  /**
   * Enviar nóminas por correo electrónico
   * POST /api/v1/payroll/send-emails
   */
  static async sendPayrollEmails(req, res) {
    try {
      const { nominasCalculadas, periodo } = req.body;

      // Validaciones
      if (!nominasCalculadas || !Array.isArray(nominasCalculadas) || nominasCalculadas.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere un array de nóminas calculadas'
        });
      }

      if (!periodo || !periodo.mes || !periodo.anio || !periodo.quincena) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere información del período (mes, anio, quincena)'
        });
      }

      // Importar EmailService dinámicamente
      const EmailService = (await import('../services/EmailService.js')).default;

      // Enviar emails
      console.log(`📧 Iniciando envío de ${nominasCalculadas.length} nóminas por correo...`);
      const resultados = await EmailService.enviarNominasGrupal(nominasCalculadas, periodo);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Emails enviados: ${resultados.exitosos.length} exitosos, ${resultados.fallidos.length} fallidos`,
        data: resultados
      });

    } catch (error) {
      console.error('❌ Error enviando nóminas por correo:', error);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message || 'Error al enviar nóminas por correo'
      });
    }
  }
}

export default PayrollController;
