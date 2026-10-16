import React, { useEffect, useRef, useState } from 'react';
import { Lernhilfe } from '../types';
import { renderStyledQrCode, getQrDesignSettings } from '../utils/qrCodeTheme';
import {
  X,
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Palette,
  Sparkles,
} from 'lucide-react';

interface QrCodeModalProps {
  item: Lernhilfe;
  allWorksheetItems?: Lernhilfe[];
  onOpenWorksheetQr?: (groupName: string, items: Lernhilfe[]) => void;
  onClose: () => void;
  onOpenPreview: (id: string) => void;
  onOpenSettings?: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  item,
  allWorksheetItems,
  onOpenWorksheetQr,
  onClose,
  onOpenPreview,
  onOpenSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Formulate student URL
  const studentUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(item.id)}`;

  const drawQr = () => {
    if (canvasRef.current) {
      renderStyledQrCode(canvasRef.current, studentUrl, { size: 300 }).catch((error) => {
        console.error('QR code generation error:', error);
      });
    }
  };

  useEffect(() => {
    drawQr();

    // Listen for live QR design changes from options modal
    const handleDesignChange = () => {
      drawQr();
    };

    window.addEventListener('qr-design-changed', handleDesignChange);
    return () => {
      window.removeEventListener('qr-design-changed', handleDesignChange);
    };
  }, [studentUrl]);

  // Download high-resolution PNG with header text banner and the styled QR code
  const handleDownloadPng = () => {
    if (!canvasRef.current) return;

    const qrDesign = getQrDesignSettings();

    // Create high-res canvas with title header for printing/downloading
    const printCanvas = document.createElement('canvas');
    const width = 640;
    const height = 800;
    printCanvas.width = width;
    printCanvas.height = height;

    const ctx = printCanvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Decorative border in the QR theme color
    ctx.strokeStyle = qrDesign.darkColor || '#3730a3';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // Header badge
    ctx.fillStyle = qrDesign.darkColor || '#3730a3';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIGITALE LERNHILFE · TIPP-KARTE', width / 2, 62);

    // Title (fully wrapped, never truncated)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';

    const titleWords = item.title.split(' ');
    let line = '';
    let y = 105;
    for (const word of titleWords) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > width - 80) {
        ctx.fillText(line, width / 2, y);
        line = word + ' ';
        y += 32;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, y);

    // Subject & Worksheet subtitle
    y += 26;
    ctx.fillStyle = '#64748b';
    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    const parts = [];
    if (item.group_name) parts.push(`Arbeitsblatt: ${item.group_name}`);
    if (item.subject) parts.push(`Fach: ${item.subject}`);
    if (item.grade_level) parts.push(item.grade_level);
    parts.push(`${item.hints.length} gestufte Tipps`);
    ctx.fillText(parts.join(' · '), width / 2, y);

    // Draw styled QR code exactly centered with square proportions (no distortion)
    const qrCanvas = canvasRef.current;
    const qrSize = 360;
    const qrX = (width - qrSize) / 2;
    const qrY = y + 25;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Prominent Lernhilfe-Code display below QR Code
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(`Lernhilfe-Code: ${item.id}`, width / 2, qrY + qrSize + 36);

    ctx.fillStyle = '#475569';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Mit Smartphone scannen oder Code im Schülerportal eingeben', width / 2, qrY + qrSize + 62);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(studentUrl, width / 2, qrY + qrSize + 84);

    // Trigger download
    const link = document.createElement('a');
    link.download = `Tippkarte_${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = printCanvas.toDataURL('image/png');
    link.click();
  };

  // Copy Lernhilfe Code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err) {
      console.error('Clipboard copy code failed:', err);
    }
  };

  // Copy QR Image to Clipboard
  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      });
    } catch (err) {
      console.error('Clipboard copy image failed:', err);
    }
  };

  // Copy Direct Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Clipboard copy link failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                QR-Code für Schüler
              </span>
              {item.group_name && (
                <span className="text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3 text-purple-500" />
                  <span className="break-words">{item.group_name}</span>
                </span>
              )}
            </div>
            {/* Title: Completely displayed, never truncated */}
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-snug break-words">
              {item.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 flex flex-col items-center text-center space-y-4 overflow-y-auto">
          {/* Worksheet Multi-QR Quick Banner */}
          {item.group_name && allWorksheetItems && allWorksheetItems.length > 1 && (
            <div className="w-full p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold block uppercase tracking-wider">
                    Arbeitsblatt · {allWorksheetItems.length} Aufgaben
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words block">
                    {item.group_name}
                  </span>
                </div>
              </div>
              {onOpenWorksheetQr && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWorksheetQr(item.group_name!, allWorksheetItems);
                  }}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <Printer className="w-3 h-3" />
                  <span>QR-Bogen</span>
                </button>
              )}
            </div>
          )}

          {/* Undistorted Square QR-Code Box */}
          <div className="w-full flex flex-col items-center justify-center">
            <div className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-sm inline-flex items-center justify-center shrink-0">
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                style={{
                  width: '240px',
                  height: '240px',
                  maxWidth: '100%',
                  aspectRatio: '1 / 1',
                  display: 'block',
                }}
                className="rounded-lg shrink-0"
              />
            </div>
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="mt-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 hover:underline"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>QR-Design &amp; Logo anpassen</span>
              </button>
            )}
          </div>

          {/* Prominent Lernhilfe-Code Display & Copy Box */}
          <div className="w-full p-3.5 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/90 dark:border-indigo-800/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-left">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                Lernhilfe-Code zum Eintippen:
              </span>
              <span className="font-mono font-extrabold text-base sm:text-lg text-indigo-950 dark:text-indigo-100 select-all block break-all leading-normal mt-0.5">
                {item.id}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Schüler ohne Kamera können diesen Code direkt im Schülerportal eingeben.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Lernhilfe-Code kopieren"
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 transition-colors shadow-2xs self-stretch sm:self-center"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Code kopieren</span>
                </>
              )}
            </button>
          </div>

          {/* Fully Visible Direct Alternative URL Link */}
          <div className="w-full p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-left space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Alternativer Direkt-Link für Schüler:</span>
              <span className="text-[10px] text-slate-400">anklicken oder kopieren</span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              <a
                href={studentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-400 font-mono break-all hover:underline select-all leading-relaxed block"
              >
                {studentUrl}
              </a>
            </div>
          </div>

          {/* Action Button Grid */}
          <div className="w-full grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleDownloadPng}
              className="px-3 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Als PNG laden</span>
            </button>

            <button
              onClick={handleCopyImage}
              className="px-3 py-2.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedImage ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Bild kopieren</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyLink}
              className="px-3 py-2.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Link kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Link kopieren</span>
                </>
              )}
            </button>

            <button
              onClick={() => onOpenPreview(item.id)}
              className="px-3 py-2.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Vorschau öffnen</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs shrink-0">
          <div className="flex items-center gap-1 text-slate-500">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>{item.hints.length} gestufte {item.hints.length === 1 ? 'Tipp' : 'Tipps'} hinterlegt</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
