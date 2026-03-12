/**
 * Servicio para generación de reportes
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

class ReportService {
  constructor() {
    this.attendanceCollection = COLLECTIONS.REGISTROS;
    this.absencesCollection = COLLECTIONS.AUSENCIAS;
    this.payrollCollection = COLLECTIONS.NOMINAS;
    this.usersCollection = COLLECTIONS.USUARIOS;
    this.rankingsCollection = COLLECTIONS.RANKINGS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Generar reporte diario de asistencias
   */
  async generateDailyAttendanceReport(fecha) {
    try {
      // Obtener todos los registros del día
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('fecha', '==', fecha)
        .orderBy('hora', 'asc')
        .get();

      const registros = [];
      snapshot.forEach(doc => {
        registros.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Agrupar por usuario
      const porUsuario = {};
      registros.forEach(registro => {
        const email = registro.correo;
        if (!porUsuario[email]) {
          porUsuario[email] = {
            nombre: registro.nombre,
            email: email,
            entradas: [],
            salidas: []
          };
        }

        if (registro.tipo === 'entrada') {
          porUsuario[email].entradas.push({
            hora: registro.hora,
            estado: registro.estado
          });
        } else if (registro.tipo === 'salida') {
          porUsuario[email].salidas.push({
            hora: registro.hora
          });
        }
      });

      // Calcular estadísticas
      const stats = {
        fecha: fecha,
        totalEmpleados: Object.keys(porUsuario).length,
        totalRegistros: registros.length,
        puntuales: 0,
        retardos: 0,
        ausentes: 0
      };

      Object.values(porUsuario).forEach(usuario => {
        if (usuario.entradas.length > 0) {
          const primeraEntrada = usuario.entradas[0];
          if (primeraEntrada.estado === 'puntual') {
            stats.puntuales++;
          } else if (primeraEntrada.estado === 'retardo') {
            stats.retardos++;
          }
        }
      });

      return {
        fecha: fecha,
        registros: porUsuario,
        estadisticas: stats
      };
    } catch (error) {
      console.error('Error generando reporte diario:', error);
      throw error;
    }
  }

  /**
   * Generar reporte semanal de asistencias
   */
  async generateWeeklyAttendanceReport(fechaInicio, fechaFin) {
    try {
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('fecha', '>=', fechaInicio)
        .where('fecha', '<=', fechaFin)
        .orderBy('fecha', 'asc')
        .get();

      const registros = [];
      snapshot.forEach(doc => {
        registros.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Agrupar por usuario y fecha
      const porUsuario = {};
      registros.forEach(registro => {
        const email = registro.correo;
        if (!porUsuario[email]) {
          porUsuario[email] = {
            nombre: registro.nombre,
            email: email,
            dias: {}
          };
        }

        if (!porUsuario[email].dias[registro.fecha]) {
          porUsuario[email].dias[registro.fecha] = {
            entradas: [],
            salidas: []
          };
        }

        if (registro.tipo === 'entrada') {
          porUsuario[email].dias[registro.fecha].entradas.push({
            hora: registro.hora,
            estado: registro.estado
          });
        } else if (registro.tipo === 'salida') {
          porUsuario[email].dias[registro.fecha].salidas.push({
            hora: registro.hora
          });
        }
      });

      // Calcular estadísticas por usuario
      Object.keys(porUsuario).forEach(email => {
        const usuario = porUsuario[email];
        usuario.estadisticas = {
          diasAsistidos: Object.keys(usuario.dias).length,
          retardos: 0,
          diasPuntuales: 0
        };

        Object.values(usuario.dias).forEach(dia => {
          if (dia.entradas.length > 0) {
            const primeraEntrada = dia.entradas[0];
            if (primeraEntrada.estado === 'retardo') {
              usuario.estadisticas.retardos++;
            } else if (primeraEntrada.estado === 'puntual') {
              usuario.estadisticas.diasPuntuales++;
            }
          }
        });
      });

      return {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        usuarios: porUsuario,
        totalUsuarios: Object.keys(porUsuario).length,
        totalRegistros: registros.length,
        registros: registros  // Array plano de registros para uso en tablas
      };
    } catch (error) {
      console.error('Error generando reporte semanal:', error);
      throw error;
    }
  }

  /**
   * Generar reporte de ausencias
   */
  async generateAbsenceReport(mes, anio) {
    try {
      const snapshot = await this.db
        .collection(this.absencesCollection)
        .where('quincena.mes', '==', parseInt(mes))
        .where('quincena.anio', '==', parseInt(anio))
        .orderBy('fechaCreacion', 'desc')
        .get();

      const ausencias = [];
      snapshot.forEach(doc => {
        ausencias.push({
          id: doc.id,
          ...doc.data(),
          fechaCreacion: doc.data().fechaCreacion?.toDate?.() || doc.data().fechaCreacion
        });
      });

      // Estadísticas
      const stats = {
        total: ausencias.length,
        porEstado: {
          pendiente: 0,
          aprobado: 0,
          rechazado: 0
        },
        porTipo: {},
        diasJustificadosTotales: 0
      };

      ausencias.forEach(ausencia => {
        stats.porEstado[ausencia.estado] = (stats.porEstado[ausencia.estado] || 0) + 1;
        stats.porTipo[ausencia.tipo] = (stats.porTipo[ausencia.tipo] || 0) + 1;

        if (ausencia.estado === 'aprobado') {
          stats.diasJustificadosTotales += ausencia.diasJustificados || 0;
        }
      });

      return {
        mes: mes,
        anio: anio,
        ausencias: ausencias,
        estadisticas: stats
      };
    } catch (error) {
      console.error('Error generando reporte de ausencias:', error);
      throw error;
    }
  }

  /**
   * Generar reporte de nómina
   */
  async generatePayrollReport(periodoId) {
    try {
      const doc = await this.db.collection(this.payrollCollection).doc(periodoId).get();

      if (!doc.exists) {
        throw new Error('Nómina no encontrada');
      }

      const nomina = {
        id: doc.id,
        ...doc.data()
      };

      // Calcular estadísticas
      const stats = {
        totalEmpleados: nomina.empleados.length,
        totalPagar: 0,
        totalDescuentos: 0,
        totalNeto: 0,
        empleadosConDescuentos: 0,
        empleadosConBonos: 0
      };

      nomina.empleados.forEach(empleado => {
        stats.totalPagar += empleado.pagoTotal || 0;
        stats.totalDescuentos += empleado.descuentoTotal || 0;
        stats.totalNeto += empleado.pagoFinal || 0;

        if ((empleado.descuentoTotal || 0) > 0) {
          stats.empleadosConDescuentos++;
        }

        if (empleado.conceptosAdicionales && empleado.conceptosAdicionales.length > 0) {
          const tieneBonus = empleado.conceptosAdicionales.some(c => c.tipo === 'bono');
          if (tieneBonus) {
            stats.empleadosConBonos++;
          }
        }
      });

      return {
        nomina: nomina,
        estadisticas: stats
      };
    } catch (error) {
      console.error('Error generando reporte de nómina:', error);
      throw error;
    }
  }

  /**
   * Exportar reporte de asistencias a Excel
   */
  async exportAttendanceToExcel(fechaInicio, fechaFin) {
    try {
      const reporte = await this.generateWeeklyAttendanceReport(fechaInicio, fechaFin);

      // Crear workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Asistencias');

      // Título
      worksheet.mergeCells('A1:F1');
      worksheet.getCell('A1').value = `Reporte de Asistencias - ${fechaInicio} a ${fechaFin}`;
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Headers
      worksheet.addRow([]);
      const headerRow = worksheet.addRow([
        'Nombre',
        'Email',
        'Días Asistidos',
        'Días Puntuales',
        'Retardos',
        'Puntualidad %'
      ]);

      headerRow.font = { bold: true };
      headerRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });

      // Datos
      Object.values(reporte.usuarios).forEach(usuario => {
        const puntualidad = usuario.estadisticas.diasAsistidos > 0
          ? (usuario.estadisticas.diasPuntuales / usuario.estadisticas.diasAsistidos * 100).toFixed(1)
          : 0;

        worksheet.addRow([
          usuario.nombre,
          usuario.email,
          usuario.estadisticas.diasAsistidos,
          usuario.estadisticas.diasPuntuales,
          usuario.estadisticas.retardos,
          `${puntualidad}%`
        ]);
      });

      // Ajustar ancho de columnas
      worksheet.columns.forEach(column => {
        column.width = 20;
      });

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      throw error;
    }
  }

  /**
   * Exportar reporte de nómina a Excel
   */
  async exportPayrollToExcel(periodoId) {
    try {
      const { nomina, estadisticas } = await this.generatePayrollReport(periodoId);

      // Crear workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Nómina');

      // Título
      worksheet.mergeCells('A1:J1');
      worksheet.getCell('A1').value = `Nómina - ${nomina.periodo.tipo.toUpperCase()} - ${nomina.periodo.mes}/${nomina.periodo.anio}`;
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Información general
      worksheet.addRow([]);
      worksheet.addRow(['Fecha de cálculo:', new Date(nomina.fechaCalculo.seconds * 1000).toLocaleDateString()]);
      worksheet.addRow(['Calculado por:', nomina.calculadoPor]);
      worksheet.addRow(['Total empleados:', estadisticas.totalEmpleados]);
      worksheet.addRow([]);

      // Headers
      const headerRow = worksheet.addRow([
        'Nombre',
        'Días Trabajados',
        'Faltas',
        'Retardos',
        'Días Justificados',
        'Pago Total',
        'Descuentos',
        'Pago Final',
        'Cuenta Bancaria',
        'CLABE'
      ]);

      headerRow.font = { bold: true };
      headerRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });

      // Datos
      nomina.empleados.forEach(empleado => {
        worksheet.addRow([
          empleado.nombre,
          empleado.diasTrabajados || 0,
          empleado.faltas || 0,
          empleado.retardos || 0,
          empleado.diasJustificados || 0,
          empleado.pagoTotal || 0,
          empleado.descuentoTotal || 0,
          empleado.pagoFinal || 0,
          empleado.cuentaBancaria || '',
          empleado.clabe || ''
        ]);
      });

      // Totales
      worksheet.addRow([]);
      const totalRow = worksheet.addRow([
        'TOTALES',
        '',
        '',
        '',
        '',
        estadisticas.totalPagar,
        estadisticas.totalDescuentos,
        estadisticas.totalNeto,
        '',
        ''
      ]);

      totalRow.font = { bold: true };
      totalRow.getCell(6).numFmt = '$#,##0.00';
      totalRow.getCell(7).numFmt = '$#,##0.00';
      totalRow.getCell(8).numFmt = '$#,##0.00';

      // Formato de moneda para columnas de pago
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 6) {
          row.getCell(6).numFmt = '$#,##0.00';
          row.getCell(7).numFmt = '$#,##0.00';
          row.getCell(8).numFmt = '$#,##0.00';
        }
      });

      // Ajustar ancho de columnas
      worksheet.columns.forEach(column => {
        column.width = 18;
      });

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error('Error exportando nómina a Excel:', error);
      throw error;
    }
  }

  /**
   * Exportar reporte de ausencias a PDF
   */
  async exportAbsencesToPDF(mes, anio) {
    try {
      const reporte = await this.generateAbsenceReport(mes, anio);

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 50 });
          const chunks = [];

          doc.on('data', chunk => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);

          // Título
          doc.fontSize(20).text('Reporte de Ausencias', { align: 'center' });
          doc.fontSize(12).text(`Período: ${mes}/${anio}`, { align: 'center' });
          doc.moveDown();

          // Estadísticas
          doc.fontSize(14).text('Resumen:', { underline: true });
          doc.fontSize(11);
          doc.text(`Total de ausencias: ${reporte.estadisticas.total}`);
          doc.text(`Pendientes: ${reporte.estadisticas.porEstado.pendiente}`);
          doc.text(`Aprobadas: ${reporte.estadisticas.porEstado.aprobado}`);
          doc.text(`Rechazadas: ${reporte.estadisticas.porEstado.rechazado}`);
          doc.text(`Días justificados totales: ${reporte.estadisticas.diasJustificadosTotales}`);
          doc.moveDown();

          // Tabla de ausencias
          doc.fontSize(14).text('Detalle de Ausencias:', { underline: true });
          doc.moveDown(0.5);

          reporte.ausencias.forEach((ausencia, index) => {
            if (index > 0) doc.moveDown(0.5);

            doc.fontSize(10);
            doc.text(`${index + 1}. ${ausencia.nombreUsuario}`, { continued: true });
            doc.text(` (${ausencia.tipo})`, { continued: false });
            doc.fontSize(9);
            doc.text(`   Fecha: ${ausencia.fechaInicio} a ${ausencia.fechaFin}`);
            doc.text(`   Estado: ${ausencia.estado.toUpperCase()}`);
            doc.text(`   Motivo: ${ausencia.motivo}`);

            // Nueva página cada 15 ausencias
            if ((index + 1) % 15 === 0 && index < reporte.ausencias.length - 1) {
              doc.addPage();
            }
          });

          doc.end();
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error exportando ausencias a PDF:', error);
      throw error;
    }
  }

  /**
   * Generar y guardar ranking mensual de puntualidad
   */
  async generateMonthlyRanking(mes, anio) {
    try {
      // Calcular fechas del mes
      const primerDia = new Date(anio, mes - 1, 1);
      const ultimoDia = new Date(anio, mes, 0);

      const fechaInicio = primerDia.toISOString().split('T')[0];
      const fechaFin = ultimoDia.toISOString().split('T')[0];

      console.log(`Generando ranking para ${mes}/${anio} (${fechaInicio} - ${fechaFin})`);

      // Obtener todos los registros de entrada del mes
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('fecha', '>=', fechaInicio)
        .where('fecha', '<=', fechaFin)
        .where('tipoEvento', '==', 'entrada')
        .get();

      const registros = [];
      snapshot.forEach(doc => {
        registros.push(doc.data());
      });

      console.log(`Encontrados ${registros.length} registros de entrada`);

      // Agrupar por usuario y fecha (solo el primer registro del día)
      const registrosPorUsuarioYFecha = {};
      registros.forEach(registro => {
        const nombre = registro.nombre || registro.email;
        const fecha = registro.fecha;
        const key = `${nombre}_${fecha}`;

        // Solo tomar el primer registro del día (el más temprano)
        if (!registrosPorUsuarioYFecha[key] || registro.hora < registrosPorUsuarioYFecha[key].hora) {
          registrosPorUsuarioYFecha[key] = {
            nombre,
            fecha,
            hora: registro.hora,
            estado: registro.estado
          };
        }
      });

      // Calcular puntajes usando el sistema de puntos de puntualidad
      const puntajes = {};
      Object.values(registrosPorUsuarioYFecha).forEach(registro => {
        const nombre = registro.nombre;
        const [horas, minutos] = (registro.hora || '00:00:00').split(':').map(Number);

        let puntos = 0;
        if (horas === 7 && minutos <= 45) {
          puntos = 4; // 7:00-7:45
        } else if (horas < 8) {
          puntos = 3; // Antes de 8:00
        } else if (horas === 8 && minutos <= 5) {
          puntos = 2; // 8:00-8:05
        } else if (horas === 8 && minutos <= 10) {
          puntos = 1; // 8:06-8:10
        }

        if (puntos > 0) {
          puntajes[nombre] = (puntajes[nombre] || 0) + puntos;
        }
      });

      // Crear top5 ordenado por puntos
      const top5 = Object.entries(puntajes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre, puntos], index) => ({
          posicion: index + 1,
          nombre,
          puntos
        }));

      // Guardar en Firestore con la estructura correcta
      const docId = `${anio}-${String(mes).padStart(2, '0')}`;
      await this.db.collection(this.rankingsCollection).doc(docId).set({
        mes: mes - 1, // Mes en formato JavaScript (0-11)
        anio: anio,
        fechaActualizacion: new Date(),
        ranking: puntajes, // Objeto con nombre -> puntos
        top5: top5, // Array con top 5
        totalUsuarios: Object.keys(puntajes).length,
        totalRegistros: registros.length
      });

      console.log(`Ranking mensual guardado: ${docId} con ${Object.keys(puntajes).length} usuarios`);

      return {
        mes,
        anio,
        ranking: puntajes,
        top5: top5,
        totalUsuarios: Object.keys(puntajes).length
      };
    } catch (error) {
      console.error('Error generando ranking mensual:', error);
      throw error;
    }
  }

  /**
   * Generar rankings mensuales faltantes
   */
  async generateMissingRankings() {
    try {
      const rankings = [];
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1; // 1-12
      const anioActual = hoy.getFullYear();

      // Generar para los meses faltantes de 2025: octubre (10), noviembre (11), diciembre (12)
      const meses = [
        { mes: 10, anio: 2025 },
        { mes: 11, anio: 2025 },
        { mes: 12, anio: 2025 }
      ];

      for (const { mes, anio } of meses) {
        try {
          console.log(`Generando ranking para ${mes}/${anio}...`);
          const ranking = await this.generateMonthlyRanking(mes, anio);
          rankings.push(ranking);
        } catch (error) {
          console.error(`Error generando ranking ${mes}/${anio}:`, error);
        }
      }

      return {
        success: true,
        rankingsGenerados: rankings.length,
        rankings
      };
    } catch (error) {
      console.error('Error generando rankings faltantes:', error);
      throw error;
    }
  }

  /**
   * Generar resumen optimizado para análisis (dashboard)
   * Incluye: ranking de puntualidad, tendencia mensual, top usuarios
   * @param {string|null} departmentFilter - Filtrar por departamento si es admin_area
   */
  async generateAnalyticsSummary(departmentFilter = null) {
    try {
      const hoy = new Date();

      // Calcular fechas - Mes actual para ranking, 6 meses para gráficas
      const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const hace6Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1);

      const fechaInicioRanking = primerDiaMesActual.toISOString().split('T')[0];
      const fechaFinRanking = hoy.toISOString().split('T')[0];
      const fechaInicioGraficas = hace6Meses.toISOString().split('T')[0];

      console.log(`[Analytics] Obteniendo datos: ${fechaInicioGraficas} a ${fechaFinRanking}`);

      // UNA SOLA QUERY: Obtener todos los registros de los últimos 6 meses
      const snapshot = await this.db
        .collection(this.attendanceCollection)
        .where('fecha', '>=', fechaInicioGraficas)
        .where('fecha', '<=', fechaFinRanking)
        .orderBy('fecha', 'asc')
        .get();

      const registros = [];
      snapshot.forEach(doc => {
        registros.push(doc.data());
      });

      console.log(`[Analytics] Registros obtenidos: ${registros.length}`);

      // Filtrar por departamento si se especifica
      let registrosFiltrados = registros;
      if (departmentFilter) {
        registrosFiltrados = registros.filter(r => r.departamento === departmentFilter);
        console.log(`[Analytics] Registros filtrados por departamento ${departmentFilter}: ${registrosFiltrados.length}`);
      }

      // === PROCESAMIENTO 1: RANKING DE PUNTUALIDAD (MES ACTUAL) ===
      const registrosMesActual = registrosFiltrados.filter(r => r.fecha >= fechaInicioRanking);
      const puntajes = {};
      const registrosPorUsuarioYFecha = {};

      // Agrupar por usuario y fecha (solo primer registro del día)
      registrosMesActual.forEach(registro => {
        if (registro.tipoEvento === 'entrada') {
          const nombre = registro.nombre || registro.email;
          const fecha = registro.fecha;
          const key = `${nombre}_${fecha}`;

          if (!registrosPorUsuarioYFecha[key] || registro.hora < registrosPorUsuarioYFecha[key].hora) {
            registrosPorUsuarioYFecha[key] = {
              nombre,
              fecha,
              hora: registro.hora,
              estado: registro.estado
            };
          }
        }
      });

      // Calcular puntajes de puntualidad
      Object.values(registrosPorUsuarioYFecha).forEach(registro => {
        const nombre = registro.nombre;
        const [horas, minutos] = (registro.hora || '00:00:00').split(':').map(Number);

        let puntos = 0;
        if (horas === 7 && minutos <= 45) {
          puntos = 4; // 7:00-7:45
        } else if (horas < 8) {
          puntos = 3; // Antes de 8:00
        } else if (horas === 8 && minutos <= 5) {
          puntos = 2; // 8:00-8:05
        } else if (horas === 8 && minutos <= 10) {
          puntos = 1; // 8:06-8:10
        }

        if (puntos > 0) {
          puntajes[nombre] = (puntajes[nombre] || 0) + puntos;
        }
      });

      // Top 10 ranking
      const ranking = Object.entries(puntajes)
        .map(([nombre, puntos]) => ({ nombre, puntos }))
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, 10);

      // === PROCESAMIENTO 2: TENDENCIA MENSUAL (6 MESES) ===
      const mesesMap = {};
      registrosFiltrados.forEach(reg => {
        const fecha = new Date(reg.fecha);
        const anio = fecha.getFullYear();
        const mes = fecha.getMonth(); // 0-11
        const mesKey = `${anio}-${mes}`;
        mesesMap[mesKey] = (mesesMap[mesKey] || 0) + 1;
      });

      const tendenciaMensual = Object.entries(mesesMap)
        .map(([key, count]) => {
          const [anio, mes] = key.split('-').map(Number);
          return { anio, mes, count };
        })
        .sort((a, b) => {
          if (a.anio !== b.anio) return a.anio - b.anio;
          return a.mes - b.mes;
        });

      // === PROCESAMIENTO 3: TOP 5 USUARIOS MÁS ACTIVOS ===
      const porUsuario = {};
      registrosFiltrados.forEach(reg => {
        const nombre = reg.nombre || reg.email;
        porUsuario[nombre] = (porUsuario[nombre] || 0) + 1;
      });

      const topUsuarios = Object.entries(porUsuario)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre, count]) => ({ nombre, count }));

      console.log(`[Analytics] Procesamiento completo - Ranking: ${ranking.length}, Meses: ${tendenciaMensual.length}, Top usuarios: ${topUsuarios.length}`);

      // Retornar todo en un solo objeto optimizado
      return {
        ranking: ranking,
        tendenciaMensual: tendenciaMensual,
        topUsuarios: topUsuarios,
        metadata: {
          fechaInicioRanking,
          fechaFinRanking,
          fechaInicioGraficas,
          totalRegistros: registrosFiltrados.length,
          registrosMesActual: registrosMesActual.length,
          departmentFilter: departmentFilter || 'all'
        }
      };
    } catch (error) {
      console.error('Error generando resumen de análisis:', error);
      throw error;
    }
  }
}

export default new ReportService();
