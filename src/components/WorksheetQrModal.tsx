import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Lernhilfe } from '../types';
import {
  X,
  Printer,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface WorksheetQrModalProps {
  groupName: string;
  items: Lernhilfe[];
  onClose: () => void;
  onOpenPreview: (id: string) => void;
}

export const WorksheetQrModal: React.FC<WorksheetQrModalProps> = ({
  groupName,
  items,
  onClose,
  onOpenPreview,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedImgId, setCopiedImgId] = useState<string | null>(null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    items.forEach((item) => {
      const canvas = canvasRefs.current[item.id];
      if (canvas) {
        const studentUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(item.id)}`;
        QRCode.toCanvas(
          canvas,
          studentUrl,
          {
            width: 220,
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
    });
  }, [items]);

  const handleCopyLink = async (item: Lernhilfe) => {
    const studentUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(item.id)}`;
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyImage = async (item: Lernhilfe) => {
    const canvas = canvasRefs.current[item.id];
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedImgId(item.id);
        setTimeout(() => setCopiedImgId(null), 2000);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Find dominant subject & grade level
  const subject = items[0]?.subject || 'Allgemein';
  const gradeLevel = items.find((i) => i.grade_level)?.grade_level;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  Arbeitsblatt-QR-Bogen
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {subject} {gradeLevel ? `(${gradeLevel})` : ''}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg truncate">
                {groupName}
              </h3>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>QR-Bogen drucken</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Dieses Arbeitsblatt enthält <strong>{items.length} {items.length === 1 ? 'Aufgabe' : 'Aufgaben'}</strong> mit jeweils individuellen gestuften Tippkarten.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Tipp: Perfekt zum Ausschneiden oder direkten Einfügen in dein Arbeitsblatt.
          </span>
        </div>

        {/* Scrollable Printable Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Print-only Header */}
          <div className="hidden print:block text-center pb-4 border-b border-slate-300">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
              Digitale Tippkarten &amp; Hilfen zum Arbeitsblatt
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-1">{groupName}</h1>
            <p className="text-xs text-slate-600">
              {subject} {gradeLevel ? `· ${gradeLevel}` : ''} · Scanne den QR-Code mit der Smartphone-Kamera für gestufte Denkanstöße.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
            {items.map((item, idx) => {
              const studentUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(item.id)}`;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs print:border-slate-300 print:shadow-none print:break-inside-avoid"
                >
                  {/* Card Title & Meta */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        Teilaufgabe {idx + 1}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Layers className="w-3 h-3 text-slate-400" />
                        <span>{item.hints.length} {item.hints.length === 1 ? 'Tipp' : 'Tipps'}</span>
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                      {item.title}
                    </h4>

                    {item.task_context && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 print:line-clamp-none italic">
                        {item.task_context.slice(0, 100)}...
                      </p>
                    )}
                  </div>

                  {/* QR Canvas */}
                  <div className="my-3 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-100 dark:border-slate-800 print:border-none">
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[item.id] = el;
                      }}
                      className="w-40 h-40 object-contain mx-auto"
                    />
                    <div className="mt-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 print:text-[10px] print:border-slate-300">
                      Code: {item.id}
                    </div>
                  </div>

                  {/* Controls / Footer */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 no-print">
                    <button
                      type="button"
                      onClick={() => handleCopyImage(item)}
                      title="QR-Bild in Zwischenablage kopieren"
                      className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      {copiedImgId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Kopiert!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Bild kopieren</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item)}
                        title="Link kopieren"
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPreview(item.id)}
                        title="Schüler-Vorschau öffnen"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 no-print">
          <span>{items.length} QR-Codes auf diesem Bogen</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
