import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Lernhilfe } from '../types';
import { X, Download, Copy, Check, Printer, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  item: Lernhilfe;
  onClose: () => void;
  onOpenPreview: (id: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ item, onClose, onOpenPreview }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Formulate student URL
  const studentUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(item.id)}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        studentUrl,
        {
          width: 320,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [studentUrl]);

  // Download high-resolution PNG with header text banner
  const handleDownloadPng = () => {
    if (!canvasRef.current) return;

    // Create higher-res canvas with title header for printing/downloading
    const printCanvas = document.createElement('canvas');
    const width = 600;
    const height = 750;
    printCanvas.width = width;
    printCanvas.height = height;

    const ctx = printCanvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Decorative border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Header badge
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIGITALE LERNHILFE / TIPP-KARTE', width / 2, 60);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';

    // Wrap title if long
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

    // Subject subtitle
    if (item.subject) {
      y += 24;
      ctx.fillStyle = '#64748b';
      ctx.font = '16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Fach: ${item.subject} · ${item.hints.length} gestufte Tipps`, width / 2, y);
    }

    // Draw QR code centered
    const qrCanvas = canvasRef.current;
    const qrSize = 360;
    const qrX = (width - qrSize) / 2;
    const qrY = y + 25;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Instructions footer
    ctx.fillStyle = '#475569';
    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Mit dem Smartphone oder Tablet scannen, um Tipps zu öffnen', width / 2, qrY + qrSize + 36);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(studentUrl, width / 2, qrY + qrSize + 60);

    // Trigger download
    const link = document.createElement('a');
    link.download = `Tippkarte_${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = printCanvas.toDataURL('image/png');
    link.click();
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              QR-Code für Schüler
            </span>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base line-clamp-1">
              {item.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full h-auto" />
          </div>

          <div className="space-y-1 max-w-sm">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Diesen Code auf das Arbeitsblatt drucken oder per Beamer an die Wand projizieren.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono break-all line-clamp-2">
              {studentUrl}
            </p>
          </div>

          {/* Action Button Grid */}
          <div className="w-full grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleDownloadPng}
              className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Als PNG laden</span>
            </button>

            <button
              onClick={handleCopyImage}
              className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
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
              className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
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
              className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Vorschau öffnen</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            {item.hints.length} gestufte {item.hints.length === 1 ? 'Tipp' : 'Tipps'} hinterlegt
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
