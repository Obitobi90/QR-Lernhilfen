import React, { useEffect, useRef, useState } from 'react';
import { Lernhilfe, QrDesignSettings } from '../types';
import {
  renderStyledQrCode,
  getEffectiveQrDesign,
  getWorksheetQrDesign,
  saveWorksheetQrDesign,
} from '../utils/qrCodeTheme';
import { LaTeXRenderer } from '../utils/latexRenderer';
import {
  shortenUrl,
  shortenUrlsBatch,
  getCachedShortUrl,
  formatDisplayShortUrl,
} from '../utils/urlShortener';
import {
  buildStudentUrl,
  buildWorksheetStudentUrl,
  isLocalhost,
  getCustomBaseUrl,
} from '../utils/appUrl';
import {
  sortWorksheetItems,
  saveWorksheetOrder,
  naturalTitleCompare,
} from '../utils/worksheetOrder';
import { QrCodeDesigner } from './QrCodeDesigner';
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
  QrCode,
  Palette,
  Eye,
  Sliders,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Loader2,
} from 'lucide-react';

interface WorksheetQrModalProps {
  groupName: string;
  items: Lernhilfe[];
  onClose: () => void;
  onOpenPreview: (id: string) => void;
  onOpenWorksheetPortal?: (groupName: string) => void;
}

export const WorksheetQrModal: React.FC<WorksheetQrModalProps> = ({
  groupName,
  items,
  onClose,
  onOpenPreview,
  onOpenWorksheetPortal,
}) => {
  // Mode: 'master' (1 Master QR-Code), 'individual' (Ein eigener QR-Code je Aufgabe), or 'order' (Reihenfolge anpassen)
  const [activeTab, setActiveTab] = useState<'master' | 'individual' | 'order'>('master');

  // Sorted items according to teacher order
  const [orderedItems, setOrderedItems] = useState<Lernhilfe[]>(() =>
    sortWorksheetItems(groupName, items)
  );

  useEffect(() => {
    setOrderedItems(sortWorksheetItems(groupName, items));
  }, [items, groupName]);

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedItems.length) return;
    const copy = [...orderedItems];
    const [removed] = copy.splice(index, 1);
    copy.splice(newIndex, 0, removed);
    setOrderedItems(copy);
    saveWorksheetOrder(groupName, copy.map((i) => i.id));
  };

  const handleResetToNaturalOrder = () => {
    const copy = [...orderedItems].sort(naturalTitleCompare);
    setOrderedItems(copy);
    saveWorksheetOrder(groupName, copy.map((i) => i.id));
  };

  // Master QR Design state & customizer toggle
  const [masterDesign, setMasterDesign] = useState<QrDesignSettings>(() =>
    getWorksheetQrDesign(groupName)
  );
  const [isCustomizingMaster, setIsCustomizingMaster] = useState<boolean>(false);

  // Master Canvas Ref
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [masterShortUrl, setMasterShortUrl] = useState<string>('');
  const [copiedMasterLink, setCopiedMasterLink] = useState<boolean>(false);
  const [copiedMasterImg, setCopiedMasterImg] = useState<boolean>(false);

  // Individual task canvases and short URLs
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedImgId, setCopiedImgId] = useState<string | null>(null);
  const individualCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  // High-contrast, ink-saving QR data URLs generated for clean printing & PDF export
  const [masterQrDataUrl, setMasterQrDataUrl] = useState<string>('');
  const [individualQrDataUrls, setIndividualQrDataUrls] = useState<Record<string, string>>({});
  const [isPreparingPrint, setIsPreparingPrint] = useState<boolean>(false);

  const [individualShortUrls, setIndividualShortUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      const studentUrl = buildStudentUrl(item.id);
      const cached = getCachedShortUrl(studentUrl);
      if (cached) initial[item.id] = cached;
    });
    return initial;
  });

  const masterLongUrl = buildWorksheetStudentUrl(groupName);

  // 1. Fetch Master Short URL
  useEffect(() => {
    const cached = getCachedShortUrl(masterLongUrl);
    if (cached) {
      setMasterShortUrl(cached);
    } else {
      shortenUrl(masterLongUrl).then((short: string) => {
        if (short) setMasterShortUrl(short);
      });
    }
  }, [masterLongUrl]);

  // 2. Fetch short URLs for all individual items
  useEffect(() => {
    let isCancelled = false;
    const urlMap: Record<string, string> = {};
    const longUrls: string[] = [];

    items.forEach((item) => {
      const studentUrl = buildStudentUrl(item.id);
      urlMap[studentUrl] = item.id;
      longUrls.push(studentUrl);
    });

    shortenUrlsBatch(longUrls)
      .then((results) => {
        if (isCancelled) return;
        const updated: Record<string, string> = {};
        Object.entries(results).forEach(([longUrl, short]) => {
          const itemId = urlMap[longUrl];
          if (itemId) {
            updated[itemId] = short;
          }
        });
        setIndividualShortUrls((prev) => ({ ...prev, ...updated }));
      })
      .catch((err) => {
        console.warn('Failed to load short URLs:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [items]);

  // 3. Render Master QR Code
  const renderMasterQr = () => {
    if (masterCanvasRef.current) {
      renderStyledQrCode(masterCanvasRef.current, masterLongUrl, {
        size: 320,
        customSettings: masterDesign,
      }).catch((err) => {
        console.error('Master QR generation error:', err);
      });
    }
  };

  // 4. Render Individual QR Codes
  const renderAllIndividualQrs = () => {
    items.forEach((item) => {
      const canvas = individualCanvasRefs.current[item.id];
      if (canvas) {
        const studentUrl = buildStudentUrl(item.id);
        renderStyledQrCode(canvas, studentUrl, {
          size: 240,
          customSettings: getEffectiveQrDesign(item),
        }).catch((error) => {
          if (error) console.error('Individual QR generation error:', error);
        });
      }
    });
  };

  useEffect(() => {
    if (activeTab === 'master') {
      renderMasterQr();
    } else {
      renderAllIndividualQrs();
    }
  }, [activeTab, masterDesign, groupName, items]);

  useEffect(() => {
    const handleDesignChange = () => {
      if (activeTab === 'master') {
        renderMasterQr();
      } else {
        renderAllIndividualQrs();
      }
    };

    window.addEventListener('qr-design-changed', handleDesignChange);
    return () => {
      window.removeEventListener('qr-design-changed', handleDesignChange);
    };
  }, [activeTab, masterDesign, items]);

  // Master Actions
  const handleCopyMasterLink = async () => {
    const target = masterShortUrl || masterLongUrl;
    try {
      await navigator.clipboard.writeText(target);
      setCopiedMasterLink(true);
      setTimeout(() => setCopiedMasterLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyMasterImage = async () => {
    if (!masterCanvasRef.current) return;
    try {
      masterCanvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedMasterImg(true);
        setTimeout(() => setCopiedMasterImg(false), 2000);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadMasterImage = () => {
    if (!masterCanvasRef.current) return;
    const url = masterCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Master-QR-Code_${groupName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    a.click();
  };

  const handleUpdateMasterDesign = (updated: QrDesignSettings) => {
    setMasterDesign(updated);
    saveWorksheetQrDesign(groupName, updated);
  };

  // Individual Actions
  const handleCopyIndividualLink = async (item: Lernhilfe) => {
    const targetUrl = individualShortUrls[item.id] || buildStudentUrl(item.id);
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyIndividualImage = async (item: Lernhilfe) => {
    const canvas = individualCanvasRefs.current[item.id];
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImgId(item.id);
        setTimeout(() => setCopiedImgId(null), 2000);
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Generate high-resolution, ink-saving QR images for the clean print handout
  const generateAllQrDataUrls = async () => {
    try {
      // 1. Master QR (Crisp black on white for ink-saving print)
      const masterCanvas = document.createElement('canvas');
      await renderStyledQrCode(masterCanvas, masterLongUrl, {
        size: 320,
        customSettings: {
          ...masterDesign,
          darkColor: '#000000',
          lightColor: '#ffffff',
        },
      });
      setMasterQrDataUrl(masterCanvas.toDataURL('image/png'));

      // 2. Individual task QRs
      const results: Record<string, string> = {};
      for (const item of orderedItems) {
        const itemCanvas = document.createElement('canvas');
        const studentUrl = buildStudentUrl(item.id);
        await renderStyledQrCode(itemCanvas, studentUrl, {
          size: 240,
          customSettings: {
            ...getEffectiveQrDesign(item),
            darkColor: '#000000',
            lightColor: '#ffffff',
          },
        });
        results[item.id] = itemCanvas.toDataURL('image/png');
      }
      setIndividualQrDataUrls(results);
    } catch (err) {
      console.warn('Failed to pre-render printable QR codes:', err);
    }
  };

  useEffect(() => {
    generateAllQrDataUrls();
  }, [orderedItems, masterLongUrl, masterDesign]);

  const handlePrint = async () => {
    setIsPreparingPrint(true);
    await generateAllQrDataUrls();
    setIsPreparingPrint(false);
    setTimeout(() => {
      window.print();
    }, 120);
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
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  Arbeitsblatt-QR
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
              disabled={isPreparingPrint}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isPreparingPrint ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Druck vorbereiten...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Drucken / PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Master vs Individual vs Order) - Optimized for Smartphone touch */}
        <div className="p-2 sm:px-5 sm:pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 no-print">
          <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:gap-2 max-w-lg mx-auto sm:max-w-none sm:mx-0 bg-slate-200/60 dark:bg-slate-900 p-1 sm:p-0 rounded-xl sm:bg-transparent sm:dark:bg-transparent">
            {/* Tab 1: Master-QR */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('master');
                setIsCustomizingMaster(false);
              }}
              className={`py-2 px-2 sm:px-4 text-xs font-bold rounded-lg sm:rounded-t-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'master'
                  ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-sm sm:shadow-2xs sm:border-b-2 sm:border-purple-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate">Master-QR</span>
              <span className="hidden md:inline-block px-1.5 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded text-[10px] font-extrabold uppercase shrink-0">
                1 Code
              </span>
            </button>

            {/* Tab 2: Einzel-Codes */}
            <button
              type="button"
              onClick={() => setActiveTab('individual')}
              className={`py-2 px-2 sm:px-4 text-xs font-bold rounded-lg sm:rounded-t-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'individual'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm sm:shadow-2xs sm:border-b-2 sm:border-indigo-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Einzel-Codes</span>
              <span className="hidden md:inline-block px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold shrink-0">
                {orderedItems.length}
              </span>
            </button>

            {/* Tab 3: Reihenfolge */}
            <button
              type="button"
              onClick={() => setActiveTab('order')}
              className={`py-2 px-2 sm:px-4 text-xs font-bold rounded-lg sm:rounded-t-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'order'
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm sm:shadow-2xs sm:border-b-2 sm:border-emerald-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Reihenfolge</span>
            </button>
          </div>
        </div>

        {/* Smartphone localhost warning */}
        {isLocalhost() && !getCustomBaseUrl() && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Hinweis:</strong> Du bist über <code>localhost</code> verbunden. QR-Codes mit <code>localhost</code> funktionieren nur auf diesem Rechner.
              </span>
            </div>
          </div>
        )}

        {/* Modal Scrollable Content - Screen Only (Hidden during print) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 printable-modal-body flex-1 no-print">
          {activeTab === 'master' ? (
            /* ======================================================== */
            /* TAB 1: MASTER QR-CODE FOR THE ENTIRE WORKSHEET           */
            /* ======================================================== */
            <div className="space-y-6">
              {/* Teacher Guidance Card */}
              <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-purple-900 dark:text-purple-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Ein einziger Master-QR-Code für alle {items.length} Teilaufgaben</span>
                  </h4>
                  <p className="text-xs text-purple-800/80 dark:text-purple-300/80 leading-relaxed max-w-xl">
                    Drucke diesen einen QR-Code auf dein Arbeitsblatt. Scannt ein Schüler den Code, landet er auf der digitalen Arbeitsblatt-Übersicht und wählt bequem aus, zu welcher Aufgabe er gestufte Hilfen benötigt.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCustomizingMaster(!isCustomizingMaster)}
                    className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>{isCustomizingMaster ? 'Designer schließen' : 'Master-Code gestalten'}</span>
                  </button>

                  {onOpenWorksheetPortal && (
                    <button
                      type="button"
                      onClick={() => onOpenWorksheetPortal(groupName)}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Schüler-Menü testen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Master QR Designer Drawer */}
              {isCustomizingMaster && (
                <div className="p-4 bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-700 rounded-2xl space-y-3 no-print animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Design für den Master-QR-Code anpassen
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomizingMaster(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Fertig
                    </button>
                  </div>

                  <QrCodeDesigner
                    settings={masterDesign}
                    onChange={handleUpdateMasterDesign}
                    demoUrl={masterLongUrl}
                    isIndividual={false}
                  />
                </div>
              )}

              {/* Main Master QR Presentation Box */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-center gap-8 shadow-sm print:border-none print:shadow-none print:p-0">
                {/* Left: QR Canvas */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center print:border-none print:shadow-none">
                    <canvas
                      ref={masterCanvasRef}
                      width={320}
                      height={320}
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain max-w-full"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 no-print">
                    Hochauflösend (320px) · Für gestochen scharfen Druck
                  </span>
                </div>

                {/* Right: Info, Links, and Quick Copy Actions */}
                <div className="space-y-4 max-w-md w-full">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Sammel-Code für das Arbeitsblatt
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                      {groupName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {subject} {gradeLevel ? `· ${gradeLevel}` : ''} · Umfasst alle {items.length} Teilaufgaben
                    </p>
                  </div>

                  {/* Short Link Display */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Kurz-Link für Schüler:</span>
                      </span>
                      {copiedMasterLink && (
                        <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Kopiert!</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={masterShortUrl ? formatDisplayShortUrl(masterShortUrl) : masterLongUrl}
                        className="flex-1 px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyMasterLink}
                        title="Link in Zwischenablage kopieren"
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Export Actions for Worksheet Creation */}
                  <div className="space-y-2 pt-1 no-print">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      In Word, LibreOffice oder Pages einfügen:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Button 1: Copy Image Directly */}
                      <button
                        type="button"
                        onClick={handleCopyMasterImage}
                        className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2"
                      >
                        {copiedMasterImg ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-300" />
                            <span>QR-Bild kopiert!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>QR-Bild kopieren (Strg+V)</span>
                          </>
                        )}
                      </button>

                      {/* Button 2: Download PNG */}
                      <button
                        type="button"
                        onClick={handleDownloadMasterImage}
                        className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>PNG herunterladen</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks Included Overview in this Master Sheet */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                    <span>Im Master-QR-Code enthaltene Aufgaben ({orderedItems.length}):</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('order')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Reihenfolge anpassen</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {orderedItems.map((it, idx) => (
                    <div
                      key={it.id}
                      className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {idx + 1}. {it.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {it.hints.length} {it.hints.length === 1 ? 'Tipp' : 'Tipps'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPreview(it.id)}
                        title="Vorschau dieser Aufgabe ansehen"
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                      >
                        Vorschau
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'individual' ? (
            /* ======================================================== */
            /* TAB 2: INDIVIDUAL QR-CODES PER TASK                      */
            /* ======================================================== */
            <div className="space-y-6">
              {/* Print-only Header */}
              <div className="hidden print:block text-center pb-4 border-b border-slate-400 mb-4">
                <div className="text-[11px] uppercase tracking-wider text-slate-600 font-extrabold mb-1">
                  Digitale Tippkarten &amp; Hilfen zum Arbeitsblatt
                </div>
                <h1 className="text-2xl font-black text-black mb-1">{groupName}</h1>
                <p className="text-xs text-slate-700">
                  {subject} {gradeLevel ? `· ${gradeLevel}` : ''} · Scanne den QR-Code der jeweiligen Aufgabe mit der Smartphone-Kamera.
                </p>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-5">
                {orderedItems.map((item, idx) => {
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
                                Eigener Style
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold print:text-black">
                            {item.hints.length} {item.hints.length === 1 ? 'Tipp' : 'Tipps'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-snug print:text-black print:text-sm">
                          {item.title}
                        </h4>

                        {item.task_context && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-normal print:hidden">
                            <LaTeXRenderer content={item.task_context} glossary={item.glossary} className="text-[11px]" />
                          </div>
                        )}
                      </div>

                      {/* QR Code Canvas */}
                      <div className="my-3 flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 print:border-none print:bg-white print:p-0">
                        <canvas
                          ref={(el) => {
                            individualCanvasRefs.current[item.id] = el;
                          }}
                          width={240}
                          height={240}
                          className="w-40 h-40 object-contain print:w-44 print:h-44"
                        />

                        {/* Short URL print display */}
                        <div className="mt-1 text-center font-mono font-bold text-[10px] text-slate-600 dark:text-slate-400 print:text-black print:text-[11px]">
                          {individualShortUrls[item.id]
                            ? formatDisplayShortUrl(individualShortUrls[item.id])
                            : buildStudentUrl(item.id)}
                        </div>
                      </div>

                      {/* Card Action Buttons (No-print) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyIndividualImage(item)}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] rounded-lg border border-indigo-200 dark:border-indigo-800/80 transition flex items-center justify-center gap-1 shadow-2xs"
                          >
                            {copiedImgId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Kopiert!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Bild</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyIndividualLink(item)}
                            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-lg transition flex items-center justify-center gap-1"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Kopiert!</span>
                              </>
                            ) : (
                              <>
                                <Link2 className="w-3 h-3" />
                                <span>Link</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenPreview(item.id)}
                            title="Schüleransicht öffnen"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
          ) : (
            /* ======================================================== */
            /* TAB 3: TASK ORDERING & SEQUENCE                          */
            /* ======================================================== */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                    <span>Reihenfolge der Lernhilfen festlegen</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bestimme hier, in welcher Reihenfolge die Aufgaben den Schülern nach dem Scannen des Master-QR-Codes angezeigt werden.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetToNaturalOrder}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
                  title="Nach Aufgabennummern sortieren (Aufgabe 1, 2, 3...)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nach Nummern sortieren (1, 2, 3...)</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {orderedItems.map((item, index) => {
                  const hintCount = item.hints.length;
                  const hasPin = item.hints.some((h) => !!h.pin && h.pin.trim().length > 0);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                          {index + 1}.
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {item.title}
                            </h5>
                            {hasPin && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800/60">
                                <Lock className="w-2.5 h-2.5" />
                                <span>PIN</span>
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              · {hintCount} {hintCount === 1 ? 'Tipp' : 'Tipps'}
                            </span>
                          </div>
                          {item.task_context && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-lg mt-0.5">
                              {item.task_context}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0}
                          title="Nach oben verschieben"
                          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, 'down')}
                          disabled={index === orderedItems.length - 1}
                          title="Nach unten verschieben"
                          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Jede Änderung wird automatisch gespeichert und ist sofort im Master-QR-Code und im Schüler-Portal aktiv.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* DEDICATED INK-SAVING STUDENT HANDOUT SHEET (PRINT & PDF EXPORT ONLY)      */}
        {/* ========================================================================= */}
        <div className="print-only hidden print:block w-full p-2 text-black bg-white">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase mb-1 text-slate-800">
              <span>Digitale Lernhilfen · Arbeitsblatt-Begleitbogen</span>
              <span>
                {subject} {gradeLevel ? `· Klasse: ${gradeLevel}` : ''}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="text-xl font-extrabold text-black tracking-tight">
                {groupName}
              </h1>
              <div className="text-[11px] text-slate-700 font-medium whitespace-nowrap">
                Name: __________________________ Datum: _________
              </div>
            </div>
            <p className="text-[10.5px] text-slate-800 mt-1 leading-snug">
              <strong>Hinweis für Schüler:innen:</strong> Scanne den QR-Code mit der Smartphone-Kamera ab, um gestufte Hilfestellungen zu erhalten. Versuche die Aufgaben zuerst selbstständig – nutze die Tipps Schritt für Schritt nur bei Bedarf!
            </p>
          </div>

          {/* Master QR Section Card */}
          <div className="border-2 border-slate-900 rounded-xl p-3 mb-4 flex items-center gap-4 break-inside-avoid bg-white">
            {masterQrDataUrl ? (
              <img
                src={masterQrDataUrl}
                alt="Master-QR-Code"
                className="w-24 h-24 object-contain shrink-0 border border-slate-300 rounded p-1 bg-white"
              />
            ) : (
              <div className="w-24 h-24 border border-slate-300 rounded flex items-center justify-center text-xs text-slate-500 shrink-0">
                QR-Code
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="inline-block px-1.5 py-0.5 border border-slate-800 rounded text-[9.5px] font-extrabold uppercase tracking-wide mb-1">
                Master-QR-Code · Alle {orderedItems.length} Aufgaben
              </div>
              <h2 className="text-sm font-bold text-black leading-snug">
                Gesamtes Arbeitsblatt aufrufen
              </h2>
              <p className="text-[10.5px] text-slate-700 mt-0.5 leading-tight">
                Dieser zentrale Code führt dich zur digitalen Übersicht aller {orderedItems.length} Teilaufgaben. Dort kannst du auf dem Smartphone direkt die Aufgabe auswählen, zu der du Hilfe benötigst.
              </p>
              <div className="mt-1.5 text-[10px] text-slate-900 font-mono font-semibold flex items-center gap-1">
                <span>Direktlink:</span>
                <span className="underline">{formatDisplayShortUrl(masterShortUrl || masterLongUrl)}</span>
              </div>
            </div>
          </div>

          {/* Subtitle for individual tasks */}
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-400">
            <h3 className="text-[11px] font-extrabold text-black uppercase tracking-wider">
              Direkte QR-Codes für jede Teilaufgabe ({orderedItems.length} Aufgaben)
            </h3>
            <span className="text-[10px] text-slate-600">
              Geordnet nach Arbeitsblatt-Reihenfolge
            </span>
          </div>

          {/* Grid of Task QR Codes */}
          <div className="grid grid-cols-2 gap-2.5">
            {orderedItems.map((item, idx) => {
              const qrUrl = individualQrDataUrls[item.id];
              const directUrl = individualShortUrls[item.id] || buildStudentUrl(item.id);
              const hintCount = item.hints.length;
              const hasPin = item.hints.some((h) => !!h.pin && h.pin.trim().length > 0);

              return (
                <div
                  key={item.id}
                  className="print-card border border-slate-800 rounded-lg p-2 flex items-start gap-2.5 break-inside-avoid bg-white"
                >
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt={`QR-Code ${item.title}`}
                      className="w-20 h-20 object-contain shrink-0 border border-slate-300 rounded p-0.5 bg-white"
                    />
                  ) : (
                    <div className="w-20 h-20 border border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                      QR
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[11px] font-extrabold text-black">
                        {idx + 1}.
                      </span>
                      <h4 className="text-xs font-bold text-black truncate leading-tight">
                        {item.title}
                      </h4>
                    </div>

                    {item.task_context && (
                      <p className="text-[9.5px] text-slate-700 line-clamp-2 mt-0.5 leading-snug">
                        {item.task_context}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-700 font-medium">
                      <span>{hintCount} {hintCount === 1 ? 'gestufter Tipp' : 'gestufte Tipps'}</span>
                      {hasPin && (
                        <span className="font-bold border border-slate-700 px-1 rounded text-[8px]">
                          PIN-Code
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-[8.5px] text-slate-800 font-mono truncate">
                      {formatDisplayShortUrl(directUrl)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer in printout */}
          <div className="mt-3 pt-2 border-t border-slate-300 text-center text-[8.5px] text-slate-600">
            Digitale Lernhilfen · Gestufte Hilfestellungen &amp; differenzierte Tippkarten für den Unterricht
          </div>
        </div>
      </div>
    </div>
  );
};
