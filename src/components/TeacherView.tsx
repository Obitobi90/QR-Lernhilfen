import React, { useState } from 'react';
import { Lernhilfe } from '../types';
import { LaTeXRenderer } from '../utils/latexRenderer';
import {
  Plus,
  Search,
  QrCode,
  Eye,
  Edit3,
  Copy,
  Trash2,
  Lock,
  Layers,
  Settings,
  Sparkles,
  BookOpen,
  Filter,
  BarChart3,
  GraduationCap,
} from 'lucide-react';

interface TeacherViewProps {
  items: Lernhilfe[];
  onCreateNew: () => void;
  onEdit: (item: Lernhilfe) => void;
  onDuplicate: (item: Lernhilfe) => void;
  onDelete: (id: string) => void;
  onOpenQr: (item: Lernhilfe) => void;
  onOpenStats: (item: Lernhilfe) => void;
  onOpenPreview: (id: string) => void;
  onOpenSettings: () => void;
  isSupabaseEnabled: boolean;
}

export const TeacherView: React.FC<TeacherViewProps> = ({
  items,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenQr,
  onOpenStats,
  onOpenPreview,
  onOpenSettings,
  isSupabaseEnabled,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Alle');

  const subjects = [
    'Alle',
    'Mathematik',
    'Physik',
    'Chemie',
    'Biologie',
    'Informatik',
    'Sozialwissenschaften',
    'Wirtschaft-Politik',
    'Sonstiges',
  ];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.task_context.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.subject && item.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.grade_level && item.grade_level.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSubject = selectedSubject === 'Alle' || item.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-6">
      {/* Teacher Dashboard Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Meine Lernhilfen &amp; Tippkarten</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Erstelle gestufte Denkanstöße für differenzierten Unterricht und generiere QR-Codes für Schüler.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Lernhilfe erstellen</span>
          </button>
        </div>
      </div>


      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Lernhilfe suchen (Titel, Fach, Klasse)..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Subject Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          {subjects.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                selectedSubject === sub
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
            Keine Lernhilfen gefunden
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedSubject !== 'Alle'
              ? 'Passe deine Such- oder Filterkriterien an.'
              : 'Erstelle jetzt deine erste digitale Tippkarte mit gestuften Hinweisen und QR-Code!'}
          </p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
          >
            Jetzt erste Lernhilfe anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const hasPinLockedHint = item.hints.some((h) => !!h.pin && h.pin.trim().length > 0);

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all hover:shadow-md"
              >
                {/* Card Header & Metadata */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {item.subject || 'Allgemein'}
                      </span>
                      {item.grade_level && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-slate-500" />
                          <span>{item.grade_level}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPinLockedHint && (
                        <span
                          title="Enthält PIN-geschützte Tipps"
                          className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                        >
                          <Lock className="w-3 h-3" />
                          <span className="text-[10px]">PIN-Schutz</span>
                        </span>
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Layers className="w-3 h-3" />
                        <span>{item.hints.length} {item.hints.length === 1 ? 'Tipp' : 'Tipps'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-snug">
                    {item.title}
                  </h3>

                  {/* Task context preview - completely displayed without line-clamp */}
                  {item.task_context && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aufgabentext:
                      </span>
                      <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap">
                        <LaTeXRenderer content={item.task_context} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  {/* Primary QR Code & Stats Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenQr(item)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR-Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenStats(item)}
                      title="Statistik &amp; Schüler-Feedback ansehen"
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Statistik</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Preview Button */}
                    <button
                      type="button"
                      onClick={() => onOpenPreview(item.id)}
                      title="Schüler-Vorschau ansehen"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Bearbeiten"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Duplicate Button */}
                    <button
                      type="button"
                      onClick={() => onDuplicate(item)}
                      title="Lernhilfe duplizieren"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Möchtest du "${item.title}" wirklich löschen?`)) {
                          onDelete(item.id);
                        }
                      }}
                      title="Löschen"
                      className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
