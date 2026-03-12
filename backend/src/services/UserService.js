/**
 * Servicio para gestión de usuarios
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_FECHA_IMPORTANTE } from '../config/constants.js';
import { validarEmail, validarTipoUsuario } from '../utils/validators.js';
import crypto from 'crypto';

class UserService {
  constructor() {
    this.usersCollection = COLLECTIONS.USUARIOS;
  }

  get db() {
    return getFirestore();
  }

  /**
   * Obtiene un usuario por su UID
   */
  async getUserByUid(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();

      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data();

      // Retornar todos los datos del usuario, incluyendo configuración de nómina que puede estar en el mismo documento
      return {
        uid: userDoc.id,
        ...userData,
        // Asegurar que estos campos existan aunque sean undefined
        salarioQuincenal: userData.salarioQuincenal || 0,
        tipoNomina: userData.tipoNomina || 'quincenal',
        tieneIMSS: userData.tieneIMSS || false,
        tieneCajaAhorro: userData.tieneCajaAhorro || false,
        montoCajaAhorro: userData.montoCajaAhorro || 0,
        horasQuincenal: userData.horasQuincenal || 0,
        cuentaBancaria: userData.cuentaBancaria || '',
        nombreBanco: userData.nombreBanco || ''
      };
    } catch (error) {
      console.error('Error obteniendo usuario por UID:', error);
      throw error;
    }
  }

  /**
   * Obtiene un usuario por su email
   */
  async getUserByEmail(email) {
    try {
      const querySnapshot = await this.db
        .collection(this.usersCollection)
        .where('correo', '==', email)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    } catch (error) {
      console.error('Error obteniendo usuario por email:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los usuarios
   */
  async getAllUsers() {
    try {
      const querySnapshot = await this.db
        .collection(this.usersCollection)
        .orderBy('nombre')
        .get();

      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error obteniendo todos los usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene usuarios por departamento
   */
  async getUsersByDepartment(departamento) {
    try {
      const querySnapshot = await this.db
        .collection(this.usersCollection)
        .where('departamento', '==', departamento)
        .orderBy('nombre')
        .get();

      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error obteniendo usuarios por departamento:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario
   */
  async createUser(uid, userData) {
    try {
      // Validaciones
      if (!validarEmail(userData.correo)) {
        throw new Error('Email inválido');
      }

      // Usar tipo por defecto si no se proporciona o es inválido
      const tipoUsuario = userData.tipo && validarTipoUsuario(userData.tipo)
        ? userData.tipo
        : 'tiempo_completo';

      // Verificar que el email no esté ya registrado
      const existingUser = await this.getUserByEmail(userData.correo);
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      const userDoc = {
        nombre: userData.nombre,
        correo: userData.correo,
        tipo: tipoUsuario,
        role: userData.role || 'empleado',
        fechaCreacion: new Date(),
        activo: userData.activo !== false,
        departamento: userData.departamento || '',
        puesto: userData.puesto || '',
        telefono: userData.telefono || '',
        fechaIngreso: userData.fechaIngreso || '',
        salarioBase: userData.salarioBase || 0
      };

      await this.db.collection(this.usersCollection).doc(uid).set(userDoc);

      return {
        uid,
        ...userDoc
      };
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  /**
   * Actualiza un usuario
   */
  async updateUser(uid, updateData) {
    try {
      // Validaciones
      if (updateData.correo && !validarEmail(updateData.correo)) {
        throw new Error('Email inválido');
      }

      if (updateData.tipo && !validarTipoUsuario(updateData.tipo)) {
        throw new Error('Tipo de usuario inválido');
      }

      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      await userRef.update({
        ...updateData,
        fechaActualizacion: new Date()
      });

      const updatedDoc = await userRef.get();
      return {
        uid: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Elimina un usuario (soft delete)
   */
  async deleteUser(uid) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Soft delete
      await userRef.update({
        activo: false,
        fechaEliminacion: new Date()
      });

      return { success: true, message: 'Usuario desactivado' };
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de nómina de un usuario
   */
  async getUserPayrollConfig(uid) {
    try {
      const configDoc = await this.db
        .collection(COLLECTIONS.CONFIG_NOMINA)
        .doc(uid)
        .get();

      if (!configDoc.exists) {
        // Retornar configuración por defecto
        return {
          salarioQuincenal: 0,
          tipoNomina: 'quincenal',
          tieneIMSS: false,
          tieneCajaAhorro: false,
          montoCajaAhorro: 0
        };
      }

      return configDoc.data();
    } catch (error) {
      console.error('Error obteniendo configuración de nómina:', error);
      throw error;
    }
  }

  /**
   * Actualiza la configuración de nómina de un usuario
   */
  async updateUserPayrollConfig(uid, config) {
    try {
      const configRef = this.db.collection(COLLECTIONS.CONFIG_NOMINA).doc(uid);

      await configRef.set({
        ...config,
        fechaActualizacion: new Date()
      }, { merge: true });

      return { success: true, config };
    } catch (error) {
      console.error('Error actualizando configuración de nómina:', error);
      throw error;
    }
  }

  // ===============================================
  // MÉTODOS PARA PORTAL EMPLEADO V2
  // ===============================================

  /**
   * Actualiza el perfil extendido de un usuario
   * Campos permitidos: telefono, direccion, contactoEmergencia, contactoEmergenciaTelefono,
   *                    fechaNacimiento, puesto
   */
  async updateProfileExtended(uid, profileData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Campos permitidos para actualización por el empleado
      const allowedFields = [
        'telefono',
        'direccion',
        'contactoEmergencia',
        'contactoEmergenciaTelefono',
        'fechaNacimiento'
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (profileData[field] !== undefined) {
          updates[field] = profileData[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return { success: true, message: 'No hay cambios para aplicar' };
      }

      updates.fechaActualizacion = new Date();

      await userRef.update(updates);

      const updatedDoc = await userRef.get();
      return {
        uid: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error actualizando perfil extendido:', error);
      throw error;
    }
  }

  /**
   * Actualiza la foto de perfil de un usuario
   */
  async updateProfilePhoto(uid, fotoUrl) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      await userRef.update({
        fotoUrl,
        fechaActualizacion: new Date()
      });

      return { success: true, fotoUrl };
    } catch (error) {
      console.error('Error actualizando foto de perfil:', error);
      throw error;
    }
  }

  /**
   * Obtiene las fechas importantes de un usuario
   */
  async getFechasImportantes(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      return userData.fechasImportantes || [];
    } catch (error) {
      console.error('Error obteniendo fechas importantes:', error);
      throw error;
    }
  }

  /**
   * Agrega una fecha importante
   */
  async addFechaImportante(uid, fechaData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Validar tipo de fecha
      const tiposValidos = Object.values(TIPOS_FECHA_IMPORTANTE);
      if (!tiposValidos.includes(fechaData.tipo)) {
        throw new Error(`Tipo de fecha inválido. Tipos válidos: ${tiposValidos.join(', ')}`);
      }

      const nuevaFecha = {
        id: crypto.randomUUID(),
        tipo: fechaData.tipo,
        fecha: fechaData.fecha, // Formato MM-DD
        descripcion: fechaData.descripcion || '',
        notificar: fechaData.notificar !== false
      };

      const userData = userDoc.data();
      const fechasImportantes = userData.fechasImportantes || [];
      fechasImportantes.push(nuevaFecha);

      await userRef.update({
        fechasImportantes,
        fechaActualizacion: new Date()
      });

      return nuevaFecha;
    } catch (error) {
      console.error('Error agregando fecha importante:', error);
      throw error;
    }
  }

  /**
   * Elimina una fecha importante
   */
  async deleteFechaImportante(uid, fechaId) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const fechasImportantes = userData.fechasImportantes || [];

      const fechaIndex = fechasImportantes.findIndex(f => f.id === fechaId);
      if (fechaIndex === -1) {
        throw new Error('Fecha importante no encontrada');
      }

      fechasImportantes.splice(fechaIndex, 1);

      await userRef.update({
        fechasImportantes,
        fechaActualizacion: new Date()
      });

      return { success: true, message: 'Fecha eliminada' };
    } catch (error) {
      console.error('Error eliminando fecha importante:', error);
      throw error;
    }
  }

  /**
   * Actualiza las preferencias de notificaciones
   */
  async updatePreferenciasNotificaciones(uid, preferencias) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const currentPrefs = userData.preferenciasNotificaciones || {};

      // Campos permitidos
      const allowedFields = [
        'alertaEntrada',
        'alertaSalida',
        'alertaCumpleanos',
        'alertaAprobacionPermisos',
        'canalPreferido'
      ];

      const updates = { ...currentPrefs };
      for (const field of allowedFields) {
        if (preferencias[field] !== undefined) {
          updates[field] = preferencias[field];
        }
      }

      await userRef.update({
        preferenciasNotificaciones: updates,
        fechaActualizacion: new Date()
      });

      return updates;
    } catch (error) {
      console.error('Error actualizando preferencias de notificaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene el saldo de vacaciones de un usuario
   */
  async getSaldoVacaciones(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const saldo = userData.saldoVacaciones || {
        diasDisponibles: 6,
        diasUsados: 0,
        diasPendientes: 0,
        ultimaActualizacion: null
      };

      // Calcular días restantes
      saldo.diasRestantes = saldo.diasDisponibles - saldo.diasUsados - saldo.diasPendientes;

      return saldo;
    } catch (error) {
      console.error('Error obteniendo saldo de vacaciones:', error);
      throw error;
    }
  }

  /**
   * Actualiza el saldo de vacaciones (usado por admin o sistema)
   */
  async updateSaldoVacaciones(uid, saldoData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const currentSaldo = userData.saldoVacaciones || {};

      const updates = {
        ...currentSaldo,
        ...saldoData,
        ultimaActualizacion: new Date()
      };

      await userRef.update({
        saldoVacaciones: updates,
        fechaActualizacion: new Date()
      });

      return updates;
    } catch (error) {
      console.error('Error actualizando saldo de vacaciones:', error);
      throw error;
    }
  }

  /**
   * Recalcula el saldo de vacaciones basado en ausencias aprobadas
   */
  async recalcularSaldoVacaciones(uid) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Obtener ausencias de tipo vacaciones aprobadas
      const ausenciasSnapshot = await this.db.collection(COLLECTIONS.AUSENCIAS)
        .where('uid', '==', uid)
        .where('tipo', '==', 'vacaciones')
        .where('estado', '==', 'aprobada')
        .get();

      let diasUsados = 0;
      ausenciasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.diasSolicitados) {
          diasUsados += data.diasSolicitados;
        } else if (data.fechaInicio && data.fechaFin) {
          const inicio = data.fechaInicio.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio);
          const fin = data.fechaFin.toDate ? data.fechaFin.toDate() : new Date(data.fechaFin);
          const diffTime = Math.abs(fin - inicio);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          diasUsados += diffDays;
        }
      });

      // Obtener ausencias pendientes
      const pendientesSnapshot = await this.db.collection(COLLECTIONS.AUSENCIAS)
        .where('uid', '==', uid)
        .where('tipo', '==', 'vacaciones')
        .where('estado', '==', 'pendiente')
        .get();

      let diasPendientes = 0;
      pendientesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.diasSolicitados) {
          diasPendientes += data.diasSolicitados;
        }
      });

      const userData = userDoc.data();
      const diasDisponibles = userData.saldoVacaciones?.diasDisponibles || 6;

      await userRef.update({
        'saldoVacaciones.diasUsados': diasUsados,
        'saldoVacaciones.diasPendientes': diasPendientes,
        'saldoVacaciones.ultimaActualizacion': new Date(),
        fechaActualizacion: new Date()
      });

      return {
        diasDisponibles,
        diasUsados,
        diasPendientes,
        diasRestantes: diasDisponibles - diasUsados - diasPendientes
      };
    } catch (error) {
      console.error('Error recalculando saldo de vacaciones:', error);
      throw error;
    }
  }

  /**
   * Actualiza campos extendidos del perfil por admin (puesto, fechaIngreso, etc)
   */
  async updateProfileByAdmin(uid, profileData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Campos permitidos para admin
      const allowedFields = [
        'puesto',
        'fechaIngreso',
        'fechaNacimiento',
        'departamento',
        'tipo',
        'role'
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (profileData[field] !== undefined) {
          updates[field] = profileData[field];
        }
      }

      // Actualizar saldo de vacaciones si se proporciona
      if (profileData.diasVacaciones !== undefined) {
        updates['saldoVacaciones.diasDisponibles'] = profileData.diasVacaciones;
      }

      if (Object.keys(updates).length === 0) {
        return { success: true, message: 'No hay cambios para aplicar' };
      }

      updates.fechaActualizacion = new Date();

      await userRef.update(updates);

      const updatedDoc = await userRef.get();
      return {
        uid: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error actualizando perfil por admin:', error);
      throw error;
    }
  }
  /**
   * Actualiza el rol de un usuario (solo admin_rh puede hacer esto)
   */
  async updateUserRole(uid, roleData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      // Validar rol
      const rolesValidos = ['empleado', 'admin_area', 'admin_rh'];
      if (!rolesValidos.includes(roleData.role)) {
        throw new Error(`Rol inválido. Roles válidos: ${rolesValidos.join(', ')}`);
      }

      // Si es admin_area, debe tener departamento
      if (roleData.role === 'admin_area' && !roleData.departamento) {
        throw new Error('admin_area requiere un departamento asignado');
      }

      const updates = {
        role: roleData.role,
        fechaActualizacion: new Date()
      };

      // Si el rol es admin_area, actualizar también el departamento
      if (roleData.role === 'admin_area') {
        updates.departamento = roleData.departamento;
      }

      // Si se pasa a empleado, limpiar departamento de administración
      if (roleData.role === 'empleado' && roleData.departamento) {
        updates.departamento = roleData.departamento;
      }

      await userRef.update(updates);

      const updatedDoc = await userRef.get();
      return {
        uid: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error actualizando rol de usuario:', error);
      throw error;
    }
  }
}

export default new UserService();
