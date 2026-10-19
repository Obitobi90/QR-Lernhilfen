/**
 * Client-side image compressor using HTML Canvas.
 * Resizes any uploaded image to a maximum width/height of 1200px while maintaining aspect ratio,
 * and outputs a compressed JPEG/WebP data URL or Blob.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.88
): Promise<{ dataUrl: string; blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let originalSize = 0;
    if (typeof fileOrDataUrl !== 'string') {
      originalSize = fileOrDataUrl.size;
    }

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      // Draw image onto canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export compressed data URL
      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create Blob from Canvas'));
            return;
          }
          resolve({
            dataUrl,
            blob,
            originalSize: originalSize || blob.size,
            compressedSize: blob.size,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = (err) => {
      reject(new Error('Failed to load image for compression'));
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
