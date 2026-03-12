/**
 * Servicio para gestión de documentos de empleados
 */

import { getFirestore } from '../config/firebase.js';
import { COLLECTIONS, TIPOS_DOCUMENTO } from '../config/constants.js';

class DocumentService {
  constructor() {
    this.documentsCollection = COLLECTIONS.DOCUMENTOS_EMPLEADO;
  }

  get db() {
    return getFirestore();
  }

  // Convierte Timestamps de Firestore a ISO strings para serialización segura
  _serialize(data) {
    return {
      ...data,
      fechaSubida: data.fechaSubida?.toDate?.()?.toISOString() ?? data.fechaSubida ?? null,
      fechaActualizacion: data.fechaActualizacion?.toDate?.()?.toISOString() ?? data.fechaActualizacion ?? null,
    };
  }

  /**
   * Obtiene los documentos de un usuario específico
   * Nota: Ordenamos en memoria para evitar índices compuestos en Firestore
   */
  async getDocumentsByUser(uid) {
    try {
      // Consulta simple sin orderBy para evitar índices compuestos
      const querySnapshot = await this.db
        .collection(this.documentsCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar visibles y ordenar en memoria
      const docs = querySnapshot.docs
        .map(doc => this._serialize({ id: doc.id, ...doc.data() }))
        .filter(doc => doc.visible === true)
        .sort((a, b) => new Date(b.fechaSubida || 0) - new Date(a.fechaSubida || 0));

      return docs;
    } catch (error) {
      console.error('Error obteniendo documentos del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los documentos de un usuario (incluye no visibles - para admin)
   */
  async getAllDocumentsByUser(uid) {
    try {
      const querySnapshot = await this.db
        .collection(this.documentsCollection)
        .where('uid', '==', uid)
        .get();

      // Ordenar en memoria para evitar índices compuestos
      const docs = querySnapshot.docs
        .map(doc => this._serialize({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.fechaSubida || 0) - new Date(a.fechaSubida || 0));

      return docs;
    } catch (error) {
      console.error('Error obteniendo todos los documentos del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene un documento por su ID
   */
  async getDocumentById(docId) {
    try {
      const docRef = await this.db.collection(this.documentsCollection).doc(docId).get();

      if (!docRef.exists) {
        return null;
      }

      return this._serialize({ id: docRef.id, ...docRef.data() });
    } catch (error) {
      console.error('Error obteniendo documento:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo documento
   */
  async createDocument(documentData) {
    try {
      // Validar tipo de documento
      const tiposValidos = Object.values(TIPOS_DOCUMENTO);
      if (!tiposValidos.includes(documentData.tipo)) {
        throw new Error(`Tipo de documento inválido. Tipos válidos: ${tiposValidos.join(', ')}`);
      }

      const docData = {
        uid: documentData.uid,
        emailUsuario: documentData.emailUsuario,
        nombreUsuario: documentData.nombreUsuario,
        tipo: documentData.tipo,
        nombre: documentData.nombre,
        descripcion: documentData.descripcion || '',
        url: documentData.url,
        tamano: documentData.tamano || 0,
        mimeType: documentData.mimeType || 'application/octet-stream',
        fechaSubida: new Date(),
        subidoPor: documentData.subidoPor || null,
        visible: documentData.visible !== false,
        // Para recibos de nómina
        periodoNomina: documentData.periodoNomina || null
      };

      const docRef = await this.db.collection(this.documentsCollection).add(docData);

      return {
        id: docRef.id,
        ...docData
      };
    } catch (error) {
      console.error('Error creando documento:', error);
      throw error;
    }
  }

  /**
   * Actualiza un documento
   */
  async updateDocument(docId, updateData) {
    try {
      const docRef = this.db.collection(this.documentsCollection).doc(docId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        throw new Error('Documento no encontrado');
      }

      // Campos permitidos para actualización
      const allowedFields = ['nombre', 'descripcion', 'visible', 'tipo', 'periodoNomina'];
      const updates = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return {
          id: docSnapshot.id,
          ...docSnapshot.data()
        };
      }

      updates.fechaActualizacion = new Date();

      await docRef.update(updates);

      const updatedDoc = await docRef.get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error actualizando documento:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(docId) {
    try {
      const docRef = this.db.collection(this.documentsCollection).doc(docId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        throw new Error('Documento no encontrado');
      }

      // Obtener la URL para posible eliminación del storage
      const docData = docSnapshot.data();

      await docRef.delete();

      return {
        success: true,
        message: 'Documento eliminado',
        url: docData.url // Retornar URL para que el controller pueda eliminar del storage
      };
    } catch (error) {
      console.error('Error eliminando documento:', error);
      throw error;
    }
  }

  /**
   * Obtiene documentos por tipo
   */
  async getDocumentsByType(uid, tipo) {
    try {
      // Consulta simple
      const querySnapshot = await this.db
        .collection(this.documentsCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar y ordenar en memoria
      const docs = querySnapshot.docs
        .map(doc => this._serialize({ id: doc.id, ...doc.data() }))
        .filter(doc => doc.tipo === tipo && doc.visible === true)
        .sort((a, b) => new Date(b.fechaSubida || 0) - new Date(a.fechaSubida || 0));

      return docs;
    } catch (error) {
      console.error('Error obteniendo documentos por tipo:', error);
      throw error;
    }
  }

  /**
   * Obtiene recibos de nómina de un período específico
   */
  async getPayrollReceipts(uid, anio, mes = null) {
    try {
      // Consulta simple
      const querySnapshot = await this.db
        .collection(this.documentsCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar y ordenar en memoria
      const docs = querySnapshot.docs
        .map(doc => this._serialize({ id: doc.id, ...doc.data() }))
        .filter(doc => {
          if (doc.tipo !== TIPOS_DOCUMENTO.RECIBO_NOMINA) return false;
          if (doc.visible !== true) return false;
          if (!doc.periodoNomina || doc.periodoNomina.anio !== anio) return false;
          if (mes !== null && doc.periodoNomina.mes !== mes) return false;
          return true;
        })
        .sort((a, b) => new Date(b.fechaSubida || 0) - new Date(a.fechaSubida || 0));

      return docs;
    } catch (error) {
      console.error('Error obteniendo recibos de nómina:', error);
      throw error;
    }
  }

  /**
   * Cuenta documentos por usuario
   */
  async countDocumentsByUser(uid) {
    try {
      const querySnapshot = await this.db
        .collection(this.documentsCollection)
        .where('uid', '==', uid)
        .get();

      // Filtrar visibles en memoria
      const visibleCount = querySnapshot.docs.filter(doc => doc.data().visible === true).length;
      return visibleCount;
    } catch (error) {
      console.error('Error contando documentos:', error);
      throw error;
    }
  }
}

export default new DocumentService();
