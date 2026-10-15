import React, { useState, useMemo } from 'react';
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
  FileSpreadsheet,
  Printer,
  ChevronRight,
  FolderOpen,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface TeacherViewProps {
  items: Lernhilfe[];
  onCreateNew: (groupPreset?: string) => void;
  onEdit: (item: Lernhilfe) => void;
  onDuplicate: (item: Lernhilfe) => void;
  onDelete: (id: string) => void;
  onOpenQr: (item: Lernhilfe) => void;
  onOpenWorksheetQr?: (groupName: string, items: Lernhilfe[]) => void;
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
  onOpenWorksheetQr,
  onOpenStats,
  onOpenPreview,
  onOpenSettings,
  isSupabaseEnabled,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Alle');
  const [selectedGroup, setSelectedGroup] = useState<string>('Alle');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Local state for delete confirmation dialog (avoids window.confirm blocked in iframes)
  const [itemToDelete, setItemToDelete] = useState<Lernhilfe | null>(null);
  // Track duplicating item id for visual feedback
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicate = async (item: Lernhilfe) => {
    try {
      setDuplicatingId(item.id);
      await onDuplicate(item);
    } catch (e) {
      console.error('Duplication error:', e);
    } finally {
      setTimeout(() => setDuplicatingId(null), 500);
    }
  };

  const subjects = [
    'Alle',
    'Mathematik',
    'Physik',
    'Chemie',
    'Biologie',
    'Informatik',
    'Sozialwissenschaften',
    'Wirtschaft-Politik',
    'Deutsch',
    'Englisch',
    'Sonstiges',
  ];

  // Distinct groups across all items
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.group_name && i.group_name.trim().length > 0) {
        set.add(i.group_name.trim());
      }
    });
    return Array.from(set);
  }, [items]);

  // General item filter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        item.title.toLowerCase().includes(q) ||
        item.task_context.toLowerCase().includes(q) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.grade_level && item.grade_level.toLowerCase().includes(q)) ||
        (item.group_name && item.group_name.toLowerCase().includes(q));

      const matchesSubject = selectedSubject === 'Alle' || item.subject === selectedSubject;

      const matchesGroup =
        selectedGroup === 'Alle' ||
        (selectedGroup === '__ungrouped__'
          ? !item.group_name || item.group_name.trim() === ''
          : item.group_name === selectedGroup);

      return matchesSearch && matchesSubject && matchesGroup;
    });
  }, [items, searchTerm, selectedSubject, selectedGroup]);

  // Grouped breakdown
  const groupedData = useMemo(() => {
    const groups: { name: string; items: Lernhilfe[] }[] = [];
    const ungrouped: Lernhilfe[] = [];

    existingGroups.forEach((grpName) => {
      const inGroup = filteredItems.filter((i) => i.group_name === grpName);
      if (inGroup.length > 0) {
        groups.push({ name: grpName, items: inGroup });
      }
    });

    filteredItems.forEach((i) => {
      if (!i.group_name || i.group_name.trim() === '') {
        ungrouped.push(i);
      }
    });

    return { groups, ungrouped };
  }, [filteredItems, existingGroups]);

  // Reusable Single Task Card Component
  const renderCard = (item: Lernhilfe) => {
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

              {item.group_name && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(item.group_name!);
                    setViewMode('grouped');
                  }}
                  title={`Nach Arbeitsblatt "${item.group_name}" filtern`}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-md border border-purple-200 dark:border-purple-800/80 flex items-center gap-1 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
                >
                  <FileSpreadsheet className="w-3 h-3 text-purple-500" />
                  <span className="truncate max-w-[130px]">{item.group_name}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasPinLockedHint && (
                <span
                  title="Enthält PIN-geschützte Tipps"
                  className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                >
                  <Lock className="w-3 h-3" />
                  <span className="text-[10px]">PIN</span>
                </span>
              )}
              <span>·</span>
              <span className="flex items-center gap-1 tabular-nums">
                <Layers className="w-3 h-3" />
                <span>
                  {item.hints.length} {item.hints.length === 1 ? 'Tipp' : 'Tipps'}
                </span>
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
              title="Statistik & Schüler-Feedback ansehen"
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
              onClick={() => handleDuplicate(item)}
              disabled={duplicatingId === item.id}
              title="Lernhilfe duplizieren"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {duplicatingId === item.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Delete Button (Opens in-app confirmation modal, completely iframe-safe) */}
            <button
              type="button"
              onClick={() => setItemToDelete(item)}
              title="Lernhilfe löschen"
              className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Teacher Dashboard Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Meine Lernhilfen &amp; Tippkarten</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Erstelle gestufte Denkanstöße für differenzierten Unterricht, gruppiere sie nach Arbeitsblättern und generiere QR-Codes für Schüler.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateNew()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Lernhilfe erstellen</span>
          </button>
        </div>
      </div>

      {/* Filter, View Mode, and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen (Titel, Fach, Klasse, Arbeitsblatt)..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* View Mode Toggle: Gruppiert nach Arbeitsblättern vs. Alle Einzelkarten */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500" />
              <span>Nach Arbeitsblättern</span>
              {existingGroups.length > 0 && (
                <span className="px-1.5 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded text-[10px]">
                  {existingGroups.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Alle Karten ({items.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Bars (Subjects & Worksheets) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
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

          {/* Worksheet Selection Filter if worksheets exist */}
          {existingGroups.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] shrink-0 hidden sm:inline">
                Arbeitsblatt-Filter:
              </span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="Alle">Alle Arbeitsblätter &amp; Einzelkarten</option>
                {existingGroups.map((grp) => (
                  <option key={grp} value={grp}>
                    📋 {grp}
                  </option>
                ))}
                <option value="__ungrouped__">Nur Einzelkarten (ohne Arbeitsblatt)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
            Keine Lernhilfen gefunden
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedSubject !== 'Alle' || selectedGroup !== 'Alle'
              ? 'Passe deine Such- oder Filterkriterien an.'
              : 'Erstelle jetzt deine erste digitale Tippkarte mit gestuften Hinweisen und QR-Code!'}
          </p>
          <button
            onClick={() => onCreateNew()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
          >
            Jetzt erste Lernhilfe anlegen
          </button>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped View Mode by Worksheets */
        <div className="space-y-8">
          {/* Render each Worksheet Group */}
          {groupedData.groups.map(({ name, items: groupItems }) => {
            const firstSubject = groupItems[0]?.subject || 'Gemischt';
            const grade = groupItems.find((i) => i.grade_level)?.grade_level;

            return (
              <section
                key={name}
                className="bg-slate-50/70 dark:bg-slate-950/40 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
              >
                {/* Worksheet Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100 dark:border-purple-900/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          Arbeitsblatt / Themengruppe
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {firstSubject} {grade ? `· ${grade}` : ''}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg leading-tight">
                        {name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Print Entire Worksheet QR-Sheet */}
                    {onOpenWorksheetQr && (
                      <button
                        type="button"
                        onClick={() => onOpenWorksheetQr(name, groupItems)}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Arbeitsblatt QR-Bogen drucken ({groupItems.length})</span>
                      </button>
                    )}

                    {/* Add another task to this worksheet */}
                    <button
                      type="button"
                      onClick={() => onCreateNew(name)}
                      title={`Weitere Aufgabe zu "${name}" hinzufügen`}
                      className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Teilaufgabe ergänzen</span>
                    </button>
                  </div>
                </div>

                {/* Grid of Tasks in this worksheet */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupItems.map((item) => renderCard(item))}
                </div>
              </section>
            );
          })}

          {/* Render Ungrouped Tasks if any */}
          {groupedData.ungrouped.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    Einzelne Aufgaben &amp; Tippkarten (ohne Arbeitsblatt-Zuordnung)
                  </h3>
                  <span className="text-xs text-slate-400">
                    ({groupedData.ungrouped.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Tipp: Über „Bearbeiten“ kannst du jede Aufgabe einem Arbeitsblatt zuordnen.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedData.ungrouped.map((item) => renderCard(item))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* Flat List View Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => renderCard(item))}
        </div>
      )}

      {/* Delete Confirmation Modal (Iframe-safe, replaces blocked window.confirm) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Lernhilfe unwiderruflich löschen?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Möchtest du diese Lernhilfe wirklich löschen? Der dazugehörige QR-Code verliert seine Gültigkeit und Schüler können die Tippkarten nicht mehr aufrufen.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {itemToDelete.title}
              </div>
              <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {itemToDelete.subject || 'Allgemein'}
                </span>
                {itemToDelete.grade_level && <span>· {itemToDelete.grade_level}</span>}
                {itemToDelete.group_name && <span>· 📋 {itemToDelete.group_name}</span>}
                <span>
                  · {itemToDelete.hints.length} {itemToDelete.hints.length === 1 ? 'Tipp' : 'Tipps'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = itemToDelete.id;
                  setItemToDelete(null);
                  onDelete(id);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Lernhilfe löschen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
