import QRCode from 'qrcode';

export type QrPresetId =
  | 'classic'
  | 'indigo_modern'
  | 'emerald_nature'
  | 'violet_creative'
  | 'dark_slate'
  | 'icon_book'
  | 'icon_math'
  | 'icon_graduation'
  | 'custom_logo';

export interface QrDesignSettings {
  preset: QrPresetId;
  name: string;
  darkColor: string;
  lightColor: string;
  centerLogoType: 'none' | 'preset_icon' | 'custom_image';
  presetIcon?: 'book' | 'math' | 'graduation';
  customLogoDataUrl?: string;
  badgeShape: 'circle' | 'rounded';
}

export const QR_PRESETS: Record<QrPresetId, QrDesignSettings> = {
  classic: {
    preset: 'classic',
    name: 'Klassisch (Schwarz / Weiß)',
    darkColor: '#0f172a',
    lightColor: '#ffffff',
    centerLogoType: 'none',
    badgeShape: 'circle',
  },
  indigo_modern: {
    preset: 'indigo_modern',
    name: 'Schul-Indigo (Modern)',
    darkColor: '#3730a3',
    lightColor: '#ffffff',
    centerLogoType: 'none',
    badgeShape: 'rounded',
  },
  emerald_nature: {
    preset: 'emerald_nature',
    name: 'Smaragd-Grün (Mint)',
    darkColor: '#065f46',
    lightColor: '#ffffff',
    centerLogoType: 'none',
    badgeShape: 'circle',
  },
  violet_creative: {
    preset: 'violet_creative',
    name: 'Kreativ-Violett',
    darkColor: '#581c87',
    lightColor: '#ffffff',
    centerLogoType: 'none',
    badgeShape: 'rounded',
  },
  dark_slate: {
    preset: 'dark_slate',
    name: 'Edles Schiefer-Graphit',
    darkColor: '#1e293b',
    lightColor: '#f8fafc',
    centerLogoType: 'none',
    badgeShape: 'circle',
  },
  icon_book: {
    preset: 'icon_book',
    name: 'Zentrum: Buch-Symbol (📖 Bildung)',
    darkColor: '#312e81',
    lightColor: '#ffffff',
    centerLogoType: 'preset_icon',
    presetIcon: 'book',
    badgeShape: 'circle',
  },
  icon_math: {
    preset: 'icon_math',
    name: 'Zentrum: Mathe & MINT (∑ Wissenschaft)',
    darkColor: '#0f766e',
    lightColor: '#ffffff',
    centerLogoType: 'preset_icon',
    presetIcon: 'math',
    badgeShape: 'rounded',
  },
  icon_graduation: {
    preset: 'icon_graduation',
    name: 'Zentrum: Erfolg & Schule (🎓 Abschluss)',
    darkColor: '#1e1b4b',
    lightColor: '#ffffff',
    centerLogoType: 'preset_icon',
    presetIcon: 'graduation',
    badgeShape: 'circle',
  },
  custom_logo: {
    preset: 'custom_logo',
    name: 'Eigenes Schullogo / Foto hochgeladen',
    darkColor: '#1e1b4b',
    lightColor: '#ffffff',
    centerLogoType: 'custom_image',
    badgeShape: 'circle',
  },
};

const STORAGE_QR_DESIGN = 'lernhilfen_qr_design_settings';

export function getQrDesignSettings(): QrDesignSettings {
  try {
    const raw = localStorage.getItem(STORAGE_QR_DESIGN);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.preset) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback
  }
  return QR_PRESETS.indigo_modern;
}

export function saveQrDesignSettings(settings: QrDesignSettings): void {
  try {
    localStorage.setItem(STORAGE_QR_DESIGN, JSON.stringify(settings));
    // Notify all active listeners across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qr-design-changed', { detail: settings }));
    }
  } catch (e) {
    console.error('Failed to save QR design settings:', e);
  }
}

/**
 * Resizes an uploaded image file to a compact max 256x256 data URL suitable for localStorage & canvas
 */
export async function processLogoImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Bilddatei'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ungültiges Bildformat'));
      img.onload = () => {
        const maxDim = 256;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Renders a QR code onto a canvas with the selected design settings,
 * including high error correction level and stylish centered badge (preset icon or custom photo).
 */
export async function renderStyledQrCode(
  canvas: HTMLCanvasElement,
  text: string,
  options?: {
    size?: number;
    customSettings?: QrDesignSettings;
  }
): Promise<void> {
  const settings = options?.customSettings || getQrDesignSettings();
  const size = options?.size || 320;

  // Use High error correction ('H') if a center logo/icon is used so phone cameras read it effortlessly
  const hasCenterBadge =
    settings.centerLogoType === 'preset_icon' ||
    (settings.centerLogoType === 'custom_image' && !!settings.customLogoDataUrl);

  const errorCorrectionLevel = hasCenterBadge ? 'H' : 'M';

  // Ensure canvas intrinsic dimensions match exactly
  canvas.width = size;
  canvas.height = size;

  await new Promise<void>((resolve, reject) => {
    QRCode.toCanvas(
      canvas,
      text,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel,
        color: {
          dark: settings.darkColor || '#0f172a',
          light: settings.lightColor || '#ffffff',
        },
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // If no center badge requested, we are done
  if (!hasCenterBadge) return;

  const centerSize = Math.round(size * 0.24); // 24% of QR width is ideal for 'H' error correction
  const centerX = (size - centerSize) / 2;
  const centerY = (size - centerSize) / 2;
  const radius = settings.badgeShape === 'circle' ? centerSize / 2 : centerSize * 0.22;

  ctx.save();

  // Draw background badge (white base with clean drop shadow)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (settings.badgeShape === 'circle') {
    ctx.arc(size / 2, size / 2, centerSize / 2 + 2, 0, Math.PI * 2);
  } else {
    // Rounded rect
    const x = centerX - 2;
    const y = centerY - 2;
    const w = centerSize + 4;
    const h = centerSize + 4;
    ctx.roundRect(x, y, w, h, radius);
  }
  ctx.fill();

  // Reset shadow for inner contents
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Draw outer border ring in the theme's dark color
  ctx.strokeStyle = settings.darkColor || '#3730a3';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Render Custom Image Logo
  if (settings.centerLogoType === 'custom_image' && settings.customLogoDataUrl) {
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('Failed to load logo image'));
        img.src = settings.customLogoDataUrl!;
      });

      ctx.save();
      ctx.beginPath();
      if (settings.badgeShape === 'circle') {
        ctx.arc(size / 2, size / 2, centerSize / 2 - 1, 0, Math.PI * 2);
      } else {
        ctx.roundRect(centerX, centerY, centerSize, centerSize, radius);
      }
      ctx.clip();

      // Draw image fitted inside badge
      ctx.drawImage(img, centerX, centerY, centerSize, centerSize);
      ctx.restore();
    } catch (e) {
      console.warn('Could not draw custom logo on QR code:', e);
    }
  } else if (settings.centerLogoType === 'preset_icon') {
    // Render Stylized Preset Icon
    ctx.fillStyle = settings.darkColor || '#3730a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const iconType = settings.presetIcon || 'book';
    const bx = size / 2;
    const by = size / 2;

    if (iconType === 'book') {
      // Draw stylized Open Book icon
      const s = centerSize * 0.52;
      ctx.font = `bold ${Math.round(s)}px sans-serif`;
      ctx.fillText('📖', bx, by + 1);
    } else if (iconType === 'math') {
      // Draw stylized Math & Science Sigma symbol
      const s = centerSize * 0.52;
      ctx.font = `bold ${Math.round(s)}px "JetBrains Mono", sans-serif`;
      ctx.fillText('∑', bx, by);
    } else {
      // Graduation cap
      const s = centerSize * 0.52;
      ctx.font = `bold ${Math.round(s)}px sans-serif`;
      ctx.fillText('🎓', bx, by + 1);
    }
  }

  ctx.restore();
}
