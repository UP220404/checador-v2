/**
 * Configuración de Cloudinary para upload de imágenes
 * Usa lazy config para asegurar que dotenv ya cargó las variables
 */

import { v2 as cloudinary } from 'cloudinary';

let configured = false;

function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    configured = true;
    console.log('☁️ Cloudinary configurado - cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  }
  return cloudinary;
}

export default getCloudinary;
