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
  X,
  QrCode,
  ThumbsUp,
  ThumbsDown,
  MessageSquarePlus,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  recordTaskView,
  recordHintView,
  voteHint,
  getLocalVote,
  fetchPupilSuggestion,
  submitPupilSuggestion,
} from '../utils/statsService';

interface StudentViewProps {
  item: Lernhilfe;
  isTeacherPreview?: boolean;
  onClosePreview?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  item,
  isTeacherPreview = false,
  onClosePreview,
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
  // PIN error indicators per hint
  const [pinErrors, setPinErrors] = useState<Record<string, boolean>>({});
  // User votes per hint (Thumbs up / Thumbs down)
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Pupil suggestions for additional/better hints
  const [showSuggestionForm, setShowSuggestionForm] = useState<boolean>(false);
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [suggestionSaved, setSuggestionSaved] = useState<boolean>(false);
  const [suggestionLoading, setSuggestionLoading] = useState<boolean>(false);
  const [existingSuggestion, setExistingSuggestion] = useState<{
    id: string;
    text: string;
  } | null>(null);

  // Reset states and record views if item changes
  useEffect(() => {
    setUnlockedCount(1);
    setOpenHints({ [item.hints[0]?.id || '']: true });
    setUnlockedPins({});
    setPinInputs({});
    setPinErrors({});

    // Load existing votes for each hint of this item
    const initialVotes: Record<string, 'up' | 'down'> = {};
    item.hints.forEach((h) => {
      const v = getLocalVote(item.id, h.id);
      if (v) initialVotes[h.id] = v;
    });
    setUserVotes(initialVotes);

    // Load existing suggestion for this pupil if any
    fetchPupilSuggestion(item.id).then((sug) => {
      if (sug) {
        setExistingSuggestion(sug);
        setSuggestionText(sug.text);
      } else {
        setExistingSuggestion(null);
        setSuggestionText('');
      }
    });

    // Record general task open view and hint 1 view (if real student access)
    if (!isTeacherPreview) {
      recordTaskView(item.id);
      if (item.hints[0]?.id) {
        recordHintView(item.id, item.hints[0].id);
      }
    }
  }, [item.id, isTeacherPreview]);

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

      // Record view for this newly revealed hint
      if (!isTeacherPreview) {
        recordHintView(item.id, nextHintId);
      }
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

  // Student voting handler (Thumbs up / down with toggle-off support)
  const handleVote = async (hintId: string, rating: 'up' | 'down') => {
    const currentVote = userVotes[hintId];

    if (currentVote === rating) {
      // Toggle off locally
      setUserVotes((prev) => {
        const copy = { ...prev };
        delete copy[hintId];
        return copy;
      });
    } else {
      setUserVotes((prev) => ({ ...prev, [hintId]: rating }));
    }

    const res = await voteHint(item.id, hintId, rating);
    if (res?.removed) {
      setUserVotes((prev) => {
        const copy = { ...prev };
        delete copy[hintId];
        return copy;
      });
    }
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;

    setSuggestionLoading(true);
    const res = await submitPupilSuggestion(item.id, suggestionText.trim());
    setSuggestionLoading(false);

    if (res.success) {
      setSuggestionSaved(true);
      setExistingSuggestion(res.suggestion || { id: 'temp', text: suggestionText.trim() });
      setTimeout(() => setSuggestionSaved(false), 3500);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-3 sm:py-6 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Navigation Bar / Mode Indicator */}
        <div className="flex items-center justify-between no-print gap-2 py-1">
          {isTeacherPreview && onClosePreview ? (
            <button
              onClick={onClosePreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>Vorschau schließen</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <QrCode className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                QR-Lernhilfe
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            {isTeacherPreview ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                Lehrer-Vorschau
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                Tippkarten
              </span>
            )}
          </div>
        </div>

        {/* Task Header Box */}
        <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
          {/* Title: Completely readable at a glance without truncation */}
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug break-words">
            {item.title}
          </h1>

          {item.task_context && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-sm text-slate-700 dark:text-slate-300">
              <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Aufgabenstellung:
              </span>
              <div className="leading-relaxed whitespace-pre-wrap">
                <LaTeXRenderer content={item.task_context} className="text-sm sm:text-base" />
              </div>
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
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 break-words leading-snug">
                        {(() => {
                          const raw = (hint.title || '').trim();
                          if (!raw) return `Tipp ${index + 1}`;
                          // Strip leading "Tipp X:" or "Tipp X." or "Tipp X"
                          const cleaned = raw.replace(new RegExp(`^Tipp\\s*${index + 1}[:.]?\\s*`, 'i'), '').trim();
                          if (!cleaned) return `Tipp ${index + 1}`;
                          return `Tipp ${index + 1}: ${cleaned}`;
                        })()}
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
                            <audio
                              controls
                              controlsList="nodownload"
                              onContextMenu={(e) => e.preventDefault()}
                              src={hint.mediaData}
                              className="w-full h-10"
                            />
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

                        {/* Unobtrusive Feedback Row (Thumbs up / Thumbs down) */}
                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-1 text-xs text-slate-400">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-1 select-none hidden xs:inline">
                            War dieser Tipp hilfreich?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleVote(hint.id, 'up')}
                            title="Tipp war hilfreich"
                            aria-label="Tipp war hilfreich"
                            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs transition-colors ${
                              userVotes[hint.id] === 'up'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-300 dark:ring-emerald-800'
                                : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${userVotes[hint.id] === 'up' ? 'fill-current' : ''}`} />
                            {userVotes[hint.id] === 'up' && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Hilfreich</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVote(hint.id, 'down')}
                            title="Tipp war nicht so hilfreich"
                            aria-label="Tipp war nicht so hilfreich"
                            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs transition-colors ${
                              userVotes[hint.id] === 'down'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold ring-1 ring-rose-300 dark:ring-rose-800'
                                : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <ThumbsDown className={`w-3.5 h-3.5 ${userVotes[hint.id] === 'down' ? 'fill-current' : ''}`} />
                            {userVotes[hint.id] === 'down' && (
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Nicht hilfreich</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Stepped Next Button (Progressive Disclosure) */}
          {unlockedCount < item.hints.length && (
            <div className="pt-3 text-center space-y-2.5">
              <button
                type="button"
                onClick={() => handleRevealNext(unlockedCount)}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-bold text-sm sm:text-base shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 min-h-[50px]"
              >
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span>Nächsten Tipp anzeigen</span>
              </button>

              {/* Title of next tip displayed on a separate line below the button */}
              {(() => {
                const rawNext = item.hints[unlockedCount]?.title || '';
                const cleanNextTitle = rawNext.replace(new RegExp(`^Tipp\\s*${unlockedCount + 1}[:.]?\\s*`, 'i'), '').trim();
                const displayNext = cleanNextTitle || rawNext || `Denkanstoß ${unlockedCount + 1}`;
                return (
                  <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 flex-wrap px-2">
                    <span className="text-slate-400 dark:text-slate-500">Titel von Tipp {unlockedCount + 1}:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 break-words">
                      {displayNext}
                    </span>
                  </div>
                );
              })()}

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                💡 Versuche erst mit den vorhandenen Tipps weiterzukommen, bevor du den nächsten öffnest.
              </p>
            </div>
          )}

          {/* All Hints Revealed Note */}
          {unlockedCount >= item.hints.length && item.hints.length > 0 && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Alle Denkanstöße wurden aufgedeckt</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Nutze diese Hilfen, um deine eigene Lösung aufzuschreiben und zu begründen.
                </p>
              </div>

              {/* Optional Pupil Suggestion for better/additional hints */}
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquarePlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-snug">
                        Fehlt dir noch ein Denkanstoß?
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Welcher zusätzliche oder bessere Tipp hätte dir geholfen, ohne sofort die Lösung zu verraten? (optional)
                      </p>
                    </div>
                  </div>

                  {!showSuggestionForm && !existingSuggestion && (
                    <button
                      type="button"
                      onClick={() => setShowSuggestionForm(true)}
                      className="self-start sm:self-auto px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                    >
                      Tipp vorschlagen
                    </button>
                  )}
                </div>

                {(showSuggestionForm || existingSuggestion) && (
                  <form onSubmit={handleSuggestionSubmit} className="space-y-2.5 pt-1">
                    <textarea
                      rows={3}
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder="z. B. 'Ein Tipp zur Umrechnung der Einheiten vor Anwendung der Formel wäre hilfreich gewesen...'"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 leading-relaxed resize-none"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {existingSuggestion
                          ? 'Du kannst deinen Vorschlag jederzeit hier bearbeiten.'
                          : 'Dein Vorschlag wird anonym an deine Lehrkraft übermittelt.'}
                      </span>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {suggestionSaved && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Gespeichert!</span>
                          </span>
                        )}
                        <button
                          type="submit"
                          disabled={suggestionLoading || !suggestionText.trim()}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          <span>
                            {suggestionLoading
                              ? 'Wird gesendet...'
                              : existingSuggestion
                              ? 'Vorschlag aktualisieren'
                              : 'Vorschlag abschicken'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
