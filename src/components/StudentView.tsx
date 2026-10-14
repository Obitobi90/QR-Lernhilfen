import React, { useState, useEffect } from 'react';
import { Lernhilfe, Hint } from '../types';
import { LaTeXRenderer } from '../utils/latexRenderer';
import { parseYouTubeUrl, parseGeoGebraUrl, parseH5PUrl } from '../utils/mediaParser';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Volume2,
  Image as ImageIcon,
  PlaySquare,
  AlertCircle,
  HelpCircle,
  Moon,
  Sun,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PWAInstallButton } from './PWAInstallButton';

interface StudentViewProps {
  item: Lernhilfe;
  onBackToTeacher?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  item,
  onBackToTeacher,
  darkMode,
  onToggleDarkMode,
}) => {
  // Revealed hints count. Initially, only Hint 1 is revealed/available.
  const [unlockedCount, setUnlockedCount] = useState<number>(1);
  // Track open/collapsed state of each revealed hint
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({
    [item.hints[0]?.id || '']: true,
  });
  // Track unlocked PINs
  const [unlockedPins, setUnlockedPins] = useState<Record<string, boolean>>({});
  // PIN input buffer per hint
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [pinErrors, setPinErrors] = useState<Record<string, boolean>>({});

  // Reset states if item changes
  useEffect(() => {
    setUnlockedCount(1);
    setOpenHints({ [item.hints[0]?.id || '']: true });
    setUnlockedPins({});
    setPinInputs({});
    setPinErrors({});
  }, [item.id]);

  const toggleHintOpen = (hintId: string) => {
    setOpenHints((prev) => ({
      ...prev,
      [hintId]: !prev[hintId],
    }));
  };

  const handleRevealNext = (indexToReveal: number) => {
    const nextCount = indexToReveal + 1;
    setUnlockedCount(nextCount);
    const nextHintId = item.hints[indexToReveal]?.id;
    if (nextHintId) {
      setOpenHints((prev) => ({
        ...prev,
        [nextHintId]: true,
      }));
    }

    // Gentle scroll to newly revealed hint
    setTimeout(() => {
      const el = document.getElementById(`hint-card-${indexToReveal}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);

    // If reaching the final hint, celebrate
    if (nextCount === item.hints.length) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    }
  };

  const handlePinSubmit = (hintId: string, expectedPin: string) => {
    const input = pinInputs[hintId] || '';
    if (input.trim() === expectedPin.trim()) {
      setUnlockedPins((prev) => ({ ...prev, [hintId]: true }));
      setPinErrors((prev) => ({ ...prev, [hintId]: false }));
      // Automatically expand once unlocked
      setOpenHints((prev) => ({ ...prev, [hintId]: true }));
    } else {
      setPinErrors((prev) => ({ ...prev, [hintId]: true }));
      setTimeout(() => {
        setPinErrors((prev) => ({ ...prev, [hintId]: false }));
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation Bar / Mode Indicator */}
        <div className="flex items-center justify-between no-print gap-2">
          {onBackToTeacher ? (
            <button
              onClick={onBackToTeacher}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Zurück zur Übersicht</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400">Digitale Lernhilfe</div>
          )}
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full whitespace-nowrap">
              Schüler-Ansicht
            </span>
          </div>
        </div>

        {/* Task Header Box */}
        <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {item.subject && <span>{item.subject}</span>}
            {item.subject && <span>·</span>}
            <span>{item.hints.length} gestufte {item.hints.length === 1 ? 'Tippkarte' : 'Tippkarten'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {item.title}
          </h1>

          {item.task_context && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider block mb-1">
                Aufgabenstellung:
              </span>
              <LaTeXRenderer content={item.task_context} className="text-base" />
            </div>
          )}

          {item.task_image && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <img
                src={item.task_image}
                alt="Aufgabenstellung Bild"
                className="max-h-72 w-full object-contain bg-slate-100 dark:bg-slate-950"
              />
            </div>
          )}
        </header>

        {/* Stepped Hints Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>Gestufte Hilfen &amp; Denkanstöße</span>
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {Math.min(unlockedCount, item.hints.length)} von {item.hints.length} sichtbar
            </span>
          </div>

          {item.hints.slice(0, unlockedCount).map((hint, index) => {
            const isOpen = !!openHints[hint.id];
            const hasPin = !!hint.pin && hint.pin.trim().length > 0;
            const isPinUnlocked = !hasPin || !!unlockedPins[hint.id];
            const isError = !!pinErrors[hint.id];

            return (
              <div
                key={hint.id || index}
                id={`hint-card-${index}`}
                className={`transition-all duration-300 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs overflow-hidden ${
                  isOpen
                    ? 'border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* Hint Header / Toggle Button */}
                <button
                  type="button"
                  onClick={() => toggleHintOpen(hint.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-3 focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {hint.title || `Tipp ${index + 1}`}
                      </h3>
                      {hasPin && !isPinUnlocked && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                          <Lock className="w-3 h-3" />
                          <span>PIN-Code erforderlich</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 shrink-0">
                    {hasPin && (
                      <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                        {isPinUnlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                        )}
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {/* Hint Content Area */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    {/* PIN Lock Barrier */}
                    {hasPin && !isPinUnlocked ? (
                      <div className="py-6 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                          <KeyRound className="w-6 h-6" />
                        </div>
                        <div className="max-w-xs space-y-1">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            Dieser Tipp ist gesperrt
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Gib den 4-stelligen Code ein (wurde von der Lehrkraft mitgeteilt oder errechnet):
                          </p>
                        </div>

                        {/* PIN Input Form */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={pinInputs[hint.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setPinInputs((prev) => ({ ...prev, [hint.id]: val }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handlePinSubmit(hint.id, hint.pin!);
                                }
                              }}
                              placeholder="••••"
                              className={`w-28 px-3 py-2 text-center text-lg font-mono tracking-widest bg-white dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 ${
                                isError
                                  ? 'border-red-500 text-red-600 ring-red-500 animate-shake'
                                  : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handlePinSubmit(hint.id, hint.pin!)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                            >
                              Freischalten
                            </button>
                          </div>
                          {isError && (
                            <span className="text-xs text-red-500 font-medium">
                              Falscher Code! Bitte noch einmal prüfen.
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Fully Visible Hint Body */
                      <div className="space-y-4 pt-2">
                        {/* LaTeX & Text content */}
                        {hint.text && (
                          <div className="text-slate-800 dark:text-slate-200 text-base leading-relaxed">
                            <LaTeXRenderer content={hint.text} />
                          </div>
                        )}

                        {/* Media Renderers */}
                        {hint.mediaType === 'image' && hint.mediaData && (
                          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                            <img
                              src={hint.mediaData}
                              alt={hint.title}
                              className="max-h-96 w-full object-contain mx-auto"
                            />
                          </div>
                        )}

                        {hint.mediaType === 'audio' && hint.mediaData && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col gap-2">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <Volume2 className="w-4 h-4 text-indigo-500" />
                              <span>Audio-Erklärung anhören</span>
                            </span>
                            <audio controls src={hint.mediaData} className="w-full h-10" />
                          </div>
                        )}

                        {hint.mediaType === 'youtube' && hint.mediaData && (
                          <div className="relative pt-[56.25%] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                            <iframe
                              src={parseYouTubeUrl(hint.mediaData) || hint.mediaData}
                              title="Erklärvideo"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full border-0"
                            />
                          </div>
                        )}

                        {hint.mediaType === 'geogebra' && hint.mediaData && (
                          <div className="relative h-[480px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-white">
                            <iframe
                              src={parseGeoGebraUrl(hint.mediaData) || hint.mediaData}
                              title="GeoGebra Interaktives Modell"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          </div>
                        )}

                        {hint.mediaType === 'h5p' && hint.mediaData && (
                          <div className="relative min-h-[400px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-white">
                            <iframe
                              src={parseH5PUrl(hint.mediaData) || hint.mediaData}
                              title="H5P Interaktive Übung"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Stepped Next Button (Progressive Disclosure) */}
          {unlockedCount < item.hints.length && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => handleRevealNext(unlockedCount)}
                className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 rounded-2xl text-indigo-600 dark:text-indigo-400 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 group"
              >
                <Sparkles className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span>
                  Nächsten Tipp anzeigen ({item.hints[unlockedCount]?.title || `Tipp ${unlockedCount + 1}`})
                </span>
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Versuche erst mit den aktuellen Tipps weiterzukommen, bevor du den nächsten öffnest.
              </p>
            </div>
          )}

          {/* All Hints Revealed Note */}
          {unlockedCount >= item.hints.length && item.hints.length > 0 && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Alle Denkanstöße wurden aufgedeckt</span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Nutze diese Hilfen, um deine eigene Lösung aufzuschreiben und zu begründen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
