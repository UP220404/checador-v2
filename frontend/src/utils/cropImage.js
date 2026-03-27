export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

export async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // Set canvas size to match the original image size first to draw the whole image
  canvas.width = image.width;
  canvas.height = image.height;

  // Draw the original image
  ctx.drawImage(image, 0, 0);

  // Extract the cropped region using the precise pixel coordinates provided by react-easy-crop
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // Resize canvas to the exact cropped dimension
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Paste the cropped image data at the top left corner of the newly resized canvas
  ctx.putImageData(data, 0, 0);

  // Output as a Blob so it can be uploaded as a file
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      blob.name = 'cropped.jpg';
      resolve(blob);
    }, 'image/jpeg', 0.95);
  });
}
