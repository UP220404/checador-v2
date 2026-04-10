import { getFirestore } from 'firebase-admin/firestore';
import getCloudinary from '../config/cloudinary.js';
import { HTTP_STATUS } from '../config/constants.js';

class MarketingController {
  
  /**
   * GET /api/v1/marketing/carousel
   * Obtiene TODAS las imágenes vigentes (público o interno)
   */
  async getCarouselImages(req, res) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('marketing_carousel')
                               .orderBy('createdAt', 'desc')
                               .get();
      
      const images = [];
      const now = new Date();

      snapshot.forEach(doc => {
        const data = doc.data();
        
        if (data.tipo === 'indefinido') {
          images.push({ id: doc.id, ...data });
        } else if (data.fechaExpiracion) {
          // Verificar que aún no expiró
          const expDate = new Date(data.fechaExpiracion);
          if (now > expDate) return; // ya expiró
          
          // Verificar que ya inició (si tiene fechaInicio)
          if (data.fechaInicio) {
            const startDate = new Date(data.fechaInicio);
            if (now < startDate) return; // todavía no empieza
          }
          
          images.push({ id: doc.id, ...data });
        }
      });

      res.json({
        success: true,
        data: images
      });
    } catch (error) {
      console.error('Error en getCarouselImages:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al obtener imágenes del carrusel'
      });
    }
  }

  /**
   * POST /api/v1/marketing/carousel
   * Sube una imagen a Cloudinary y guarda en Firestore
   */
  async uploadCarouselImage(req, res) {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Se requiere un archivo de imagen'
        });
      }

      // El body viene como FormData
      let { tipo, fechaExpiracion, fechaInicio, titulo, duracion, objectPosition } = req.body;
      
      // Sanitizar valores predeterminados
      tipo = tipo || 'indefinido';
      const duracionNum = parseInt(duracion) || 10;
      const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      if (tipo === 'fecha_especifica' && !fechaExpiracion) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Una fecha/hora de fin es requerida si el tipo es: fecha_especifica'
        });
      }

      console.log(`📸 Subiendo imagen de marketing: ${req.file.originalname}`);

      // Subir a Cloudinary
      const cld = getCloudinary();
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cld.uploader.upload_stream(
          {
            folder: 'checador-v2/marketing',
            resource_type: resourceType
          },
          (error, result) => {
            if (error) {
              console.error('📸 Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.file.buffer);
      });

      // Guardar en Firestore
      const db = getFirestore();
      const docRef = db.collection('marketing_carousel').doc();
      
      const newImage = {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        tipo,
        duracion: duracionNum,
        resource_type: resourceType,
        fechaInicio: tipo === 'fecha_especifica' ? (fechaInicio || null) : null,
        fechaExpiracion: tipo === 'fecha_especifica' ? fechaExpiracion : null,
        titulo: titulo || '',
        objectPosition: objectPosition || '50% 50%',
        subidoPor: req.user.uid,
        subidoPorNombre: req.user.email || 'Admin',
        createdAt: new Date().toISOString()
      };

      await docRef.set(newImage);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Imagen subida correctamente',
        data: { id: docRef.id, ...newImage }
      });

    } catch (error) {
      console.error('Error en uploadCarouselImage:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al subir la imagen'
      });
    }
  }

  /**
   * PATCH /api/v1/marketing/carousel/:id
   * Actualiza metadatos y opcionalmente la foto
   */
  async updateCarouselImage(req, res) {
    try {
      const { id } = req.params;
      let { tipo, fechaExpiracion, fechaInicio, titulo, duracion, objectPosition } = req.body;
      const db = getFirestore();
      const docRef = db.collection('marketing_carousel').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Imagen no encontrada'
        });
      }

      const currentData = doc.data();
      const updateData = {
        titulo: titulo !== undefined ? titulo : currentData.titulo,
        tipo: tipo !== undefined ? tipo : currentData.tipo,
        duracion: duracion !== undefined ? parseInt(duracion) : currentData.duracion,
        fechaInicio: tipo === 'fecha_especifica' ? (fechaInicio || null) : null,
        fechaExpiracion: tipo === 'fecha_especifica' ? fechaExpiracion : (tipo === 'indefinido' ? null : currentData.fechaExpiracion),
        objectPosition: objectPosition !== undefined ? objectPosition : (currentData.objectPosition || '50% 50%'),
        updatedAt: new Date().toISOString()
      };

      // Si se subió una nueva foto
      if (req.file) {
        console.log(`📸 Reemplazando imagen de marketing: ${id}`);
        const cld = getCloudinary();
        
        // 1. Subir la nueva
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cld.uploader.upload_stream(
            { 
              folder: 'checador-v2/marketing',
              resource_type: resourceType
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        // 2. Borrar la vieja si existe public_id
        if (currentData.public_id) {
          try {
            await cld.uploader.destroy(currentData.public_id, { resource_type: currentData.resource_type || 'image' });
          } catch (err) {
            console.error('Error al borrar imagen vieja en Cloudinary:', err);
          }
        }

        updateData.url = uploadResult.secure_url;
        updateData.public_id = uploadResult.public_id;
        updateData.resource_type = resourceType;
      }

      await docRef.update(updateData);

      res.json({
        success: true,
        message: 'Imagen actualizada correctamente',
        data: { id, ...currentData, ...updateData }
      });

    } catch (error) {
      console.error('Error en updateCarouselImage:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al actualizar la imagen'
      });
    }
  }

  /**
   * DELETE /api/v1/marketing/carousel/:id
   * Elimina de Cloudinary y Firestore
   */
  async deleteCarouselImage(req, res) {
    try {
      const { id } = req.params;
      const db = getFirestore();
      
      const docRef = db.collection('marketing_carousel').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Imagen no encontrada'
        });
      }

      const data = doc.data();

      // Borrar de Cloudinary si tiene public_id
      if (data.public_id) {
        try {
          const cld = getCloudinary();
          await cld.uploader.destroy(data.public_id, { resource_type: data.resource_type || 'image' });
          console.log(`📸 Contenido de marketing eliminado de Cloudinary: ${data.public_id}`);
        } catch (cloudErr) {
          console.error('Error eliminando de Cloudinary:', cloudErr);
          // Continuamos aunque falle cloudinary para limpiar la DB
        }
      }

      // Borrar de Firestore
      await docRef.delete();

      res.json({
        success: true,
        message: 'Imagen eliminada correctamente'
      });
    } catch (error) {
      console.error('Error en deleteCarouselImage:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: 'Error al eliminar la imagen'
      });
    }
  }
}

export default new MarketingController();
