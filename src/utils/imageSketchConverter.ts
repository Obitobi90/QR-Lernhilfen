/**
 * High-Resolution Image to Sketch & Line Art Converter.
 * Converts uploaded photos and images into artistic sketches (pencil drawing, ink line-art, or edge contour)
 * with customizable stroke color and transparency for embedding sharply into QR codes.
 */

export type SketchStyle = 'pencil' | 'ink' | 'outline' | 'charcoal';

export interface SketchOptions {
  style?: SketchStyle;
  strokeColor?: string; // Hex color code e.g. '#0f172a' or '#3730a3'
  intensity?: number; // 1 to 5 (default 3)
  transparentBackground?: boolean;
  targetDimension?: number; // default 512 for ultra-crisp display
}

/**
 * Parses any hex color (e.g. '#3730a3' or '#fff') into RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num) || cleaned.length !== 6) {
    return { r: 15, g: 23, b: 42 }; // fallback to slate-900
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Loads an image from a URL, data URL, or File object
 */
function loadImage(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof source !== 'string') {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.onload = () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Ungültiges Bild'));
        img.src = reader.result as string;
      };
      reader.readAsDataURL(source);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Ungültige Bildquelle'));
      img.src = source;
    }
  });
}

/**
 * Converts any image into a stylized artistic sketch with customizable line color.
 */
export async function convertImageToSketch(
  source: string | File,
  options: SketchOptions = {}
): Promise<string> {
  const {
    style = 'pencil',
    strokeColor = '#0f172a',
    intensity = 3,
    transparentBackground = true,
    targetDimension = 512,
  } = options;

  const img = await loadImage(source);

  // Calculate scaled dimensions to preserve aspect ratio within targetDimension
  let width = img.width;
  let height = img.height;
  if (width > height) {
    height = Math.round((height * targetDimension) / width);
    width = targetDimension;
  } else {
    width = Math.round((width * targetDimension) / height);
    height = targetDimension;
  }
  // Ensure even dimensions
  width = Math.max(64, width);
  height = Math.max(64, height);

  // Setup offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // 1. Grayscale luminance array
  const gray = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    // Standard perceptual luminance formula
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // 2. Compute sketch stroke intensity per pixel (0 = pure background/white, 1 = maximum stroke)
  const strokeMap = new Float32Array(totalPixels);

  if (style === 'pencil' || style === 'charcoal') {
    // Classic Color Dodge Pencil Sketch:
    // inverted = 255 - gray
    // blurred = blur(inverted)
    // dodged = (gray * 256) / (255 - blurred + 1)
    const inverted = new Float32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      inverted[i] = 255 - gray[i];
    }

    // Fast 2-pass separable box blur
    const blurRadius = Math.max(2, Math.round(intensity * 2.5));
    const blurred = boxBlur(inverted, width, height, blurRadius);

    for (let i = 0; i < totalPixels; i++) {
      const g = gray[i];
      const b = blurred[i];
      const denom = 255 - b;
      let dodged = denom <= 0 ? 255 : (g * 256) / (denom + 1);
      if (dodged > 255) dodged = 255;

      // Dark values in dodged are sketch strokes
      let stroke = (255 - dodged) / 255;

      if (style === 'charcoal') {
        // Charcoal has stronger grain and contrast
        stroke = Math.pow(stroke, 0.7) * 1.5;
      } else {
        // Pencil: boost subtle lines
        stroke = Math.pow(stroke, 0.85) * (1.1 + intensity * 0.15);
      }

      strokeMap[i] = Math.min(1, Math.max(0, stroke));
    }
  } else if (style === 'outline' || style === 'ink') {
    // Sobel gradient edge detector with high-contrast thresholding
    const thresholdBase = style === 'ink' ? 35 - intensity * 5 : 45 - intensity * 6;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        // 3x3 window around pixel
        const p00 = gray[(y - 1) * width + (x - 1)];
        const p01 = gray[(y - 1) * width + x];
        const p02 = gray[(y - 1) * width + (x + 1)];
        const p10 = gray[y * width + (x - 1)];
        const p12 = gray[y * width + (x + 1)];
        const p20 = gray[(y + 1) * width + (x - 1)];
        const p21 = gray[(y + 1) * width + x];
        const p22 = gray[(y + 1) * width + (x + 1)];

        // Sobel kernels
        const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
        const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

        const mag = Math.sqrt(gx * gx + gy * gy);
        let stroke = mag / (thresholdBase * 4);

        if (style === 'ink') {
          // Add local contrast threshold for strong comic / ink lines
          if (stroke > 0.4) stroke = Math.min(1, stroke * 1.6);
          else stroke = stroke * 0.5;
        }

        strokeMap[i] = Math.min(1, Math.max(0, stroke));
      }
    }
  }

  // 3. Render colorized strokes into canvas
  const rgb = hexToRgb(strokeColor);
  const outImgData = ctx.createImageData(width, height);
  const out = outImgData.data;

  // Sensitivity cutoff: ignore subtle noise so the drawing remains clean
  const cutoff = 0.08;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const s = strokeMap[i];

    if (s > cutoff) {
      // Map stroke to given color
      const alphaNorm = Math.min(1, (s - cutoff) / (1 - cutoff));
      out[idx] = rgb.r;
      out[idx + 1] = rgb.g;
      out[idx + 2] = rgb.b;
      out[idx + 3] = Math.round(alphaNorm * 255);
    } else {
      if (transparentBackground) {
        out[idx] = 255;
        out[idx + 1] = 255;
        out[idx + 2] = 255;
        out[idx + 3] = 0; // Transparent
      } else {
        out[idx] = 255;
        out[idx + 1] = 255;
        out[idx + 2] = 255;
        out[idx + 3] = 255; // White paper
      }
    }
  }

  ctx.putImageData(outImgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Fast 2-pass box blur on a 1D float array
 */
function boxBlur(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const target = new Float32Array(src.length);
  const temp = new Float32Array(src.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      const minX = Math.max(0, x - radius);
      const maxX = Math.min(width - 1, x + radius);
      for (let k = minX; k <= maxX; k++) {
        sum += src[rowOffset + k];
        count++;
      }
      temp[rowOffset + x] = sum / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      const minY = Math.max(0, y - radius);
      const maxY = Math.min(height - 1, y + radius);
      for (let k = minY; k <= maxY; k++) {
        sum += temp[k * width + x];
        count++;
      }
      target[y * width + x] = sum / count;
    }
  }

  return target;
}
