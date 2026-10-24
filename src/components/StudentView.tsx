import React, { useState, useEffect } from 'react';
import { Lernhilfe, Hint } from '../types';
import { LaTeXRenderer } from '../utils/latexRenderer';
import { parseYouTubeUrl, parseGeoGebraUrl, parseH5PUrl, getGeoGebraDimensions } from '../utils/mediaParser';
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
  Columns2,
  Square,
  Maximize2,
  ChevronsUpDown,
  RotateCcw,
  Sparkle,
  ExternalLink,
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
  fromWorksheet?: string;
  onBackToWorksheet?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  item,
  isTeacherPreview = false,
  onClosePreview,
  darkMode,
  onToggleDarkMode,
  fromWorksheet,
  onBackToWorksheet,
}) => {
  // Revealed hints count.
  // If item.disclosure_mode === 'all_visible', all hints are directly visible (collapsed).
  // Otherwise, stepped progressive disclosure starting at 1.
  const isAllVisible = item.disclosure_mode === 'all_visible';
  const [unlockedCount, setUnlockedCount] = useState<number>(() =>
    item.disclosure_mode === 'all_visible' ? item.hints.length : 1
  );

  // Track open/collapsed state of each revealed hint.
  // Initially, all hints (including Tipp 1) start COLLAPSED as requested.
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});

  // Track unlocked PINs
  const [unlockedPins, setUnlockedPins] = useState<Record<string, boolean>>({});
  // PIN input buffer per hint
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  // PIN error indicators per hint
  const [pinErrors, setPinErrors] = useState<Record<string, boolean>>({});
  // User votes per hint (Thumbs up / Thumbs down)
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Layout mode for Tablet Landscape and Desktop PC:
  // 'split': side-by-side (Task pinned on left, Hints on right)
  // 'single': single centered column
  const [desktopLayout, setDesktopLayout] = useState<'split' | 'single'>(() => {
    try {
      const saved = localStorage.getItem('lernhilfe_layout_mode');
      return saved === 'single' ? 'single' : 'split';
    } catch {
      return 'split';
    }
  });

  // Lightbox modal for enlarged diagram inspection on tablet & desktop
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  // Fullscreen / enlarged interactive modal for GeoGebra models
  const [geoGebraModal, setGeoGebraModal] = useState<{
    embedUrl: string;
    externalUrl: string;
    title: string;
  } | null>(null);

  // Pupil suggestions for additional/better hints
  const [showSuggestionForm, setShowSuggestionForm] = useState<boolean>(false);
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [suggestionSaved, setSuggestionSaved] = useState<boolean>(false);
  const [suggestionLoading, setSuggestionLoading] = useState<boolean>(false);
  const [existingSuggestion, setExistingSuggestion] = useState<{
    id: string;
    text: string;
  } | null>(null);

  // Active glossary term popover ({ term, definition })
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<{
    term: string;
    definition: string;
  } | null>(null);

  // Reset states and record views if item changes
  useEffect(() => {
    setUnlockedCount(item.disclosure_mode === 'all_visible' ? item.hints.length : 1);
    // Explicitly collapsed by default - the student must actively unfold hints
    setOpenHints({});
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

    // Record general task view only (hint view is recorded only when student unfolds a hint)
    if (!isTeacherPreview) {
      recordTaskView(item.id);
    }
  }, [item.id, isTeacherPreview]);

  const toggleHintOpen = (hintId: string) => {
    setOpenHints((prev) => {
      const willBeOpen = !prev[hintId];
      if (willBeOpen && !isTeacherPreview) {
        recordHintView(item.id, hintId);
      }
      return {
        ...prev,
        [hintId]: willBeOpen,
      };
    });
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

  const toggleLayoutMode = () => {
    const next = desktopLayout === 'split' ? 'single' : 'split';
    setDesktopLayout(next);
    try {
      localStorage.setItem('lernhilfe_layout_mode', next);
    } catch {}
  };

  const handleVote = async (hintId: string, type: 'up' | 'down') => {
    const current = userVotes[hintId];
    if (current === type) {
      // Toggle off: remove active rating
      setUserVotes((prev) => {
        const next = { ...prev };
        delete next[hintId];
        return next;
      });

      if (!isTeacherPreview) {
        await voteHint(item.id, hintId, type);
      }
      return;
    }

    // Set or switch vote
    setUserVotes((prev) => ({ ...prev, [hintId]: type }));

    if (!isTeacherPreview) {
      await voteHint(item.id, hintId, type);
    }
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim() || suggestionLoading) return;

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
      if (!isTeacherPreview) {
        recordHintView(item.id, hintId);
      }

      // Automatically scroll smoothly to this unlocked hint
      const hintIndex = item.hints.findIndex((h) => h.id === hintId);
      if (hintIndex !== -1) {
        setTimeout(() => {
          const el = document.getElementById(`hint-card-${hintIndex}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    } else {
      setPinErrors((prev) => ({ ...prev, [hintId]: true }));
      setTimeout(() => {
        setPinErrors((prev) => ({ ...prev, [hintId]: false }));
      }, 1500);
    }
  };

  // Reusable Task Header Box
  const renderTaskHeaderBox = () => (
    <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs space-y-4">
      {/* Title: Completely readable at a glance without truncation */}
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug break-words">
        {item.title}
      </h1>

      {item.task_context && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-sm sm:text-base text-slate-700 dark:text-slate-300">
          <span className="font-bold text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
            Aufgabenstellung:
          </span>
          <div className="leading-relaxed whitespace-pre-wrap">
            <LaTeXRenderer
              content={item.task_context}
              glossary={item.glossary}
              onTermClick={(term, definition) => setActiveGlossaryTerm({ term, definition })}
              className="text-sm sm:text-base lg:text-lg"
            />
          </div>
        </div>
      )}

      {item.task_image && (
        <div className="mt-3 relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
          <img
            src={item.task_image}
            alt="Aufgabenstellung Bild"
            className="max-h-72 sm:max-h-80 lg:max-h-96 w-full object-contain mx-auto cursor-zoom-in"
            onClick={() => setLightboxImage({ url: item.task_image!, title: item.title })}
          />
          <button
            type="button"
            onClick={() => setLightboxImage({ url: item.task_image!, title: item.title })}
            className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs transition-opacity opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
            title="Bild vergrößern"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vergrößern</span>
          </button>
        </div>
      )}
    </header>
  );

  // Sidebar navigation panel for Split View on Tablet/Desktop
  const renderSidebarProgress = () => {
    const revealed = Math.min(unlockedCount, item.hints.length);
    const progressPct = Math.round((revealed / item.hints.length) * 100);

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tipp-Fortschritt
            </span>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {revealed} von {item.hints.length} Tipps freigeschaltet
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
            {progressPct}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Hints Quick Jump list */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block">
            Schnell-Navigation:
          </span>
          <div className="space-y-1">
            {item.hints.map((hint, idx) => {
              const isRevealed = idx < unlockedCount;
              const isOpen = !!openHints[hint.id];
              const hasPin = !!hint.pin && hint.pin.trim().length > 0;
              const isPinUnlocked = !hasPin || !!unlockedPins[hint.id];

              return (
                <button
                  key={hint.id || idx}
                  type="button"
                  disabled={!isRevealed}
                  onClick={() => {
                    if (isRevealed) {
                      if (!isOpen) {
                        toggleHintOpen(hint.id);
                      }
                      const el = document.getElementById(`hint-card-${idx}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    !isRevealed
                      ? 'text-slate-300 dark:text-slate-700 bg-slate-50/50 dark:bg-slate-900/40 cursor-not-allowed'
                      : isOpen
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        !isRevealed
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                          : isOpen
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate">
                      {hint.title || `Tipp ${idx + 1}`}
                    </span>
                  </div>

                  <span className="shrink-0 text-[10px]">
                    {!isRevealed ? (
                      <span className="text-slate-400 dark:text-slate-600">Verdeckt</span>
                    ) : hasPin && !isPinUnlocked ? (
                      <Lock className="w-3 h-3 text-amber-500" />
                    ) : isOpen ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Offen</span>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Stepped Hints Component
  const renderHintsStream = () => (
    <div className="space-y-4">
      {/* Subheader with counter */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
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
            className={`transition-all duration-200 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs overflow-hidden ${
              isOpen
                ? 'border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {/* Hint Header / Toggle Button */}
            <button
              type="button"
              onClick={() => toggleHintOpen(hint.id)}
              className="w-full p-4 sm:p-5 lg:p-6 flex items-center justify-between text-left gap-3 focus:outline-none transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs sm:text-sm flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 break-words leading-snug">
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
              <div className="px-5 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 pt-2 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-200">
                {/* PIN Lock Barrier */}
                {hasPin && !isPinUnlocked ? (
                  <div className="py-6 sm:py-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        Dieser Tipp ist gesperrt
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
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
                          className={`w-28 sm:w-32 px-3 py-2 text-center text-lg sm:text-xl font-mono tracking-widest bg-white dark:bg-slate-950 border rounded-xl focus:outline-none focus:ring-2 ${
                            isError
                              ? 'border-red-500 text-red-600 ring-red-500 animate-shake'
                              : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handlePinSubmit(hint.id, hint.pin!)}
                          className="px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors"
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
                      <div className="text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                        <LaTeXRenderer
                          content={hint.text}
                          glossary={item.glossary}
                          onTermClick={(term, definition) => setActiveGlossaryTerm({ term, definition })}
                          className="text-base sm:text-lg"
                        />
                      </div>
                    )}

                    {/* Media Renderers */}
                    {hint.mediaType === 'image' && hint.mediaData && (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                        <img
                          src={hint.mediaData}
                          alt={hint.title}
                          className="max-h-96 sm:max-h-[450px] w-full object-contain mx-auto cursor-zoom-in"
                          onClick={() => setLightboxImage({ url: hint.mediaData!, title: hint.title || `Tipp ${index + 1}` })}
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxImage({ url: hint.mediaData!, title: hint.title || `Tipp ${index + 1}` })}
                          className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs transition-opacity opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Vergrößern</span>
                        </button>
                      </div>
                    )}

                    {hint.mediaType === 'audio' && hint.mediaData && (
                      <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col gap-2.5">
                        <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-indigo-500" />
                          <span>Audio-Erklärung anhören</span>
                        </span>
                        <audio
                          controls
                          controlsList="nodownload"
                          onContextMenu={(e) => e.preventDefault()}
                          src={hint.mediaData}
                          className="w-full h-10 sm:h-12"
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

                    {hint.mediaType === 'geogebra' && hint.mediaData && (() => {
                      const embedUrl = parseGeoGebraUrl(hint.mediaData) || hint.mediaData;
                      const dims = getGeoGebraDimensions(hint.mediaData);
                      return (
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-50 dark:bg-slate-900/40">
                          {/* Header bar for GeoGebra Applet */}
                          <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                              <span>Interaktives GeoGebra Modell</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setGeoGebraModal({
                                    embedUrl,
                                    externalUrl: hint.mediaData!,
                                    title: hint.title || 'Interaktives GeoGebra Modell',
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 px-2 py-0.5 rounded-md transition-colors"
                                title="Auf voller Bildschirmbreite vergrößern"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Vergrößern</span>
                              </button>
                              <a
                                href={hint.mediaData}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                                title="In neuem Tab / Vollbild auf GeoGebra öffnen"
                              >
                                <span>Extern</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                          {/* Responsive Dynamic Aspect Ratio Container - Automatically scales to full device width without bottom dead space */}
                          <div
                            className="relative w-full bg-white min-h-[220px] max-h-[700px] overflow-hidden"
                            style={{ aspectRatio: dims.aspectRatio }}
                          >
                            <iframe
                              src={embedUrl}
                              title="GeoGebra Interaktives Modell"
                              allowFullScreen
                              allow="fullscreen; clipboard-read; clipboard-write;"
                              className="w-full h-full border-0 block"
                            />
                          </div>
                          {/* Helper hint for mobile, tablet and desktop */}
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1">
                            <span>💡 Per Maus oder Touch verschieben • Unten rechts mit +/- zoomen</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{dims.width} × {dims.height} px</span>
                          </div>
                        </div>
                      );
                    })()}

                    {hint.mediaType === 'h5p' && hint.mediaData && (
                      <div className="relative min-h-[380px] sm:min-h-[460px] lg:min-h-[500px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-white">
                        <iframe
                          src={parseH5PUrl(hint.mediaData) || hint.mediaData}
                          title="H5P Interaktive Übung"
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      </div>
                    )}

                    {/* Feedback Row (Thumbs up / Thumbs down) */}
                    <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 select-none">
                        War dieser Tipp hilfreich?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleVote(hint.id, 'up')}
                          title={userVotes[hint.id] === 'up' ? 'Wertung zurücknehmen (Klicken zum Abwählen)' : 'Tipp war hilfreich'}
                          aria-label={userVotes[hint.id] === 'up' ? 'Wertung zurücknehmen' : 'Tipp war hilfreich'}
                          className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg flex items-center gap-1.5 text-xs transition-all active:scale-95 ${
                            userVotes[hint.id] === 'up'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-300 dark:ring-emerald-800 shadow-xs'
                              : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${userVotes[hint.id] === 'up' ? 'fill-current' : ''}`} />
                          <span className="text-[11px] hidden sm:inline">Hilfreich</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVote(hint.id, 'down')}
                          title={userVotes[hint.id] === 'down' ? 'Wertung zurücknehmen (Klicken zum Abwählen)' : 'Tipp war nicht so hilfreich'}
                          aria-label={userVotes[hint.id] === 'down' ? 'Wertung zurücknehmen' : 'Tipp war nicht so hilfreich'}
                          className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg flex items-center gap-1.5 text-xs transition-all active:scale-95 ${
                            userVotes[hint.id] === 'down'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold ring-1 ring-rose-300 dark:ring-rose-800 shadow-xs'
                              : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <ThumbsDown className={`w-3.5 h-3.5 ${userVotes[hint.id] === 'down' ? 'fill-current' : ''}`} />
                          <span className="text-[11px] hidden sm:inline">Nicht hilfreich</span>
                        </button>
                      </div>
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
            className="w-full py-3.5 sm:py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-bold text-sm sm:text-base lg:text-lg shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 min-h-[52px]"
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

          <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
            💡 Versuche erst mit den vorhandenen Tipps weiterzukommen, bevor du den nächsten öffnest.
          </p>
        </div>
      )}

      {/* All Hints Revealed Note */}
      {unlockedCount >= item.hints.length && item.hints.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="p-4 sm:p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm sm:text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {item.disclosure_mode === 'all_visible'
                  ? 'Alle Denkanstöße stehen dir zur Verfügung'
                  : 'Alle Denkanstöße wurden aufgedeckt'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
              Nutze diese Hilfen, um deine eigene Lösung aufzuschreiben und zu begründen.
            </p>
          </div>

          {/* Optional Pupil Suggestion for better/additional hints */}
          <div className="p-4 sm:p-5 lg:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquarePlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-snug">
                    Fehlt dir noch ein Denkanstoß?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 leading-relaxed resize-none"
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
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
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
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-3 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8">
      {/* Top Navigation Bar / Controls */}
      <div className={`mx-auto mb-4 sm:mb-6 ${desktopLayout === 'split' ? 'max-w-6xl xl:max-w-7xl' : 'max-w-3xl'}`}>
        <div className="flex items-center justify-between no-print gap-2 py-1">
          {onBackToWorksheet ? (
            <button
              type="button"
              onClick={onBackToWorksheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 rounded-xl transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="truncate max-w-[200px] sm:max-w-xs">
                {fromWorksheet ? `← Zurück zu „${fromWorksheet}“` : '← Zurück zum Arbeitsblatt'}
              </span>
            </button>
          ) : isTeacherPreview && onClosePreview ? (
            <button
              onClick={onClosePreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>Vorschau schließen</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <QrCode className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100">
                QR-Lernhilfe
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Desktop / Tablet Landscape Layout Mode Switcher */}
            <div className="hidden lg:flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setDesktopLayout('split');
                  try { localStorage.setItem('lernhilfe_layout_mode', 'split'); } catch {}
                }}
                title="Geteilte 2-Spalten Ansicht (Aufgabe links, Tipps rechts)"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  desktopLayout === 'split'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split-Ansicht</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDesktopLayout('single');
                  try { localStorage.setItem('lernhilfe_layout_mode', 'single'); } catch {}
                }}
                title="Einspaltige Kompakt-Ansicht (Zentriert)"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  desktopLayout === 'single'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Kompakt</span>
              </button>
            </div>

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
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap">
                Lehrer-Vorschau
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                Tippkarten
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Body - Adaptively rendered based on screen size and layout preference */}
      {desktopLayout === 'split' ? (
        /* Split-View for Tablets (landscape) and Desktop PCs */
        <div className="max-w-6xl xl:max-w-7xl mx-auto">
          {/* Mobile & Tablet Portrait view (falls back to stacked order gracefully) */}
          <div className="lg:hidden space-y-4 sm:space-y-6 max-w-3xl mx-auto">
            {renderTaskHeaderBox()}
            {renderHintsStream()}
          </div>

          {/* Desktop & Large Tablet Split Grid */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
            {/* Left Column (Sticky Task Context & Progress Navigation) */}
            <div className="lg:col-span-5 sticky top-6 space-y-5">
              {renderTaskHeaderBox()}
              {renderSidebarProgress()}
            </div>

            {/* Right Column (Scrollable Hints Stream) */}
            <div className="lg:col-span-7 space-y-5">
              {renderHintsStream()}
            </div>
          </div>
        </div>
      ) : (
        /* Single Centered Column (Optimized for focused reading on Tablet / Desktop / Mobile) */
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
          {renderTaskHeaderBox()}
          {renderHintsStream()}
        </div>
      )}

      {/* High-Resolution Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 w-full flex items-center justify-center py-4 overflow-auto">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="text-center text-xs text-slate-400">
              Klicke außerhalb oder auf das Kreuz zum Schließen
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen & Enlarged GeoGebra Interactive Modal */}
      {geoGebraModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 animate-in fade-in"
          onClick={() => setGeoGebraModal(null)}
        >
          <div
            className="relative max-w-6xl w-full h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-300 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                <span className="truncate">{geoGebraModal.title || 'Interaktives GeoGebra Modell (Vollbild)'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={geoGebraModal.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/60 rounded-lg transition-colors"
                >
                  <span className="hidden sm:inline">Auf GeoGebra öffnen</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setGeoGebraModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-white relative">
              <iframe
                src={geoGebraModal.embedUrl}
                title="GeoGebra Interaktives Modell Vollbild"
                allowFullScreen
                allow="fullscreen; clipboard-read; clipboard-write;"
                className="w-full h-full border-0 block"
              />
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              💡 Vollansicht: Du kannst das Modell mit Maus oder Fingern verschieben und unten rechts mit + / - zoomen.
            </div>
          </div>
        </div>
      )}

      {/* Mini-Lexikon / Glossar Modal */}
      {activeGlossaryTerm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setActiveGlossaryTerm(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/60 overflow-hidden flex flex-col animate-in zoom-in-95 sm:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white/15 backdrop-blur-sm text-yellow-300">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold leading-tight">
                  {activeGlossaryTerm.term}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveGlossaryTerm(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {activeGlossaryTerm.definition ? (
                  <LaTeXRenderer content={activeGlossaryTerm.definition} />
                ) : (
                  <p className="text-slate-500 italic">
                    Für diesen Begriff wurde noch keine Definition hinterlegt.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveGlossaryTerm(null)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

