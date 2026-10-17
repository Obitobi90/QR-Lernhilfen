import QRCode from 'qrcode';
import { convertImageToSketch, SketchStyle, hexToRgb } from './imageSketchConverter';

export type QrBorderDecoration =
  | 'none'
  | 'corner_accents'
  | 'school_grid'
  | 'math_symbols'
  | 'double_vintage'
  | 'stamp_dots'
  | 'sketch_doodle'
  | 'modern_tech';

export type QrCenterLogoType = 'none' | 'preset_icon' | 'sketch_drawing' | 'custom_image';

export type QrPresetId =
  | 'classic'
  | 'indigo_modern'
  | 'emerald_nature'
  | 'violet_creative'
  | 'dark_slate'
  | 'crimson_study'
  | 'custom_colors';

export interface QrDesignSettings {
  preset: QrPresetId;
  name: string;
  darkColor: string; // Foreground / QR modules hex code e.g. #0F172A
  lightColor: string; // Background hex code e.g. #FFFFFF
  borderDecoration: QrBorderDecoration;
  centerLogoType: QrCenterLogoType;
  presetIcon?: 'book' | 'math' | 'graduation';
  rawUploadedImage?: string; // Original uploaded photo/image
  customLogoDataUrl?: string; // Converted sketch or logo data URL
  sketchStyle?: SketchStyle;
  sketchStrokeColor?: string; // Hex code or empty to match darkColor
  sketchIntensity?: number; // 1 to 5
  badgeShape: 'circle' | 'rounded';
  logoFit?: 'contain' | 'cover'; // Aspect-ratio preservation mode
  logoZoom?: number; // Zoom level e.g. 0.5 to 2.2 (default 1.0 = 100%)
}



export const QR_BORDER_OPTIONS: {
  id: QrBorderDecoration;
  name: string;
  description: string;
  previewIcon: string;
}[] = [
  {
    id: 'none',
    name: 'Schlicht (Ohne Randverzierung)',
    description: 'Minimalistisch & rein, ideal für schnelle Scans',
    previewIcon: '◻️',
  },
  {
    id: 'corner_accents',
    name: 'Elegante Zierecken & Eckmarken',
    description: 'Prägnante Eckwinkel mit Zierpunkten für Arbeitsblätter & Prüfungen',
    previewIcon: '📐',
  },
  {
    id: 'school_grid',
    name: 'Schulheft- & Karomuster-Rand',
    description: 'Feines Punktraster wie im karierten Mathe-Schulheft',
    previewIcon: '📓',
  },
  {
    id: 'math_symbols',
    name: 'Mathematik- & Formelkranz',
    description: 'Filigrane Mathe-Symbole (π, ∑, √x, ∞, ∫, ≈) als umlaufende Zierleiste',
    previewIcon: '∑',
  },
  {
    id: 'double_vintage',
    name: 'Klassischer Doppelrahmen',
    description: 'Doppelte Zierlinie mit Eckrosetten im Buchbinderei-Stil',
    previewIcon: '📜',
  },
  {
    id: 'stamp_dots',
    name: 'Stempel- & Lochstreifen-Rand',
    description: 'Feine Perforations-Punkte im Look einer Schul-Briefmarke',
    previewIcon: '🏷️',
  },
  {
    id: 'sketch_doodle',
    name: 'Handgezeichneter Skizzen-Rand',
    description: 'Organische Doppelkontur passend zur Skizzen-Zeichnung',
    previewIcon: '✏️',
  },
  {
    id: 'modern_tech',
    name: 'Tech- & Scanner-Visier',
    description: 'Moderne Ziermarkierungen & Fadenkreuze wie ein digitaler Scanner',
    previewIcon: '🎯',
  },
];

export const QR_COLOR_PRESETS: Record<QrPresetId, { name: string; dark: string; light: string }> = {
  classic: {
    name: 'Klassisch Schwarz/Weiß',
    dark: '#0f172a',
    light: '#ffffff',
  },
  indigo_modern: {
    name: 'Schul-Indigo (Modern)',
    dark: '#3730a3',
    light: '#ffffff',
  },
  emerald_nature: {
    name: 'Smaragd-Grün (MINT)',
    dark: '#065f46',
    light: '#ffffff',
  },
  violet_creative: {
    name: 'Kreativ-Violett',
    dark: '#581c87',
    light: '#ffffff',
  },
  dark_slate: {
    name: 'Edles Schiefer-Graphit',
    dark: '#1e293b',
    light: '#f8fafc',
  },
  crimson_study: {
    name: 'Rubinrot / Fokus',
    dark: '#881337',
    light: '#ffffff',
  },
  custom_colors: {
    name: 'Benutzerdefinierter Farbcode',
    dark: '#1d4ed8',
    light: '#ffffff',
  },
};

const STORAGE_QR_DESIGN = 'lernhilfen_qr_design_settings';

export function getDefaultQrDesignSettings(): QrDesignSettings {
  return {
    preset: 'indigo_modern',
    name: 'Schul-Indigo',
    darkColor: '#3730a3',
    lightColor: '#ffffff',
    borderDecoration: 'corner_accents',
    centerLogoType: 'none',
    badgeShape: 'rounded',
    logoFit: 'contain',
    logoZoom: 1.0,
    sketchStyle: 'pencil',
    sketchIntensity: 3,
  };
}



export function getQrDesignSettings(): QrDesignSettings {
  try {
    const raw = localStorage.getItem(STORAGE_QR_DESIGN);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.darkColor) {
        // Ensure new fields exist with defaults
        return {
          ...getDefaultQrDesignSettings(),
          ...parsed,
          borderDecoration: parsed.borderDecoration || 'corner_accents',
        };
      }
    }
  } catch (e) {
    // fallback
  }
  return getDefaultQrDesignSettings();
}

export function saveQrDesignSettings(settings: QrDesignSettings): void {
  try {
    localStorage.setItem(STORAGE_QR_DESIGN, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qr-design-changed', { detail: settings }));
    }
  } catch (e) {
    console.error('Failed to save QR design settings:', e);
  }
}

/**
 * Converts an uploaded photo/image into a crisp sketch line drawing using custom color and style.
 */
export async function processUploadedImageAsSketch(
  fileOrDataUrl: File | string,
  options: {
    style?: SketchStyle;
    strokeColor?: string;
    intensity?: number;
  } = {}
): Promise<{ rawUrl: string; sketchUrl: string }> {
  let rawUrl = '';
  if (typeof fileOrDataUrl === 'string') {
    rawUrl = fileOrDataUrl;
  } else {
    rawUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Lesefehler beim Bild'));
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  // Generate high-resolution crisp sketch
  const sketchUrl = await convertImageToSketch(rawUrl, {
    style: options.style || 'pencil',
    strokeColor: options.strokeColor || '#0f172a',
    intensity: options.intensity || 3,
    transparentBackground: true,
    targetDimension: 600, // Crisp 600px line art
  });

  return { rawUrl, sketchUrl };
}

/**
 * Draws ornamental borders / edge embellishments around the QR code canvas.
 */
function drawOrnamentalBorder(
  ctx: CanvasRenderingContext2D,
  borderType: QrBorderDecoration,
  totalSize: number,
  qrMargin: number,
  qrSize: number,
  color: string,
  bgColor: string
) {
  if (borderType === 'none') return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pad = 12; // Outer margin from canvas edge
  const left = pad;
  const top = pad;
  const right = totalSize - pad;
  const bottom = totalSize - pad;
  const width = right - left;
  const height = bottom - top;

  switch (borderType) {
    case 'corner_accents': {
      // Elegant multi-tier corner brackets with accent dots & diagonal ticks
      const len = Math.round(width * 0.16);
      ctx.lineWidth = 3;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(left, top + len);
      ctx.lineTo(left, top);
      ctx.lineTo(left + len, top);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(right - len, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, top + len);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(right, bottom - len);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right - len, bottom);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(left + len, bottom);
      ctx.lineTo(left, bottom);
      ctx.lineTo(left, bottom - len);
      ctx.stroke();

      // Corner accent dots
      const dotRadius = 3;
      const cornerInset = 6;
      [
        [left + cornerInset, top + cornerInset],
        [right - cornerInset, top + cornerInset],
        [right - cornerInset, bottom - cornerInset],
        [left + cornerInset, bottom - cornerInset],
      ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtle thin inner frame line
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(left + 6, top + 6, width - 12, height - 12);
      ctx.globalAlpha = 1;
      break;
    }

    case 'school_grid': {
      // Dotted grid margin as in math notebook + outer clean hairline
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left, top, width, height);

      // Inner margin line (like school notebook margin)
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(left + 7, top + 7, width - 14, height - 14);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Small grid dots on the 4 corners
      const gridStep = 8;
      for (let x = left + 2; x <= left + 24; x += gridStep) {
        for (let y = top + 2; y <= top + 24; y += gridStep) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let x = right - 24; x <= right - 2; x += gridStep) {
        for (let y = top + 2; y <= top + 24; y += gridStep) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let x = left + 2; x <= left + 24; x += gridStep) {
        for (let y = bottom - 24; y <= bottom - 2; y += gridStep) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let x = right - 24; x <= right - 2; x += gridStep) {
        for (let y = bottom - 24; y <= bottom - 2; y += gridStep) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'math_symbols': {
      // Mathematical symbols decoratively framing the QR code
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left + 5, top + 5, width - 10, height - 10);

      // Symbols array
      const symbols = ['π', '∑', '√', '∞', '∫', 'α', 'Δ', '≈', '≠', '%', 'x²'];
      ctx.font = 'bold 12px "JetBrains Mono", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Distribute symbols along top and bottom
      const countX = 5;
      const stepX = width / (countX + 1);
      for (let i = 1; i <= countX; i++) {
        const symTop = symbols[(i - 1) % symbols.length];
        const symBottom = symbols[(i + 4) % symbols.length];
        ctx.fillText(symTop, left + i * stepX, top + 1);
        ctx.fillText(symBottom, left + i * stepX, bottom - 1);
      }

      // Along left and right
      const countY = 5;
      const stepY = height / (countY + 1);
      for (let i = 1; i <= countY; i++) {
        const symLeft = symbols[(i + 2) % symbols.length];
        const symRight = symbols[(i + 6) % symbols.length];
        ctx.fillText(symLeft, left + 1, top + i * stepY);
        ctx.fillText(symRight, right - 1, top + i * stepY);
      }
      break;
    }

    case 'double_vintage': {
      // Classical double border with decorative diamond corner flourishes
      ctx.lineWidth = 2.5;
      ctx.strokeRect(left, top, width, height);

      ctx.lineWidth = 1;
      ctx.strokeRect(left + 5, top + 5, width - 10, height - 10);

      // Corner diamonds
      const diamondSize = 5;
      const corners = [
        [left + 2.5, top + 2.5],
        [right - 2.5, top + 2.5],
        [right - 2.5, bottom - 2.5],
        [left + 2.5, bottom - 2.5],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - diamondSize);
        ctx.lineTo(cx + diamondSize, cy);
        ctx.lineTo(cx, cy + diamondSize);
        ctx.lineTo(cx - diamondSize, cy);
        ctx.closePath();
        ctx.fill();
      });
      break;
    }

    case 'stamp_dots': {
      // Postage stamp / certificate perforation edge
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left + 4, top + 4, width - 8, height - 8);

      const dotSpacing = 10;
      const radius = 1.8;

      // Top & Bottom rows
      for (let x = left + 8; x <= right - 8; x += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, top, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, bottom, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Left & Right columns
      for (let y = top + 8; y <= bottom - 8; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(left, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(right, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'sketch_doodle': {
      // Organic hand-drawn double sketch lines
      ctx.lineWidth = 1.8;

      // Outer hand-drawn loop
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.quadraticCurveTo(left + width * 0.5, top - 2, right, top + 1);
      ctx.quadraticCurveTo(right + 2, top + height * 0.5, right - 1, bottom);
      ctx.quadraticCurveTo(left + width * 0.5, bottom + 2, left + 1, bottom - 1);
      ctx.quadraticCurveTo(left - 2, top + height * 0.5, left, top);
      ctx.stroke();

      // Inner sketch loop
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(left + 6, top + 6);
      ctx.quadraticCurveTo(left + width * 0.5, top + 4, right - 5, top + 7);
      ctx.quadraticCurveTo(right - 4, top + height * 0.5, right - 7, bottom - 6);
      ctx.quadraticCurveTo(left + width * 0.5, bottom - 4, left + 5, bottom - 7);
      ctx.quadraticCurveTo(left + 4, top + height * 0.5, left + 6, top + 6);
      ctx.stroke();

      // Corner hatch marks
      const hatchLen = 8;
      ctx.lineWidth = 1;
      [
        [left + 3, top + 3],
        [right - 3, top + 3],
        [right - 3, bottom - 3],
        [left + 3, bottom - 3],
      ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.moveTo(x - 2, y - 2);
        ctx.lineTo(x + hatchLen, y + hatchLen);
        ctx.stroke();
      });
      break;
    }

    case 'modern_tech': {
      // Tech targeting viewfinder & corner crosshairs
      const len = 16;
      ctx.lineWidth = 2.5;

      // 4 Targeting corner brackets
      // TL
      ctx.beginPath();
      ctx.moveTo(left, top + len);
      ctx.lineTo(left, top);
      ctx.lineTo(left + len, top);
      ctx.stroke();

      // TR
      ctx.beginPath();
      ctx.moveTo(right - len, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, top + len);
      ctx.stroke();

      // BR
      ctx.beginPath();
      ctx.moveTo(right, bottom - len);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right - len, bottom);
      ctx.stroke();

      // BL
      ctx.beginPath();
      ctx.moveTo(left + len, bottom);
      ctx.lineTo(left, bottom);
      ctx.lineTo(left, bottom - len);
      ctx.stroke();

      // Center crosshair ticks
      const tick = 6;
      const midX = totalSize / 2;
      const midY = totalSize / 2;

      ctx.lineWidth = 1.5;
      // Top tick
      ctx.beginPath();
      ctx.moveTo(midX, top - 2);
      ctx.lineTo(midX, top + tick);
      ctx.stroke();

      // Bottom tick
      ctx.beginPath();
      ctx.moveTo(midX, bottom - tick);
      ctx.lineTo(midX, bottom + 2);
      ctx.stroke();

      // Left tick
      ctx.beginPath();
      ctx.moveTo(left - 2, midY);
      ctx.lineTo(left + tick, midY);
      ctx.stroke();

      // Right tick
      ctx.beginPath();
      ctx.moveTo(right - tick, midY);
      ctx.lineTo(right + 2, midY);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * High-definition QR Code Renderer.
 * Eliminates pixelation by using high internal rendering resolution (subpixel / supersampling),
 * draws chosen ornamental edge embellishments, and renders stylized center sketches or icons.
 */
export async function renderStyledQrCode(
  canvas: HTMLCanvasElement,
  text: string,
  options?: {
    size?: number; // CSS display size (default 320)
    customSettings?: QrDesignSettings;
  }
): Promise<void> {
  const settings = options?.customSettings || getQrDesignSettings();
  const displaySize = options?.size || 320;

  // Ultra-crisp internal resolution (2x supersampling for high-DPI screens and print)
  const renderScale = 2;
  const canvasPixelSize = displaySize * renderScale;

  canvas.width = canvasPixelSize;
  canvas.height = canvasPixelSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fill background
  ctx.fillStyle = settings.lightColor || '#ffffff';
  ctx.fillRect(0, 0, canvasPixelSize, canvasPixelSize);

  // Border margin calculation: if an ornamental border is selected, leave room for it
  const hasBorder = settings.borderDecoration && settings.borderDecoration !== 'none';
  const borderPadding = hasBorder ? Math.round(canvasPixelSize * 0.08) : Math.round(canvasPixelSize * 0.03);

  const qrInnerSize = canvasPixelSize - borderPadding * 2;
  const qrInnerX = borderPadding;
  const qrInnerY = borderPadding;

  // Generate temporary offscreen QR code canvas
  const qrTempCanvas = document.createElement('canvas');
  qrTempCanvas.width = qrInnerSize;
  qrTempCanvas.height = qrInnerSize;

  const hasCenterBadge =
    settings.centerLogoType === 'preset_icon' ||
    settings.centerLogoType === 'sketch_drawing' ||
    (settings.centerLogoType === 'custom_image' && !!settings.customLogoDataUrl);

  const errorCorrectionLevel = hasCenterBadge ? 'H' : 'M';

  await new Promise<void>((resolve, reject) => {
    QRCode.toCanvas(
      qrTempCanvas,
      text,
      {
        width: qrInnerSize,
        margin: 1, // minimal margin so QR code fills inner frame nicely
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

  // Enable high-quality anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw QR code onto main canvas inside the border margin
  ctx.drawImage(qrTempCanvas, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);

  // Draw ornamental edge embellishments / border
  if (hasBorder) {
    drawOrnamentalBorder(
      ctx,
      settings.borderDecoration,
      canvasPixelSize,
      borderPadding,
      qrInnerSize,
      settings.darkColor || '#0f172a',
      settings.lightColor || '#ffffff'
    );
  }

  // Draw Center Badge & Sketch/Icon (if active)
  if (hasCenterBadge) {
    const centerSize = Math.round(canvasPixelSize * 0.23); // Optimal for Error Correction 'H'
    const centerX = (canvasPixelSize - centerSize) / 2;
    const centerY = (canvasPixelSize - centerSize) / 2;
    const radius = settings.badgeShape === 'circle' ? centerSize / 2 : centerSize * 0.22;

    ctx.save();

    // 1. Draw clean badge backdrop
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 10 * renderScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2 * renderScale;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (settings.badgeShape === 'circle') {
      ctx.arc(canvasPixelSize / 2, canvasPixelSize / 2, centerSize / 2 + 2 * renderScale, 0, Math.PI * 2);
    } else {
      ctx.roundRect(
        centerX - 2 * renderScale,
        centerY - 2 * renderScale,
        centerSize + 4 * renderScale,
        centerSize + 4 * renderScale,
        radius
      );
    }
    ctx.fill();

    // Reset drop shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Outer border ring in theme color
    ctx.strokeStyle = settings.darkColor || '#3730a3';
    ctx.lineWidth = 2.5 * renderScale;
    ctx.stroke();

    // 2. Render sketch drawing or custom logo
    if (
      (settings.centerLogoType === 'sketch_drawing' || settings.centerLogoType === 'custom_image') &&
      settings.customLogoDataUrl
    ) {
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
          ctx.arc(canvasPixelSize / 2, canvasPixelSize / 2, centerSize / 2 - 1 * renderScale, 0, Math.PI * 2);
        } else {
          ctx.roundRect(centerX, centerY, centerSize, centerSize, radius);
        }
        ctx.clip();

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw sketch image strictly preserving aspect ratio with customizable zoom (NO DISTORTION / KEINE VERZERRUNG)
        const fitMode = settings.logoFit || 'contain';
        const zoom = typeof settings.logoZoom === 'number' && settings.logoZoom > 0 ? settings.logoZoom : 1.0;
        const imgW = img.naturalWidth || img.width || 1;
        const imgH = img.naturalHeight || img.height || 1;
        const aspect = imgW / imgH;

        if (fitMode === 'cover') {
          // Cover mode: Fills the entire badge proportionally with centered crop, strictly undistorted + zoom
          const pad = centerSize * 0.02;
          const baseDestW = centerSize - pad * 2;
          const baseDestH = centerSize - pad * 2;
          const destW = baseDestW * zoom;
          const destH = baseDestH * zoom;
          const destX = (canvasPixelSize - destW) / 2;
          const destY = (canvasPixelSize - destH) / 2;

          let srcX = 0;
          let srcY = 0;
          let srcW = imgW;
          let srcH = imgH;

          if (aspect > 1) {
            // Source is wider than square: crop left and right equally
            srcW = imgH;
            srcX = (imgW - srcW) / 2;
          } else {
            // Source is taller than square: crop top and bottom equally
            srcH = imgW;
            srcY = (imgH - srcH) / 2;
          }

          ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
        } else {
          // Contain mode (default): Scales the entire drawing proportionally to fit inside badge, strictly undistorted + zoom
          const padRatio = settings.badgeShape === 'circle' ? 0.15 : 0.09;
          const maxW = centerSize * (1 - padRatio * 2);
          const maxH = centerSize * (1 - padRatio * 2);

          let drawW = maxW;
          let drawH = maxH;

          if (aspect > 1) {
            // Landscape: scale width to maxW, adjust height proportionally
            drawW = maxW;
            drawH = maxW / aspect;
          } else {
            // Portrait or square: scale height to maxH, adjust width proportionally
            drawH = maxH;
            drawW = maxH * aspect;
          }

          // Apply zoom factor smoothly
          drawW = drawW * zoom;
          drawH = drawH * zoom;

          const drawX = (canvasPixelSize - drawW) / 2;
          const drawY = (canvasPixelSize - drawH) / 2;

          ctx.drawImage(img, 0, 0, imgW, imgH, drawX, drawY, drawW, drawH);
        }


        ctx.restore();
      } catch (e) {
        console.warn('Could not draw sketch drawing on QR:', e);
      }
    } else if (settings.centerLogoType === 'preset_icon') {
      // High-resolution icon glyph
      ctx.fillStyle = settings.darkColor || '#3730a3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const iconType = settings.presetIcon || 'book';
      const bx = canvasPixelSize / 2;
      const by = canvasPixelSize / 2;

      if (iconType === 'book') {
        const s = centerSize * 0.52;
        ctx.font = `bold ${Math.round(s)}px sans-serif`;
        ctx.fillText('📖', bx, by + 1 * renderScale);
      } else if (iconType === 'math') {
        const s = centerSize * 0.52;
        ctx.font = `bold ${Math.round(s)}px "JetBrains Mono", sans-serif`;
        ctx.fillText('∑', bx, by);
      } else {
        const s = centerSize * 0.52;
        ctx.font = `bold ${Math.round(s)}px sans-serif`;
        ctx.fillText('🎓', bx, by + 1 * renderScale);
      }
    }

    ctx.restore();
  }
}
