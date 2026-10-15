import React, { useState } from 'react';
import { Lernhilfe, Hint, MediaType } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { parseYouTubeUrl, parseGeoGebraUrl, parseH5PUrl } from '../utils/mediaParser';
import { generateSteppedHintsWithAI, extractTaskTextFromImage } from '../utils/geminiGenerator';
import { uploadMediaToSupabase } from '../utils/supabaseClient';
import { MathFormulaHelper } from './MathFormulaHelper';
import { AudioRecorder } from './AudioRecorder';
import { LaTeXRenderer } from '../utils/latexRenderer';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  X,
  Lock,
  Image as ImageIcon,
  Volume2,
  Video,
  FileCode,
  HelpCircle,
  Eye,
  Camera,
  FolderOpen,
  Loader2,
  Calculator,
  FileText,
  CheckCircle2,
  Wand2,
  RotateCcw,
  FileSpreadsheet,
  FolderPlus,
} from 'lucide-react';

interface LernhilfeEditorProps {
  initialItem?: Lernhilfe | null;
  existingGroups?: string[];
  onSave: (item: Lernhilfe) => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

export const LernhilfeEditor: React.FC<LernhilfeEditorProps> = ({
  initialItem,
  existingGroups = [],
  onSave,
  onCancel,
  onOpenSettings,
}) => {
  const standardGrades = [
    'Klasse 5',
    'Klasse 6',
    'Klasse 7',
    'Klasse 8',
    'Klasse 9',
    'Klasse 10',
    'Oberstufe (EF)',
    'Oberstufe (Q1)',
    'Oberstufe (Q2)',
    'Berufsschule / BBS',
    'Grundschule',
    'Übergreifend',
  ];

  const initialGrade = initialItem?.grade_level || 'Klasse 8';
  const isPresetGrade = standardGrades.includes(initialGrade);

  const [title, setTitle] = useState(initialItem?.title || '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [subject, setSubject] = useState(initialItem?.subject || 'Mathematik');
  const [gradeLevel, setGradeLevel] = useState(
    isPresetGrade ? initialGrade : initialItem?.grade_level ? 'custom' : 'Klasse 8'
  );
  const [customGradeLevel, setCustomGradeLevel] = useState(
    !isPresetGrade && initialItem?.grade_level ? initialItem.grade_level : ''
  );
  const [groupName, setGroupName] = useState<string>(initialItem?.group_name || '');
  const [taskContext, setTaskContext] = useState(initialItem?.task_context || '');
  const [taskImage, setTaskImage] = useState<string | undefined>(initialItem?.task_image);
  const [hints, setHints] = useState<Hint[]>(
    initialItem?.hints?.length
      ? initialItem.hints
      : [
          {
            id: 'hint-' + Date.now(),
            title: 'Tipp 1: Denkanstoß zur Fragestellung',
            text: '',
            mediaType: 'none',
          },
        ]
  );

  // Active math helper index (-1 if none open)
  const [activeMathHelperHintIndex, setActiveMathHelperHintIndex] = useState<number | null>(null);
  // Active math helper for taskContext
  const [isTaskMathHelperOpen, setIsTaskMathHelperOpen] = useState<boolean>(false);

  // AI Stepped Hints Generation loading & state
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');

  // AI Task & Math Text Extraction state
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [autoExtractOnUpload, setAutoExtractOnUpload] = useState<boolean>(false);

  // Extract task text and math formulas from image
  const handleExtractText = async (imageToUse?: string) => {
    const img = imageToUse || taskImage;
    if (!img) {
      setExtractError('Bitte wähle zuerst ein Aufgaben-Foto aus oder nimm eines mit der Smartphone-Kamera auf.');
      return;
    }

    setIsExtractingText(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      const data = await extractTaskTextFromImage(img);
      if (!data.extractedText) {
        throw new Error('Es konnte kein Text auf dem Foto erkannt werden. Bitte stelle sicher, dass die Aufgabe gut beleuchtet und lesbar ist.');
      }

      // Append or set recognized text
      if (!taskContext.trim()) {
        setTaskContext(data.extractedText);
      } else {
        setTaskContext((prev) => prev.trim() + '\n\n' + data.extractedText);
      }

      // Auto-suggest title if current title is empty
      if (!title.trim() && data.suggestedTitle) {
        setTitle(data.suggestedTitle);
      }

      // Auto-suggest subject if default
      if (data.detectedSubject && subject === 'Mathematik') {
        const allowedSubjects = [
          'Mathematik',
          'Physik',
          'Chemie',
          'Biologie',
          'Informatik',
          'Sozialwissenschaften',
          'Wirtschaft-Politik',
          'Deutsch',
          'Englisch',
        ];
        const found = allowedSubjects.find((s) => s.toLowerCase() === data.detectedSubject?.toLowerCase());
        if (found) {
          setSubject(found);
        }
      }

      setExtractSuccess('Aufgabentext & mathematische Formeln erfolgreich aus dem Foto verschriftlicht!');
    } catch (err: any) {
      setExtractError(err.message || 'Fehler beim Extrahieren des Aufgabentexts.');
    } finally {
      setIsExtractingText(false);
    }
  };

  // Handle Task Image Upload with Canvas compression
  const handleTaskImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 1200, 1200, 0.82);
      let targetUrl = compressed.dataUrl;

      // Attempt upload to Supabase Storage if available
      try {
        const cloudUrl = await uploadMediaToSupabase(compressed.blob, `task_${Date.now()}.jpg`);
        if (cloudUrl) targetUrl = cloudUrl;
      } catch (uploadErr) {
        // Fallback to dataUrl
      }

      setTaskImage(targetUrl);
      if (autoExtractOnUpload) {
        handleExtractText(targetUrl);
      }
    } catch (err: any) {
      alert('Bild konnte nicht verarbeitet werden: ' + err.message);
    }
  };

  // Add new hint
  const handleAddHint = () => {
    const newIdx = hints.length + 1;
    setHints([
      ...hints,
      {
        id: 'hint-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: `Tipp ${newIdx}: Weiterer Denkanstoß`,
        text: '',
        mediaType: 'none',
      },
    ]);
  };

  // Remove hint
  const handleRemoveHint = (index: number) => {
    if (hints.length <= 1) {
      alert('Eine Lernhilfe sollte mindestens einen Tipp enthalten.');
      return;
    }
    const updated = hints.filter((_, idx) => idx !== index);
    setHints(updated);
  };

  // Move hint position
  const handleMoveHint = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= hints.length) return;
    const updated = [...hints];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setHints(updated);
  };

  // Update specific hint
  const handleUpdateHint = (index: number, fields: Partial<Hint>) => {
    const updated = [...hints];
    updated[index] = { ...updated[index], ...fields };
    setHints(updated);
  };

  // Handle hint image upload with Canvas compression
  const handleHintImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 1200, 1200, 0.82);
      let targetUrl = compressed.dataUrl;

      // Attempt upload to Supabase Storage if available
      try {
        const cloudUrl = await uploadMediaToSupabase(compressed.blob, `hint_${Date.now()}.jpg`);
        if (cloudUrl) targetUrl = cloudUrl;
      } catch (uploadErr) {
        // Fallback to dataUrl
      }

      handleUpdateHint(index, {
        mediaType: 'image',
        mediaData: targetUrl,
      });
    } catch (err: any) {
      alert('Fehler bei der Bildkompression: ' + err.message);
    }
  };

  // AI Generator trigger
  const handleGenerateAiHints = async () => {
    if (!taskContext.trim() && !taskImage) {
      alert('Bitte gib zuerst eine Aufgabenstellung ein oder lade ein Foto der Aufgabe hoch.');
      return;
    }

    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const generated = await generateSteppedHintsWithAI(taskContext, title, taskImage);

      // Convert generated hints to Hint items
      const newHints: Hint[] = generated.map((gh, idx) => ({
        id: 'hint-ai-' + Date.now() + '-' + idx,
        title: gh.title,
        text: gh.text,
        mediaType: 'none',
      }));

      // If user had existing empty hint, replace it; otherwise append new hints
      if (hints.length === 1 && !hints[0].text.trim()) {
        setHints(newHints);
      } else {
        setHints([...hints, ...newHints]);
      }
    } catch (err: any) {
      setAiError(err.message || 'Fehler bei der KI-Generierung');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError('Bitte gib einen Titel für die Lernhilfe ein.');
      return;
    }
    setTitleError(null);

    const resolvedGrade = (gradeLevel === 'custom' ? customGradeLevel : gradeLevel).trim();

    const item: Lernhilfe = {
      id: initialItem?.id || 'lh-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      title: title.trim(),
      subject: subject.trim(),
      grade_level: resolvedGrade || undefined,
      group_name: groupName.trim() || undefined,
      task_context: taskContext.trim(),
      task_image: taskImage,
      hints,
      created_at: initialItem?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(item);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto my-6">
      {/* Editor Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {initialItem ? 'Lernhilfe bearbeiten' : 'Neue Lernhilfe erstellen'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Didaktischer Tippkarten-Editor
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Switch: Editor vs Live Preview */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewTab('editor')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                previewTab === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('preview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                previewTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Vorschau
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {previewTab === 'preview' ? (
        /* Live Preview Tab */
        <div className="p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-400">{subject}</span>
                {groupName && (
                  <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md flex items-center gap-1 border border-purple-200 dark:border-purple-800">
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>{groupName}</span>
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold">{title || 'Ohne Titel'}</h3>
              {taskContext && <LaTeXRenderer content={taskContext} />}
              {taskImage && (
                <img src={taskImage} alt="Aufgabe" className="rounded-lg max-h-60 object-contain mx-auto" />
              )}
            </div>
            <div className="space-y-3">
              <span className="text-xs uppercase font-bold text-slate-400">
                {hints.length} geplante Tipps:
              </span>
              {hints.map((h, i) => (
                <div
                  key={i}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>
                      Tipp {i + 1}: {h.title}
                    </span>
                    {h.pin && (
                      <span className="text-xs text-amber-600 font-mono bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                        PIN: {h.pin}
                      </span>
                    )}
                  </div>
                  {h.text ? (
                    <LaTeXRenderer content={h.text} />
                  ) : (
                    <span className="text-slate-400 italic text-xs">Noch kein Text eingetragen.</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Main Editor Form */
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Metadata Section: Mobile-optimized, non-squished layout */}
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Titel der Lernhilfe / Aufgabe *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(null);
                }}
                placeholder="z.B. Satz des Pythagoras: Die Feuerwehrleiter"
                className={`w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border rounded-xl focus:outline-none focus:ring-2 shadow-2xs transition-colors ${
                  titleError
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
                }`}
              />
              {titleError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {titleError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Fach */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Fach / Kategorie
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  <option value="Mathematik">Mathematik</option>
                  <option value="Physik">Physik</option>
                  <option value="Chemie">Chemie</option>
                  <option value="Biologie">Biologie</option>
                  <option value="Informatik">Informatik</option>
                  <option value="Sozialwissenschaften">Sozialwissenschaften</option>
                  <option value="Wirtschaft-Politik">Wirtschaft-Politik</option>
                  <option value="Deutsch">Deutsch</option>
                  <option value="Englisch">Englisch</option>
                  <option value="Sonstiges">Sonstiges</option>
                </select>
              </div>

              {/* Jahrgangsstufe */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Jahrgangsstufe / Klasse
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  {standardGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="custom">Eigene Angabe...</option>
                </select>
                {gradeLevel === 'custom' && (
                  <input
                    type="text"
                    value={customGradeLevel}
                    onChange={(e) => setCustomGradeLevel(e.target.value)}
                    placeholder="z. B. 7b, Diff-Kurs 9, LK..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-1"
                  />
                )}
              </div>
            </div>

            {/* Arbeitsblatt / Gruppierung (optional) */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Arbeitsblatt / Themen-Gruppierung</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 normal-case">
                    (optional)
                  </span>
                </label>
                {groupName && (
                  <button
                    type="button"
                    onClick={() => setGroupName('')}
                    className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    Zuordnung aufheben
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  list="existing-worksheets-list"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="z. B. Arbeitsblatt zum Satz des Pythagoras, Stationenlernen..."
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
                <datalist id="existing-worksheets-list">
                  {existingGroups.map((grp) => (
                    <option key={grp} value={grp} />
                  ))}
                </datalist>
              </div>

              {/* Quick suggestions from existing groups */}
              {existingGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mr-1">
                    Vorhandene Arbeitsblätter:
                  </span>
                  {existingGroups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setGroupName(grp)}
                      className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                        groupName === grp
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Fasst mehrere (Teil-)Aufgaben zusammen. In der Übersicht kannst du später für dieses Arbeitsblatt alle QR-Codes gemeinsam als fertigen QR-Bogen ausdrucken.
              </p>
            </div>
          </div>

          {/* Task Context & Task Photo */}
          <div className="p-3.5 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Aufgabenstellung &amp; Kontext</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 normal-case">
                  (optional)
                </span>
              </label>

              <div className="flex items-center gap-2">
                {taskImage && (
                  <button
                    type="button"
                    disabled={isExtractingText}
                    onClick={() => handleExtractText()}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 font-semibold transition shadow-xs disabled:opacity-50"
                    title="Extrahiert den Aufgabentext und alle mathematischen Formeln aus dem Foto"
                  >
                    {isExtractingText ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                        <span>Extrahiere...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Text aus Foto verschriftlichen</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsTaskMathHelperOpen(!isTaskMathHelperOpen)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 font-semibold p-1"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Formel einfügen</span>
                </button>
              </div>
            </div>

            {isTaskMathHelperOpen && (
              <MathFormulaHelper
                onInsertFormula={(snippet) => setTaskContext((prev) => prev + ' ' + snippet)}
                onClose={() => setIsTaskMathHelperOpen(false)}
              />
            )}

            <textarea
              rows={3}
              value={taskContext}
              onChange={(e) => setTaskContext(e.target.value)}
              placeholder="Hier den Aufgabentext eintragen (vollständig optional! Mathe-Formeln in $formel$ unterstützt, oder oben mit KI aus dem Foto extrahieren)..."
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed"
            />

            {/* Live KaTeX Math Formula Preview */}
            {taskContext && (taskContext.includes('$') || taskContext.includes('\\')) && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    Mathematische Formel-Vorschau (KaTeX):
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                    Schüler-Ansicht
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 pt-0.5">
                  <LaTeXRenderer content={taskContext} />
                </div>
              </div>
            )}

            {/* Extraction Success & Error Alerts */}
            {extractSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{extractSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExtractSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 font-semibold text-xs ml-2"
                >
                  OK
                </button>
              </div>
            )}

            {extractError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{extractError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExtractError(null)}
                  className="text-rose-700 hover:text-rose-900 dark:text-rose-300 font-semibold text-xs ml-2"
                >
                  Schließen
                </button>
              </div>
            )}

            {/* Task Image Options */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Foto der Aufgabe / Schulbuchseite (optional):
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoExtractOnUpload}
                    onChange={(e) => setAutoExtractOnUpload(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Nach Foto-Aufnahme direkt mit KI verschriftlichen</span>
                </label>
              </div>

              {/* Clean Non-redundant Mobile Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Direct Native Smartphone Camera Capture */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition shadow-xs min-h-[46px] active:scale-[0.99]">
                  <Camera className="w-4 h-4 text-white" />
                  <span>Foto mit Smartphone-Kamera machen</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleTaskImageUpload}
                    className="hidden"
                  />
                </label>

                {/* 2. Pick from File / Gallery */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer transition min-h-[46px] active:scale-[0.99]">
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <span>Aus Galerie / Datei wählen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTaskImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {taskImage && (
                <div className="mt-2.5 p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={taskImage}
                      alt="Aufgaben-Vorschau"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Aufgaben-Foto gespeichert
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                        Wird Schülern angezeigt &amp; für KI-Tipps verwendet
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* One-click AI text & math formula extraction */}
                    <button
                      type="button"
                      disabled={isExtractingText}
                      onClick={() => handleExtractText()}
                      className="flex-1 sm:flex-none px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition"
                    >
                      {isExtractingText ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>KI extrahiert...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>✨ Text &amp; Formeln extrahieren</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskImage(undefined)}
                      className="px-2.5 py-2 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-center gap-1 transition"
                      title="Aufgaben-Foto entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Löschen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Generator Banner */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={handleGenerateAiHints}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>KI generiert didaktische Tipps...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ Gestufte Tipps mit KI generieren</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Didaktisches Scaffolding (verrät nie die Lösung).
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
              >
                API-Key Einstellungen
              </button>
            </div>

            {aiError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
                {aiError}
              </div>
            )}
          </div>

          {/* Stepped Hints Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Gestufte Tipps ({hints.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Schüler sehen zunächst nur Tipp 1 und decken weitere Tipps stufenweise auf.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddHint}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tipp hinzufügen</span>
              </button>
            </div>

            {/* Hint Cards List: Mobile-first layout */}
            <div className="space-y-4">
              {hints.map((hint, index) => (
                <div
                  key={hint.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs"
                >
                  {/* Top Bar of Hint Card: Badges and Actions */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {index + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        Tipp {index + 1}
                      </span>
                    </div>

                    {/* Hint Controls: Up, Down, Delete with comfortable 36px touch targets */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveHint(index, 'up')}
                        title="Nach oben schieben"
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-25 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === hints.length - 1}
                        onClick={() => handleMoveHint(index, 'down')}
                        title="Nach unten schieben"
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-25 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveHint(index)}
                        title="Tipp löschen"
                        className="p-2 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title input on full-width row (never squished on phones) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Tipp-Überschrift:
                    </label>
                    <input
                      type="text"
                      value={hint.title}
                      onChange={(e) => handleUpdateHint(index, { title: e.target.value })}
                      placeholder={`z.B. Tipp ${index + 1}: Denkanstoß zur Fragestellung`}
                      className="w-full font-bold text-base sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                  </div>

                  {/* Math Formula Helper for this hint */}
                  {activeMathHelperHintIndex === index && (
                    <MathFormulaHelper
                      onInsertFormula={(snippet) =>
                        handleUpdateHint(index, {
                          text: (hint.text || '') + ' ' + snippet,
                        })
                      }
                      onClose={() => setActiveMathHelperHintIndex(null)}
                    />
                  )}

                  {/* Hint Text Area */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Erklärung / Leitfrage (mit Mathe-Formeln in $formel$):
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMathHelperHintIndex(
                            activeMathHelperHintIndex === index ? null : index
                          )
                        }
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 font-semibold p-1"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Formel-Assistent</span>
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      value={hint.text}
                      onChange={(e) => handleUpdateHint(index, { text: e.target.value })}
                      placeholder="Erklärung, Denkanstoß oder Leitfrage eingeben..."
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed"
                    />

                    {/* Realtime KaTeX text preview if text exists */}
                    {hint.text && (hint.text.includes('$') || hint.text.includes('\\')) && (
                      <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-xs text-slate-800 dark:text-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                          Formel-Vorschau:
                        </span>
                        <LaTeXRenderer content={hint.text} />
                      </div>
                    )}
                  </div>

                  {/* PIN & Media Settings Grid */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* PIN Lock Configuration */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        <span>4-stelliger PIN-Code (optional):</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={hint.pin || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          handleUpdateHint(index, { pin: val });
                        }}
                        placeholder="z.B. 1234 oder leer lassen"
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                      <p className="text-[10px] text-slate-400">
                        Falls gesetzt, müssen Schüler erst diesen Code eingeben.
                      </p>
                    </div>

                    {/* Media Type Selector */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>Zusätzliches Medium:</span>
                      </label>
                      <select
                        value={hint.mediaType}
                        onChange={(e) =>
                          handleUpdateHint(index, {
                            mediaType: e.target.value as MediaType,
                            mediaData: e.target.value === 'none' ? undefined : hint.mediaData,
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      >
                        <option value="none">Kein Medium</option>
                        <option value="image">Bild / Skizze (Canvas-komprimiert)</option>
                        <option value="audio">Sprachnachricht / Audio</option>
                        <option value="youtube">YouTube (datenschutzkonform)</option>
                        <option value="geogebra">GeoGebra (interaktives Applet)</option>
                        <option value="h5p">H5P (interaktive Übung)</option>
                      </select>
                    </div>
                  </div>

                  {/* Media Specific Inputs */}
                  {hint.mediaType === 'image' && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* 1. Direct Native Smartphone Camera Capture */}
                        <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs min-h-[42px] active:scale-[0.99]">
                          <Camera className="w-3.5 h-3.5 text-white" />
                          <span>Foto mit Smartphone-Kamera machen</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleHintImageUpload(index, e)}
                            className="hidden"
                          />
                        </label>

                        {/* 2. Pick from File / Gallery */}
                        <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition min-h-[42px] active:scale-[0.99]">
                          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>Aus Galerie / Datei wählen</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleHintImageUpload(index, e)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {hint.mediaData && (
                        <div className="pt-2 flex items-center justify-between">
                          <img
                            src={hint.mediaData}
                            alt="Tipp Bild"
                            className="max-h-40 object-contain rounded-lg border border-slate-200 dark:border-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: undefined })}
                            className="text-xs text-rose-500 hover:text-rose-700 font-semibold p-1"
                          >
                            Entfernen
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {hint.mediaType === 'audio' && (
                    <AudioRecorder
                      initialAudioUrl={hint.mediaData}
                      onAudioSave={async (dataUrl, blob) => {
                        let targetUrl = dataUrl;
                        if (blob) {
                          try {
                            const cloudUrl = await uploadMediaToSupabase(
                              blob,
                              `audio_${Date.now()}.webm`
                            );
                            if (cloudUrl) targetUrl = cloudUrl;
                          } catch (e) {
                            // fallback to dataUrl
                          }
                        }
                        handleUpdateHint(index, { mediaData: targetUrl });
                      }}
                      onRemove={() => handleUpdateHint(index, { mediaData: undefined })}
                    />
                  )}

                  {hint.mediaType === 'youtube' && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600 dark:text-slate-400">
                        YouTube-Link oder Iframe:
                      </label>
                      <input
                        type="text"
                        value={hint.mediaData || ''}
                        onChange={(e) => {
                          const parsed = parseYouTubeUrl(e.target.value) || e.target.value;
                          handleUpdateHint(index, { mediaData: parsed });
                        }}
                        placeholder="https://www.youtube.com/watch?v=... oder https://youtu.be/..."
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                      <p className="text-[10px] text-slate-400">
                        Wird automatisch zu datenschutzfreundlichem youtube-nocookie.com/embed konvertiert.
                      </p>
                    </div>
                  )}

                  {(hint.mediaType === 'geogebra' || hint.mediaType === 'h5p') && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600 dark:text-slate-400">
                        {hint.mediaType === 'geogebra' ? 'GeoGebra URL / Iframe:' : 'H5P URL / Iframe:'}
                      </label>
                      <input
                        type="text"
                        value={hint.mediaData || ''}
                        onChange={(e) => {
                          const parsed =
                            hint.mediaType === 'geogebra'
                              ? parseGeoGebraUrl(e.target.value) || e.target.value
                              : parseH5PUrl(e.target.value) || e.target.value;
                          handleUpdateHint(index, { mediaData: parsed });
                        }}
                        placeholder={
                          hint.mediaType === 'geogebra'
                            ? 'https://www.geogebra.org/m/... oder <iframe>'
                            : 'https://h5p.org/h5p/embed/... oder <iframe>'
                        }
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Add Hint Button */}
            <button
              type="button"
              onClick={handleAddHint}
              className="w-full py-3.5 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 rounded-2xl text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center gap-2 transition-colors min-h-[48px]"
            >
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Weiteren gestuften Tipp hinzufügen</span>
            </button>
          </div>

          {/* Sticky Mobile-Friendly Action Footer */}
          <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 -mx-3 sm:mx-0 -mb-3 sm:mb-0 flex items-center justify-between sm:justify-end gap-3 shadow-lg rounded-b-2xl">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[44px]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors min-h-[44px] active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              <span>Lernhilfe speichern</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
