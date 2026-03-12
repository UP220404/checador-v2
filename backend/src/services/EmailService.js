/**
 * EmailService - Servicio para envío de correos electrónicos
 * Gestiona el envío de nóminas por correo usando nodemailer
 */

import nodemailer from 'nodemailer';
import { getFirestore } from 'firebase-admin/firestore';

class EmailService {
  /**
   * Crear transporter de nodemailer
   */
  static createTransporter() {
    // Configuración SMTP - Ajusta según tu proveedor (Gmail, SendGrid, etc.)
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  /**
   * Enviar nómina por correo electrónico a un empleado
   */
  static async enviarNominaEmpleado(empleadoEmail, nominaData, periodo) {
    try {
      const transporter = this.createTransporter();

      const { mes, anio, quincena } = periodo;
      const periodoTexto = quincena === 'primera' ? 'Primera Quincena' : 'Segunda Quincena';

      // Construir HTML del correo
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
            .table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .total { background: #dcfce7; font-weight: bold; font-size: 1.2em; color: #059669; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 0.875em; border-radius: 0 0 12px 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🏢 Cielito Home</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Recibo de Nómina</p>
            </div>
            <div class="content">
              <h2 style="color: #059669; margin-top: 0;">Hola ${nominaData.nombre}</h2>
              <p>Te enviamos tu recibo de nómina correspondiente a:</p>
              <p style="font-weight: 600; color: #1f2937; font-size: 1.1em;">
                ${periodoTexto} - ${this.getMesNombre(mes)} ${anio}
              </p>

              <table class="table">
                <tr>
                  <th>Concepto</th>
                  <th style="text-align: right;">Cantidad</th>
                </tr>
                <tr>
                  <td>Días trabajados</td>
                  <td style="text-align: right;">${nominaData.diasTrabajados} días</td>
                </tr>
                <tr>
                  <td>Retardos</td>
                  <td style="text-align: right;">${nominaData.retardos || 0}</td>
                </tr>
                <tr>
                  <td>Faltas</td>
                  <td style="text-align: right;">${nominaData.diasFaltantes || 0}</td>
                </tr>
                <tr>
                  <td>Días efectivos</td>
                  <td style="text-align: right;">${nominaData.diasEfectivos} días</td>
                </tr>
                <tr style="height: 10px;"></tr>
                <tr>
                  <td>Salario base quincenal</td>
                  <td style="text-align: right;">$${this.formatearNumero(nominaData.salarioQuincenal)}</td>
                </tr>
                <tr>
                  <td>Pago por día</td>
                  <td style="text-align: right;">$${this.formatearNumero(nominaData.pagoPorDia)}</td>
                </tr>
                <tr>
                  <td><strong>Subtotal</strong></td>
                  <td style="text-align: right;"><strong>$${this.formatearNumero(nominaData.pagoTotal)}</strong></td>
                </tr>
                ${nominaData.descuentoIMSS > 0 ? `
                <tr>
                  <td style="color: #dc2626;">Descuento IMSS</td>
                  <td style="text-align: right; color: #dc2626;">-$${nominaData.descuentoIMSS}</td>
                </tr>
                ` : ''}
                ${nominaData.descuentoCaja > 0 ? `
                <tr>
                  <td style="color: #dc2626;">Descuento Caja de Ahorro</td>
                  <td style="text-align: right; color: #dc2626;">-$${this.formatearNumero(nominaData.descuentoCaja)}</td>
                </tr>
                ` : ''}
                <tr class="total">
                  <td>TOTAL A PAGAR</td>
                  <td style="text-align: right;">$${this.formatearNumero(nominaData.pagoFinal)}</td>
                </tr>
              </table>

              ${nominaData.diasDescuento > 0 ? `
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #d97706;">⚠️ Descuento por retardos:</strong>
                <p style="margin: 5px 0 0 0; color: #92400e;">
                  Se descontó ${nominaData.diasDescuento} día${nominaData.diasDescuento > 1 ? 's' : ''} por acumular ${nominaData.retardos} retardos (cada 4 retardos = 1 día).
                </p>
              </div>
              ` : ''}

              <p style="margin-top: 30px; color: #6b7280;">
                Si tienes alguna duda o aclaración sobre tu nómina, por favor contacta al área de Recursos Humanos.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Este es un correo automático, por favor no responder.</p>
              <p style="margin: 10px 0 0 0;">© ${anio} Cielito Home. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Enviar correo
      const info = await transporter.sendMail({
        from: `"Cielito Home - Nómina" <${process.env.SMTP_USER}>`,
        to: empleadoEmail,
        subject: `Nómina ${periodoTexto} - ${this.getMesNombre(mes)} ${anio}`,
        html: htmlContent
      });

      console.log(`✅ Email enviado a ${empleadoEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error(`❌ Error enviando email a ${empleadoEmail}:`, error);
      throw error;
    }
  }

  /**
   * Enviar nóminas a todos los empleados
   */
  static async enviarNominasGrupal(nominasCalculadas, periodo) {
    const resultados = {
      exitosos: [],
      fallidos: []
    };

    for (const nomina of nominasCalculadas) {
      const empleadoInfo = nomina.empleado || {};
      const email = empleadoInfo.email || empleadoInfo.correo;

      if (!email) {
        console.log(`⚠️ Empleado sin email: ${empleadoInfo.nombre || 'Sin nombre'}`);
        resultados.fallidos.push({
          empleado: empleadoInfo.nombre || 'Sin nombre',
          razon: 'Sin email configurado'
        });
        continue;
      }

      try {
        await this.enviarNominaEmpleado(email, {
          nombre: empleadoInfo.nombre,
          diasTrabajados: nomina.diasTrabajados,
          retardos: nomina.retardos,
          diasFaltantes: nomina.diasFaltantes,
          diasEfectivos: nomina.diasEfectivos,
          salarioQuincenal: nomina.salarioQuincenal,
          pagoPorDia: nomina.pagoPorDia,
          pagoTotal: nomina.pagoTotal,
          descuentoIMSS: nomina.descuentoIMSS,
          descuentoCaja: nomina.descuentoCaja,
          pagoFinal: nomina.pagoFinal,
          diasDescuento: nomina.diasDescuento
        }, periodo);

        resultados.exitosos.push(email);

        // Pequeña pausa entre emails para no saturar el servidor SMTP
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        resultados.fallidos.push({
          empleado: empleadoInfo.nombre || email,
          razon: error.message
        });
      }
    }

    return resultados;
  }

  /**
   * Helper: Formatear número con comas
   */
  static formatearNumero(num) {
    return Math.round(num || 0).toLocaleString('es-MX');
  }

  /**
   * Helper: Obtener nombre del mes
   */
  static getMesNombre(mes) {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1] || 'Mes desconocido';
  }
}

export default EmailService;
