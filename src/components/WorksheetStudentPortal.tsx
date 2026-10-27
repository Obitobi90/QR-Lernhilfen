import React, { useState, useMemo, useEffect } from 'react';
import { Lernhilfe } from '../types';
import { LaTeXRenderer } from '../utils/latexRenderer';
import { sortWorksheetItems } from '../utils/worksheetOrder';
import {
  FileSpreadsheet,
  BookOpen,
  Sparkles,
  ChevronRight,
  Search,
  Moon,
  Sun,
  Lock,
  GraduationCap,
  Layers,
  Image as ImageIcon,
  PlaySquare,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react';

interface WorksheetStudentPortalProps {
  groupName: string;
  items: Lernhilfe[];
  onSelectTask: (item: Lernhilfe) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onTeacherLogin?: () => void;
  isTeacherPreview?: boolean;
  onClosePreview?: () => void;
}

export const WorksheetStudentPortal: React.FC<WorksheetStudentPortalProps> = ({
  groupName,
  items,
  onSelectTask,
  darkMode,
  onToggleDarkMode,
  onTeacherLogin,
  isTeacherPreview = false,
  onClosePreview,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderVersion, setOrderVersion] = useState(0);

  // Listen for order updates
  useEffect(() => {
    const handleOrderChange = (e: any) => {
      if (e.detail?.groupName === groupName) {
        setOrderVersion((v) => v + 1);
      }
    };
    window.addEventListener('worksheet-order-updated', handleOrderChange);
    return () => window.removeEventListener('worksheet-order-updated', handleOrderChange);
  }, [groupName]);

  // Primary subject & grade from the worksheet tasks
  const subject = items[0]?.subject || 'Allgemein';
  const gradeLevel = items.find((i) => i.grade_level)?.grade_level;

  // Sorted items according to teacher-defined order
  const sortedItems = useMemo(() => {
    return sortWorksheetItems(groupName, items);
  }, [groupName, items, orderVersion]);

  // Filter tasks based on student search input
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return sortedItems;
    const q = searchTerm.toLowerCase();
    return sortedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.task_context.toLowerCase().includes(q)
    );
  }, [sortedItems, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Teacher Preview Banner (if active) */}
      {isTeacherPreview && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white border-b border-indigo-500/40 shadow-xs no-print z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-2xs">
                <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tracking-tight text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>Vorschau-Modus</span>
                  </span>
                  <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/15 text-indigo-100">
                    Schüler-Ansicht
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-indigo-100 font-medium leading-snug line-clamp-2 sm:line-clamp-1 mt-0.5">
                  So sehen deine Schüler das Arbeitsblatt-Menü nach dem Scannen des Master-QR-Codes.
                </p>
              </div>
            </div>

            {onClosePreview && (
              <button
                type="button"
                onClick={onClosePreview}
                className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Vorschau beenden</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                Arbeitsblatt-Portal
              </span>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {groupName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {onTeacherLogin && !isTeacherPreview && (
              <button
                type="button"
                onClick={onTeacherLogin}
                title="Lehrkraft-Login"
                className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero Card */}
        <div className="p-5 sm:p-7 bg-gradient-to-br from-purple-50 via-indigo-50/50 to-white dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-purple-200/80 dark:border-purple-900/50 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 text-xs font-bold bg-purple-600 text-white rounded-lg shadow-2xs">
              {subject}
            </span>
            {gradeLevel && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg border border-purple-200 dark:border-purple-800">
                {gradeLevel}
              </span>
            )}
            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
              · {items.length} {items.length === 1 ? 'Aufgabe mit Tipps' : 'Aufgaben mit gestuften Hilfen'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
            {groupName}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            💡 <strong>Zu welcher Aufgabe brauchst du Hilfe?</strong> Wähle unten deine Teilaufgabe aus, um Schritt für Schritt didaktische Denkanstöße und Skizzen aufzudecken, ohne sofort die Lösung zu verraten.
          </p>

          {/* Notice when all worksheet tasks are currently locked by the teacher */}
          {items.length > 0 && items.every((i) => i.is_locked) && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <strong>Lernhilfen noch nicht freigegeben:</strong> Deine Lehrkraft schaltet dieses Arbeitsblatt im Unterricht zeitgleich für alle frei. Tippe schon einmal deine Aufgabe an, um die Aufgabenstellung zu lesen.
              </div>
            </div>
          )}
        </div>

        {/* Search bar if multiple tasks */}
        {items.length > 3 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Aufgabe suchen (z. B. 'Aufgabe 2', 'Pythagoras')..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
            />
          </div>
        )}

        {/* Task Cards List */}
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Keine passenden Aufgaben gefunden
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm ? 'Passe deinen Suchbegriff an.' : 'Für dieses Arbeitsblatt sind derzeit keine Aufgaben hinterlegt.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400">
                Verfügbare Aufgaben ({filteredItems.length}):
              </span>
              <span>Tippe eine Aufgabe an</span>
            </div>

            {filteredItems.map((item) => {
              const hasImage = !!item.task_image;
              const hasMedia = item.hints.some((h) => h.mediaType && h.mediaType !== 'none');
              const hintCount = item.hints.length;
              const hasPin = item.hints.some((h) => !!h.pin && h.pin.trim().length > 0);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectTask(item)}
                  className="group bg-white dark:bg-slate-900 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    {/* 1. Überschrift: Titel der Lernhilfe (Aufgabennummer / Name) */}
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                      {item.title}
                    </h3>

                    {/* 2. Aufgabentext (falls vorhanden) direkt darunter */}
                    {item.task_context && item.task_context.trim().length > 0 && (
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <LaTeXRenderer content={item.task_context} glossary={item.glossary} className="text-xs sm:text-sm" />
                      </div>
                    )}

                    {/* 3. Extra Info: Anzahl Tippkarten, PIN-Status & Medien */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {/* Freischalt-Status (Gesperrt / Wartemodus) */}
                      {item.is_locked && (
                        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-amber-300 dark:border-amber-700/80 animate-pulse">
                          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Wartet auf Freischaltung</span>
                        </span>
                      )}

                      {/* Anzahl Tippkarten */}
                      <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-900/60">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{hintCount} {hintCount === 1 ? 'Tippkarte' : 'Tippkarten'}</span>
                      </span>

                      {/* PIN-Schutz Info */}
                      {hasPin && (
                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-amber-200 dark:border-amber-800/80">
                          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Tipps mit PIN geschützt</span>
                        </span>
                      )}

                      {/* Aufgabenfoto */}
                      {hasImage && (
                        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/80">
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mit Aufgabenfoto</span>
                        </span>
                      )}

                      {/* Video / GeoGebra */}
                      {hasMedia && (
                        <span className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 border border-sky-200 dark:border-sky-800/80">
                          <PlaySquare className="w-3.5 h-3.5 text-sky-600" />
                          <span>Interaktive Medien</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-purple-600 group-hover:bg-purple-700 active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <span>Tipps öffnen</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400">
        Digitale QR-Lernhilfen · Arbeitsblatt: {groupName}
      </footer>
    </div>
  );
};
