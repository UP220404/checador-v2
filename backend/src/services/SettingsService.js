/**
 * Servicio para gestion de configuracion global del sistema
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, CONFIG, DEPARTAMENTOS } from '../config/constants.js';

const SETTINGS_COLLECTION = 'configuracion_sistema';

class SettingsService {
  get db() {
    return getFirestore();
  }

  /**
   * Obtiene configuracion por categoria
   * @param {string} category - Categoria: 'ausencias', 'nomina', 'horarios', 'departamentos'
   */
  async getSettings(category) {
    try {
      const docRef = this.db.collection(SETTINGS_COLLECTION).doc(category);
      const doc = await docRef.get();

      if (!doc.exists) {
        // Retornar configuracion por defecto
        return this.getDefaultSettings(category);
      }

      return {
        ...doc.data(),
        id: doc.id
      };
    } catch (error) {
      console.error(`Error obteniendo configuracion ${category}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza configuracion por categoria
   */
  async updateSettings(category, data) {
    try {
      const docRef = this.db.collection(SETTINGS_COLLECTION).doc(category);

      await docRef.set({
        ...data,
        fechaActualizacion: new Date()
      }, { merge: true });

      return await this.getSettings(category);
    } catch (error) {
      console.error(`Error actualizando configuracion ${category}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene configuracion por defecto segun categoria
   */
  getDefaultSettings(category) {
    const defaults = {
      ausencias: {
        tipos: [
          { id: 'permiso_con_goce', nombre: 'Permiso con Goce de Sueldo', activo: true, requiereAprobacion: true },
          { id: 'permiso_sin_goce', nombre: 'Permiso sin Goce de Sueldo', activo: true, requiereAprobacion: true },
          { id: 'vacaciones', nombre: 'Vacaciones', activo: true, requiereAprobacion: true },
          { id: 'incapacidad', nombre: 'Incapacidad', activo: true, requiereAprobacion: true },
          { id: 'retardo_justificado', nombre: 'Retardo Justificado', activo: true, requiereAprobacion: true },
          { id: 'falta_justificada', nombre: 'Falta Justificada', activo: true, requiereAprobacion: true }
        ]
      },
      nomina: {
        descuentoPorRetardo: CONFIG.DESCUENTO_POR_RETARDO || 50,
        retardosParaDescuento: CONFIG.RETARDOS_PARA_DESCUENTO || 3,
        descuentoIMSS: CONFIG.DESCUENTO_IMSS || 300,
        porcentajeCajaAhorro: 10,
        diasVacacionesPorAnio: 12,
        primaVacacional: 25
      },
      horarios: {
        horaLimiteEntrada: '08:10',
        toleranciaMinutos: 10,
        horaInicioRegistro: '07:00',
        horaFinRegistro: '22:00',
        horaSalidaBecario: '13:00',
        horaSalidaEmpleado: '16:00'
      },
      departamentos: {
        lista: DEPARTAMENTOS || [
          'Direccion',
          'Recursos Humanos',
          'Ventas',
          'Operaciones',
          'Tecnologia',
          'Atencion Medica',
          'Almacen'
        ]
      },
      empresa: {
        nombre: 'Mi Empresa',
        rfc: '',
        direccion: '',
        telefono: '',
        email: '',
        logo: ''
      },
      seguridad: {
        sesionTimeout: 30,
        intentosMaximos: 5,
        bloqueoMinutos: 15,
        requiereMFA: false,
        passwordMinLength: 8
      },
      notificaciones: {
        emailEnabled: true,
        pushEnabled: false,
        notificarAprobaciones: true,
        notificarRechazos: true,
        notificarNomina: true,
        recordatorioVacaciones: true
      }
    };

    return defaults[category] || {};
  }

  /**
   * Obtiene todas las configuraciones
   */
  async getAllSettings() {
    try {
      const categories = ['ausencias', 'nomina', 'horarios', 'departamentos', 'empresa', 'seguridad', 'notificaciones'];
      const settings = {};

      for (const category of categories) {
        settings[category] = await this.getSettings(category);
      }

      return settings;
    } catch (error) {
      console.error('Error obteniendo todas las configuraciones:', error);
      throw error;
    }
  }

  /**
   * Agrega un nuevo tipo de ausencia
   */
  async addAbsenceType(newType) {
    try {
      const settings = await this.getSettings('ausencias');
      const tipos = settings.tipos || [];

      // Verificar que no exista
      if (tipos.find(t => t.id === newType.id)) {
        throw new Error('Ya existe un tipo de ausencia con ese ID');
      }

      tipos.push({
        id: newType.id,
        nombre: newType.nombre,
        activo: newType.activo !== false,
        requiereAprobacion: newType.requiereAprobacion !== false
      });

      return await this.updateSettings('ausencias', { tipos });
    } catch (error) {
      console.error('Error agregando tipo de ausencia:', error);
      throw error;
    }
  }

  /**
   * Actualiza un tipo de ausencia
   */
  async updateAbsenceType(typeId, updates) {
    try {
      const settings = await this.getSettings('ausencias');
      const tipos = settings.tipos || [];

      const index = tipos.findIndex(t => t.id === typeId);
      if (index === -1) {
        throw new Error('Tipo de ausencia no encontrado');
      }

      tipos[index] = { ...tipos[index], ...updates };

      return await this.updateSettings('ausencias', { tipos });
    } catch (error) {
      console.error('Error actualizando tipo de ausencia:', error);
      throw error;
    }
  }

  /**
   * Elimina un tipo de ausencia (soft delete)
   */
  async deleteAbsenceType(typeId) {
    try {
      const settings = await this.getSettings('ausencias');
      const tipos = settings.tipos || [];

      const index = tipos.findIndex(t => t.id === typeId);
      if (index === -1) {
        throw new Error('Tipo de ausencia no encontrado');
      }

      // Soft delete - marcar como inactivo
      tipos[index].activo = false;

      return await this.updateSettings('ausencias', { tipos });
    } catch (error) {
      console.error('Error eliminando tipo de ausencia:', error);
      throw error;
    }
  }

  /**
   * Agrega un nuevo departamento
   */
  async addDepartment(departmentName) {
    try {
      const settings = await this.getSettings('departamentos');
      const lista = settings.lista || [];

      if (lista.includes(departmentName)) {
        throw new Error('El departamento ya existe');
      }

      lista.push(departmentName);

      return await this.updateSettings('departamentos', { lista });
    } catch (error) {
      console.error('Error agregando departamento:', error);
      throw error;
    }
  }

  /**
   * Elimina un departamento
   */
  async removeDepartment(departmentName) {
    try {
      const settings = await this.getSettings('departamentos');
      let lista = settings.lista || [];

      lista = lista.filter(d => d !== departmentName);

      return await this.updateSettings('departamentos', { lista });
    } catch (error) {
      console.error('Error eliminando departamento:', error);
      throw error;
    }
  }
}

export default new SettingsService();
