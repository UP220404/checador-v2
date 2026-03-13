/**
 * Middleware de upload con Multer (en memoria)
 * Para subir archivos a Cloudinary sin guardarlos en disco
 */

import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Solo aceptar imágenes
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (jpg, png, webp)'), false);
  }
};

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
}).single('foto');

// Middleware para documentos (PDFs + imágenes, hasta 10MB)
const docFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/', 'application/pdf'];
  if (allowedTypes.some(t => file.mimetype.startsWith(t))) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes y PDFs'), false);
  }
};

export const uploadDocument = multer({
  storage,
  fileFilter: docFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
}).single('archivo');
