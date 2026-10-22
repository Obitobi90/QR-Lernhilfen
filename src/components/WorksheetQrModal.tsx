import React, { useEffect, useRef, useState } from 'react';
import { Lernhilfe } from '../types';
import { renderStyledQrCode, getEffectiveQrDesign } from '../utils/qrCodeTheme';
import { LaTeXRenderer } from '../utils/latexRenderer';
import {
  shortenUrlsBatch,
  getCachedShortUrl,
  formatDisplayShortUrl,
} from '../utils/urlShortener';
import { buildStudentUrl, isLocalhost, getCustomBaseUrl } from '../utils/appUrl';
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
  Link2,
  RefreshCw,
  Smartphone,
  AlertTriangle,
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

  // Shortened URLs cache per task ID
  const [shortUrls, setShortUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      const studentUrl = buildStudentUrl(item.id);
      const cached = getCachedShortUrl(studentUrl);
      if (cached) initial[item.id] = cached;
    });
    return initial;
  });

  // Fetch short URLs for all items on sheet
  useEffect(() => {
    let isCancelled = false;
    const urlMap: Record<string, string> = {};
    const longUrls: string[] = [];

    items.forEach((item) => {
      const studentUrl = buildStudentUrl(item.id);
      urlMap[studentUrl] = item.id;
      longUrls.push(studentUrl);
    });

    shortenUrlsBatch(longUrls).then((results) => {
      if (isCancelled) return;
      const updated: Record<string, string> = {};
      Object.entries(results).forEach(([longUrl, short]) => {
        const itemId = urlMap[longUrl];
        if (itemId) {
          updated[itemId] = short;
        }
      });
      setShortUrls((prev) => ({ ...prev, ...updated }));
    }).catch((err) => {
      console.warn('Failed to load short URLs:', err);
    });

    return () => {
      isCancelled = true;
    };
  }, [items]);

  const renderAllQrs = () => {
    items.forEach((item) => {
      const canvas = canvasRefs.current[item.id];
      if (canvas) {
        const studentUrl = buildStudentUrl(item.id);
        renderStyledQrCode(canvas, studentUrl, {
          size: 240,
          customSettings: getEffectiveQrDesign(item),
        }).catch((error) => {
          if (error) console.error('QR code generation error:', error);
        });
      }
    });
  };

  useEffect(() => {
    renderAllQrs();

    const handleDesignChange = () => {
      renderAllQrs();
    };

    window.addEventListener('qr-design-changed', handleDesignChange);
    return () => {
      window.removeEventListener('qr-design-changed', handleDesignChange);
    };
  }, [items]);

  const handleCopyLink = async (item: Lernhilfe) => {
    const targetUrl = shortUrls[item.id] || buildStudentUrl(item.id);
    try {
      await navigator.clipboard.writeText(targetUrl);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs printable-modal-backdrop">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] printable-modal-dialog">
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
              Dieses Arbeitsblatt enthält <strong>{items.length} {items.length === 1 ? 'Aufgabe' : 'Aufgaben'}</strong> mit jeweils individuellen gestuften Tippkarten und <strong>gekürzten Direkt-URLs</strong>.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Tipp: Schüler ohne QR-Scanner tippen einfach den kurzen Link im Smartphone-Browser ein.
          </span>
        </div>

        {/* Smartphone localhost warning */}
        {isLocalhost() && !getCustomBaseUrl() && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Hinweis für Smartphone-Tests:</strong> Du bist über <code>localhost</code> verbunden. QR-Codes mit <code>localhost</code> führen auf Smartphones zu einer weißen Seite. Trage im Einzel-QR-Dialog deine WLAN-IP ein.
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Printable Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 printable-modal-body">
          {/* Print-only Header */}
          <div className="hidden print:block text-center pb-4 border-b border-slate-400 mb-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-600 font-extrabold mb-1">
              Digitale Tippkarten &amp; Hilfen zum Arbeitsblatt
            </div>
            <h1 className="text-2xl font-black text-black mb-1">{groupName}</h1>
            <p className="text-xs text-slate-700">
              {subject} {gradeLevel ? `· ${gradeLevel}` : ''} · Scanne den QR-Code mit der Smartphone-Kamera oder tippe die Direkt-URL im Browser ein.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-5">
            {items.map((item, idx) => {
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs print:border-2 print:border-slate-400 print:bg-white print:text-black print:shadow-none print:break-inside-avoid print:p-3.5 print-card"
                >
                  {/* Card Title & Meta */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 print:text-slate-700">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 print:text-black">
                          Aufgabe {idx + 1}
                        </span>
                        {item.qr_design && (
                          <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60 print:hidden">
                            Eigenes Design
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] print:text-slate-700">
                        <Layers className="w-3 h-3 text-slate-400 print:text-slate-700" />
                        <span>{item.hints.length} {item.hints.length === 1 ? 'Tipp' : 'Tipps'}</span>
                      </span>
                    </div>

                    {/* Full Title, never clamped */}
                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 print:text-black text-sm leading-snug break-words">
                      {item.title}
                    </h4>

                    {/* Written Task Context with Crisp Math Formula Rendering */}
                    {item.task_context && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 break-words leading-relaxed bg-slate-50/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 print:bg-slate-50 print:border print:border-slate-300 print:text-black print:p-2">
                        <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 mb-0.5">
                          Aufgabenstellung:
                        </div>
                        <div className="text-xs print:text-black">
                          <LaTeXRenderer content={item.task_context} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Canvas (Strict Square Aspect Ratio, Never Distorted) */}
                  <div className="my-3 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-100 dark:border-slate-800 print:border-none print:p-1">
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[item.id] = el;
                      }}
                      width={240}
                      height={240}
                      style={{ width: '150px', height: '150px', aspectRatio: '1 / 1', display: 'block' }}
                      className="rounded-lg mx-auto shrink-0 print:w-[130px] print:h-[130px]"
                    />

                    {/* Shortened Direct URL under the QR Code */}
                    <div className="mt-2 w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg print:border print:border-slate-400 print:bg-white print:p-1.5 text-center">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 print:text-slate-700 mb-0.5 flex items-center justify-center gap-1">
                        <Link2 className="w-2.5 h-2.5 text-indigo-500 print:hidden" />
                        <span>Direkt-URL zur Tippkarte:</span>
                      </div>
                      <div className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 print:text-[12px] print:text-black break-all select-all">
                        {shortUrls[item.id] ? (
                          <a
                            href={shortUrls[item.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-indigo-700 dark:text-indigo-300 print:text-black print:no-underline font-extrabold"
                            title="Tippkarten-Direktlink öffnen"
                          >
                            {formatDisplayShortUrl(shortUrls[item.id])}
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-normal italic text-[11px] flex items-center justify-center gap-1.5 py-0.5">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500 print:hidden" />
                            <span>URL wird gekürzt...</span>
                          </span>
                        )}
                      </div>
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
