/**
 * Servicio para gestión de usuarios
 */

import { getFirestore, getAuth } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_FECHA_IMPORTANTE } from '../config/constants.js';
import { validarEmail, validarTipoUsuario } from '../utils/validators.js';
import admin from 'firebase-admin';
import crypto from 'crypto';

class UserService {
  constructor() {
    this.usersCollection = COLLECTIONS.USUARIOS;
    this.legacyCollection = COLLECTIONS.EMPLEADOS;
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
      if (!validarEmail(userData.email)) {
        throw new Error('Email inválido');
      }

      // Usar tipo por defecto si no se proporciona o es inválido
      const tipoUsuario = userData.tipo && validarTipoUsuario(userData.tipo)
        ? userData.tipo
        : 'tiempo_completo';

      // Verificar que el email no esté ya registrado
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      const userDoc = {
        nombre: userData.nombre,
        email: userData.email,
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

      // 🔄 Sync legacy collection
      await this._syncToLegacyEmployees(uid, userDoc).catch(err => 
        console.error('⚠️ Error en sync legacy (create):', err)
      );

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
      if (updateData.email && !validarEmail(updateData.email)) {
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

      const currentData = userDoc.data();

      // Si se está reactivando al usuario y tiene un correo resguardado
      if (updateData.activo === true && currentData.activo === false && currentData.correoOriginal) {
        try {
          const auth = getAuth();
          await auth.updateUser(uid, {
            email: currentData.correoOriginal,
            disabled: false // Reactivamos el acceso
          });
          
          // Si Firebase Auth lo acepta, restauramos en DB
          updateData.email = currentData.correoOriginal;
          
          // Borrar los campos de baja y respaldo
          updateData.correoOriginal = admin.firestore.FieldValue.delete();
          updateData.fechaRetencionHasta = admin.firestore.FieldValue.delete();
        } catch (authError) {
          console.error(`No se pudo restaurar el correo original para ${uid}:`, authError);
          // Opcional: Podríamos lanzar error, pero mejor dejamos que se reactive con el correo +baja y que RH lo cambie manual
        }
      } else if (updateData.email && updateData.email !== currentData.email) {
        // Si no es reactivación especial, pero el correo cambió, actualizar en Firebase Auth
        try {
          const auth = getAuth();
          await auth.updateUser(uid, {
            email: updateData.email
          });
          // Forzar cierre de sesión en todos los dispositivos
          await auth.revokeRefreshTokens(uid);
          console.log(`Sesiones revocadas para ${uid} tras cambio de correo`);
        } catch (authError) {
          console.error(`Error actualizando email en Auth para ${uid}:`, authError);
          if (authError.code === 'auth/email-already-exists') {
             throw new Error('El nuevo correo ya está registrado en otra cuenta.');
          }
          throw new Error('No se pudo actualizar el correo de acceso en el sistema.');
        }
      }

      await userRef.update({
        ...updateData,
        fechaActualizacion: new Date()
      });

      // 🔄 Sync legacy collection
      const fullUpdatedData = (await userRef.get()).data();
      await this._syncToLegacyEmployees(uid, fullUpdatedData).catch(err => 
        console.error('⚠️ Error en sync legacy (update):', err)
      );

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

      // 🔄 Sync legacy collection (desactivar también)
      await this.db.collection(this.legacyCollection).doc(uid).update({
        activo: false
      }).catch(() => {});

      return { success: true, message: 'Usuario desactivado' };
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  /**
   * Da de baja a un empleado con motivo y fecha registrados
   * Conserva toda su información para consulta durante 2 años
   */
  async deactivateUserWithReason(uid, { motivoBaja, fechaBaja, observacionesBaja = '' }) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      const originalEmail = userData.email || userData.correo;
      
      let newEmail = null;
      if (originalEmail) {
        // ventas@cielito.com -> ventas+baja_123456789@cielito.com
        const [username, domain] = originalEmail.split('@');
        newEmail = `${username}+baja_${Date.now()}@${domain || 'cielitohome.com'}`;
        
        try {
          const auth = getAuth();
          await auth.updateUser(uid, {
            email: newEmail,
            disabled: true // Bloqueamos también el inicio de sesión
          });
        } catch (authError) {
          console.error(`Advertencia: No se pudo actualizar el Auth de Firebase para ${uid}:`, authError);
          // Continuamos de todas formas para actualizar Firestore
        }
      }

      const fechaBajaDate = fechaBaja ? new Date(fechaBaja + 'T00:00:00') : new Date();
      // Retención: 2 años desde la fecha de baja
      const fechaRetencionHasta = new Date(fechaBajaDate);
      fechaRetencionHasta.setFullYear(fechaRetencionHasta.getFullYear() + 2);

      const updateData = {
        activo: false,
        motivoBaja: motivoBaja || 'No especificado',
        fechaBaja: fechaBaja || new Date().toISOString().split('T')[0],
        observacionesBaja,
        fechaRetencionHasta: fechaRetencionHasta.toISOString().split('T')[0],
        fechaEliminacion: new Date()
      };

      if (newEmail) {
        updateData.correoOriginal = originalEmail;
        if (userData.email) updateData.email = newEmail;
        if (userData.correo) updateData.correo = newEmail;
      }

      await userRef.update(updateData);

      // 🔄 Sync legacy collection
      await this.db.collection(this.legacyCollection).doc(uid).update({
        activo: false,
        ...(updateData.email && { email: updateData.email }),
        ...(updateData.correo && { correo: updateData.correo })
      }).catch(() => {});

      return { success: true, message: 'Empleado dado de baja correctamente', fechaRetencionHasta: fechaRetencionHasta.toISOString().split('T')[0] };
    } catch (error) {
      console.error('Error dando de baja a usuario:', error);
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
   * Calcula los días de vacaciones correspondientes según antigüedad
   * Reglas:
   *   < 6 meses   → 0 días (sin derecho)
   *   6m – 1 año  → 6 días
   *   1 – 2 años  → 12 días
   *   2+ años     → 12 + 2 × (añosCompletos − 1)
   */
  calcularDiasVacacionesPorAntiguedad(fechaIngreso) {
    if (!fechaIngreso) return 0;
    const ingreso = new Date(fechaIngreso + 'T00:00:00');
    if (isNaN(ingreso.getTime())) return 0;

    const hoy = new Date();
    // Meses completos transcurridos
    const meses =
      (hoy.getFullYear() - ingreso.getFullYear()) * 12 +
      (hoy.getMonth() - ingreso.getMonth()) +
      (hoy.getDate() >= ingreso.getDate() ? 0 : -1);

    if (meses < 6) return 0;          // Sin derecho
    if (meses < 12) return 6;         // 6 meses – 1 año

    const aniosCompletos = Math.floor(meses / 12);
    if (aniosCompletos < 2) return 12; // 1 año – 2 años

    // 2+ años: 12 + 2×(n−1)
    return 12 + 2 * (aniosCompletos - 1);
  }

  /**
   * Obtiene el saldo de vacaciones de un usuario
   * Los diasDisponibles se calculan dinámicamente desde fechaIngreso
   */
  async getSaldoVacaciones(uid) {
    try {
      const userDoc = await this.db.collection(this.usersCollection).doc(uid).get();
      if (!userDoc.exists) throw new Error('Usuario no encontrado');

      const userData = userDoc.data();
      const saldoDB = userData.saldoVacaciones || {};

      // Calcular días disponibles correctamente desde fechaIngreso
      const diasDisponibles = this.calcularDiasVacacionesPorAntiguedad(userData.fechaIngreso);

      // Perseguir diasUsados y diasPendientes desde la DB (se actualizan al aprobar/rechazar ausencias)
      const diasUsados = saldoDB.diasUsados || 0;
      const diasPendientes = saldoDB.diasPendientes || 0;
      const diasRestantes = Math.max(0, diasDisponibles - diasUsados - diasPendientes);

      // Calcular antigüedad para mostrarla en el frontend
      const mesesAntiguedad = userData.fechaIngreso
        ? (() => {
            const ingreso = new Date(userData.fechaIngreso + 'T00:00:00');
            const hoy = new Date();
            return (
              (hoy.getFullYear() - ingreso.getFullYear()) * 12 +
              (hoy.getMonth() - ingreso.getMonth()) +
              (hoy.getDate() >= ingreso.getDate() ? 0 : -1)
            );
          })()
        : null;

      return {
        diasDisponibles,
        diasUsados,
        diasPendientes,
        diasRestantes,
        mesesAntiguedad,
        tieneDerecho: diasDisponibles > 0,
        ultimaActualizacion: saldoDB.ultimaActualizacion || null,
        fechaIngreso: userData.fechaIngreso || null
      };
    } catch (error) {
      console.error('Error obteniendo saldo de vacaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene el saldo de vacaciones de TODOS los empleados activos
   * Usado por el panel de RH
   */
  async getAllVacacionesSummary() {
    try {
      const snapshot = await this.db
        .collection(this.usersCollection)
        .where('activo', '!=', false)
        .get();

      const results = [];
      for (const doc of snapshot.docs) {
        const u = doc.data();
        // Omitir ex-empleados y cuentas del sistema
        if (u.activo === false) continue;
        if (!u.nombre) continue;

        const diasDisponibles = this.calcularDiasVacacionesPorAntiguedad(u.fechaIngreso);
        const saldoDB = u.saldoVacaciones || {};
        const diasUsados = saldoDB.diasUsados || 0;
        const diasPendientes = saldoDB.diasPendientes || 0;
        const diasRestantes = Math.max(0, diasDisponibles - diasUsados - diasPendientes);

        const mesesAntiguedad = u.fechaIngreso
          ? (() => {
              const ingreso = new Date(u.fechaIngreso + 'T00:00:00');
              const hoy = new Date();
              return (
                (hoy.getFullYear() - ingreso.getFullYear()) * 12 +
                (hoy.getMonth() - ingreso.getMonth()) +
                (hoy.getDate() >= ingreso.getDate() ? 0 : -1)
              );
            })()
          : null;

        results.push({
          uid: doc.id,
          id: doc.id,
          nombre: u.nombre,
          correo: u.correo || u.email || '',
          departamento: u.departamento || '',
          puesto: u.puesto || '',
          fechaIngreso: u.fechaIngreso || null,
          mesesAntiguedad,
          saldo: {
            diasDisponibles,
            diasUsados,
            diasPendientes,
            diasRestantes,
            tieneDerecho: diasDisponibles > 0
          }
        });
      }

      // Ordenar por nombre
      results.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return results;
    } catch (error) {
      console.error('Error obteniendo resumen de vacaciones:', error);
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
   * Recalcula diasUsados y diasPendientes desde las ausencias de Firestore
   * Los diasDisponibles se calculan automáticamente desde fechaIngreso (no se persisten)
   */
  async recalcularSaldoVacaciones(uid) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) throw new Error('Usuario no encontrado');

      const userData = userDoc.data();
      const emailUsuario = userData.correo || userData.email;
      if (!emailUsuario) {
        const diasDisponibles = this.calcularDiasVacacionesPorAntiguedad(userData.fechaIngreso);
        return { diasDisponibles, diasUsados: 0, diasPendientes: 0, diasRestantes: diasDisponibles, tieneDerecho: diasDisponibles > 0 };
      }

      // Traer TODAS las ausencias de este usuario (priorizar userId, fallback a emailUsuario)
      // (evita índices compuestos en Firestore)
      let snapshot = await this.db.collection(COLLECTIONS.AUSENCIAS)
        .where('userId', '==', uid)
        .get();

      // Si no hay registros con userId, intentar con emailUsuario (para datos históricos)
      if (snapshot.empty && emailUsuario) {
        snapshot = await this.db.collection(COLLECTIONS.AUSENCIAS)
          .where('emailUsuario', '==', emailUsuario)
          .get();
      }

      const contarDias = (data) => {
        if (data.diasJustificados > 0) return Number(data.diasJustificados);
        if (data.diasSolicitados  > 0) return Number(data.diasSolicitados);
        if (data.fechaInicio && data.fechaFin) {
          const inicio = data.fechaInicio.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00');
          const fin    = data.fechaFin.toDate    ? data.fechaFin.toDate()    : new Date(data.fechaFin    + 'T00:00:00');
          return Math.ceil(Math.abs(fin - inicio) / 86400000) + 1;
        }
        return 0;
      };

      let diasUsados = 0;
      let diasPendientes = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tipo !== 'vacaciones') return; // solo vacaciones
        const dias = contarDias(data);
        if (['aprobado', 'aprobada'].includes(data.estado)) {
          diasUsados += dias;
        } else if (data.estado === 'pendiente') {
          diasPendientes += dias;
        }
      });

      await userRef.update({
        'saldoVacaciones.diasUsados': diasUsados,
        'saldoVacaciones.diasPendientes': diasPendientes,
        'saldoVacaciones.ultimaActualizacion': new Date(),
        fechaActualizacion: new Date()
      });

      const diasDisponibles = this.calcularDiasVacacionesPorAntiguedad(userData.fechaIngreso);

      return {
        diasDisponibles,
        diasUsados,
        diasPendientes,
        diasRestantes: Math.max(0, diasDisponibles - diasUsados - diasPendientes),
        tieneDerecho: diasDisponibles > 0
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
      const rolesValidos = ['empleado', 'admin_area', 'admin_rh', 'sistemas'];
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

  /**
   * 🔄 Sincroniza datos con la colección legacy 'empleados'
   * Mantiene compatibilidad con el scanner antiguo que busca en esta colección específica.
   */
  async _syncToLegacyEmployees(uid, data) {
    try {
      const legacyDoc = {
        nombre: data.nombre,
        correo: data.correo,
        tipo: data.tipo,
        activo: data.activo !== false,
        departamento: data.departamento || '',
        puesto: data.puesto || '',
        fechaSincronizacion: new Date()
      };

      // Si tiene datos de nómina en el objeto, incluirlos
      if (data.salarioBase) legacyDoc.salarioBase = data.salarioBase;
      if (data.salarioQuincenal) legacyDoc.salarioQuincenal = data.salarioQuincenal;

      await this.db.collection(this.legacyCollection).doc(uid).set(legacyDoc, { merge: true });
      console.log(`📡 Sync Legacy OK: ${data.correo} -> empleados/${uid}`);
    } catch (error) {
      console.error('❌ Error sincronizando con colección legacy:', error);
    }
  }
}

export default new UserService();
