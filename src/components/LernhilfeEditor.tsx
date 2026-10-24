import React, { useState, useRef, useEffect } from 'react';
import { Lernhilfe, Hint, MediaType, DisclosureMode, QrDesignSettings } from '../types';
import { compressImage } from '../utils/imageCompressor';
import {
  parseYouTubeUrl,
  parseGeoGebraUrl,
  parseH5PUrl,
  getGeoGebraDimensions,
  extractGeoGebraParams,
} from '../utils/mediaParser';
import { generateSteppedHintsWithAI, extractTaskTextFromImage } from '../utils/geminiGenerator';
import { generateNumericLernhilfeId } from '../utils/idGenerator';
import { uploadMediaToSupabase } from '../utils/supabaseClient';
import { MathFormulaHelper } from './MathFormulaHelper';
import { AudioRecorder } from './AudioRecorder';
import { LaTeXRenderer } from '../utils/latexRenderer';
import {
  getEffectiveQrDesign,
  getQrDesignSettings,
  renderStyledQrCode,
} from '../utils/qrCodeTheme';
import { buildStudentUrl } from '../utils/appUrl';
import { QrCodeDesigner } from './QrCodeDesigner';
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
  RefreshCw,
  FileSpreadsheet,
  FolderPlus,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Minus,
  ChevronsUpDown,
  QrCode,
  Palette,
  ChevronDown,
  ChevronUp,
  BookOpen,
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

  const allowedSubjects = ['Mathematik', 'Wirtschaft-Politik', 'Sozialwissenschaften'];
  const initialSubject = initialItem?.subject && allowedSubjects.includes(initialItem.subject)
    ? initialItem.subject
    : 'Mathematik';
  const [numericId, setNumericId] = useState<string>(
    initialItem?.id || generateNumericLernhilfeId()
  );
  const [title, setTitle] = useState(initialItem?.title || '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [subject, setSubject] = useState(initialSubject);
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
            title: 'Problemstellung erfassen & Skizze anfertigen',
            text: '',
            mediaType: 'none',
          },
        ]
  );
  const [disclosureMode, setDisclosureMode] = useState<DisclosureMode>(
    initialItem?.disclosure_mode || 'stepped'
  );

  // Glossary / Fachbegriffe state
  const [glossary, setGlossary] = useState<Record<string, string>>(initialItem?.glossary || {});
  const [isGeneratingGlossary, setIsGeneratingGlossary] = useState<boolean>(false);
  const [generatingTerm, setGeneratingTerm] = useState<string | null>(null);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [glossarySuccess, setGlossarySuccess] = useState<string | null>(null);
  const [isGlossarySectionOpen, setIsGlossarySectionOpen] = useState<boolean>(true);
  const [newCustomTerm, setNewCustomTerm] = useState<string>('');

  const [previewGlossaryModal, setPreviewGlossaryModal] = useState<{ term: string; definition: string } | null>(null);

  // Refs for inserting [[...]] tags into textareas
  const taskTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hintTextareaRefs = useRef<{ [index: number]: HTMLTextAreaElement | null }>({});

  // Detect [[Term]] in taskContext and hints
  const detectedTerms = React.useMemo(() => {
    const terms = new Set<string>();
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    if (taskContext) {
      while ((match = regex.exec(taskContext)) !== null) {
        const t = match[1].trim();
        if (t) terms.add(t);
      }
    }
    hints.forEach((h) => {
      if (h.text) {
        while ((match = regex.exec(h.text)) !== null) {
          const t = match[1].trim();
          if (t) terms.add(t);
        }
      }
    });
    // Include all keys already defined in glossary
    Object.keys(glossary).forEach((k) => {
      if (k.trim()) terms.add(k.trim());
    });
    return Array.from(terms);
  }, [taskContext, hints, glossary]);

  // AI Definitions Generator
  const handleGenerateGlossaryAi = async (termSpecific?: string) => {
    const targetTerms = termSpecific ? [termSpecific] : detectedTerms;
    if (targetTerms.length === 0) {
      setGlossaryError('Keine Fachbegriffe in [[Klammern]] im Text oder in den Tipps gefunden.');
      return;
    }

    if (termSpecific) {
      setGeneratingTerm(termSpecific);
    } else {
      setIsGeneratingGlossary(true);
    }
    setGlossaryError(null);
    setGlossarySuccess(null);

    try {
      const res = await fetch('/api/gemini/generate-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms: targetTerms,
          subject,
          gradeLevel: gradeLevel === 'custom' ? customGradeLevel : gradeLevel,
          context: taskContext,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Fehler beim Generieren der Definitionen');
      }

      const data = await res.json();
      if (data.definitions && typeof data.definitions === 'object') {
        setGlossary((prev) => ({
          ...prev,
          ...data.definitions,
        }));
        setGlossarySuccess(
          termSpecific
            ? `Definition für „${termSpecific}“ erfolgreich mit KI erstellt!`
            : `Definitionen für ${targetTerms.length} Begriff(e) erfolgreich mit KI erstellt!`
        );
        setTimeout(() => setGlossarySuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Glossary error:', err);
      setGlossaryError(err.message || 'Fehler bei der KI-Definitions-Generierung');
    } finally {
      setIsGeneratingGlossary(false);
      setGeneratingTerm(null);
    }
  };

  const handleInsertTermBrackets = (
    textarea: HTMLTextAreaElement | null,
    currentText: string,
    onUpdate: (newText: string) => void
  ) => {
    if (!textarea) {
      onUpdate(currentText ? currentText + ' [[Fachbegriff]]' : '[[Fachbegriff]]');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== undefined && end !== undefined && start !== end) {
      const selected = currentText.substring(start, end);
      const replaced = currentText.substring(0, start) + `[[${selected}]]` + currentText.substring(end);
      onUpdate(replaced);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + selected.length + 4);
      }, 0);
    } else {
      const pos = start !== undefined ? start : currentText.length;
      const placeholder = '[[Fachbegriff]]';
      const inserted = currentText.substring(0, pos) + placeholder + currentText.substring(pos);
      onUpdate(inserted);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(pos + 2, pos + 13);
      }, 0);
    }
  };

  // Active math helper index (-1 if none open)
  const [activeMathHelperHintIndex, setActiveMathHelperHintIndex] = useState<number | null>(null);
  // Active math helper for taskContext
  const [isTaskMathHelperOpen, setIsTaskMathHelperOpen] = useState<boolean>(false);

  // AI Stepped Hints Generation loading & state
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState<boolean>(false);

  // Individual QR Code Design state for this Lernhilfe
  const [hasCustomQrDesign, setHasCustomQrDesign] = useState<boolean>(() => !!initialItem?.qr_design);
  const [qrDesign, setQrDesign] = useState<QrDesignSettings>(() => getEffectiveQrDesign(initialItem));
  const [isQrSectionOpen, setIsQrSectionOpen] = useState<boolean>(() => !!initialItem?.qr_design);
  const previewQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Live render QR Preview on preview tab
  useEffect(() => {
    if (previewTab === 'preview' && previewQrCanvasRef.current) {
      const studentUrl = buildStudentUrl(numericId);
      const activeDesign = hasCustomQrDesign ? qrDesign : getQrDesignSettings();
      renderStyledQrCode(previewQrCanvasRef.current, studentUrl, {
        size: 240,
        customSettings: activeDesign,
      }).catch((e) => console.error('Preview QR render error:', e));
    }
  }, [previewTab, numericId, hasCustomQrDesign, qrDesign]);

  // AI Task & Math Text Extraction state
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [extractStatusText, setExtractStatusText] = useState<string>('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [autoExtractOnUpload, setAutoExtractOnUpload] = useState<boolean>(false);
  const lastLocalDataUrlRef = useRef<string | null>(null);

  // Extract task text and math formulas from image (supports both server AI and 100% server-independent browser OCR)
  const handleExtractText = async (imageToUse?: string, forceBrowser = false) => {
    const img = imageToUse || lastLocalDataUrlRef.current || taskImage;
    if (!img) {
      setExtractError('Bitte wähle zuerst ein Aufgaben-Foto oder Screenshot aus oder füge ihn per Strg+V ein.');
      return;
    }

    setIsExtractingText(true);
    setExtractError(null);
    setExtractSuccess(null);
    setExtractStatusText(
      forceBrowser
        ? 'Browser-Texterkennung aktiv (100% serverunabhängig)...'
        : 'Analysiere Aufgabentext & Formeln...'
    );

    try {
      const data = await extractTaskTextFromImage(img, forceBrowser, (_pct, status) => {
        setExtractStatusText(status);
      });
      if (!data.extractedText || data.extractedText.trim().length === 0) {
        throw new Error('Es konnte kein Text auf dem Bild erkannt werden. Bitte stelle sicher, dass die Aufgabe scharf und gut lesbar ist.');
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

      setExtractSuccess(
        forceBrowser
          ? 'Aufgabentext & Formeln erfolgreich serverunabhängig im Browser verschriftlicht!'
          : 'Aufgabentext & Formeln erfolgreich aus dem Bild verschriftlicht!'
      );
    } catch (err: any) {
      setExtractError(err.message || 'Fehler beim Extrahieren des Aufgabentexts.');
    } finally {
      setIsExtractingText(false);
      setExtractStatusText('');
    }
  };

  // Handle Task Image Upload with Canvas compression (1600x1600, 0.88 for ultra-sharp math symbols)
  const handleTaskImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 1600, 1600, 0.88);
      lastLocalDataUrlRef.current = compressed.dataUrl;
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
        handleExtractText(compressed.dataUrl);
      }
    } catch (err: any) {
      console.error('Bildverarbeitungsfehler:', err);
      setExtractError('Bild konnte nicht verarbeitet werden: ' + (err?.message || 'Unbekannter Fehler'));
    }
  };

  // Handle screenshot pasted directly from clipboard (e.g. Snipping Tool, Screenshot, Ctrl+V)
  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImage(file, 1600, 1600, 0.88);
            lastLocalDataUrlRef.current = compressed.dataUrl;
            let targetUrl = compressed.dataUrl;
            try {
              const cloudUrl = await uploadMediaToSupabase(compressed.blob, `task_pasted_${Date.now()}.jpg`);
              if (cloudUrl) targetUrl = cloudUrl;
            } catch {
              // Ignore upload error, use dataUrl
            }
            setTaskImage(targetUrl);
            setExtractSuccess('Screenshot aus Zwischenablage eingefügt! KI liest Text...');
            handleExtractText(compressed.dataUrl);
          } catch (err: any) {
            setExtractError('Screenshot konnte nicht verarbeitet werden: ' + err.message);
          }
          break;
        }
      }
    }
  };

  // Add new hint
  const handleAddHint = () => {
    setHints([
      ...hints,
      {
        id: 'hint-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: 'Weiterer Denkanstoß',
        text: '',
        mediaType: 'none',
      },
    ]);
  };

  // Remove hint
  const handleRemoveHint = (index: number) => {
    if (hints.length <= 1) {
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

  // Adjust GeoGebra height / vertical cropping to trim white space
  const handleGeoGebraHeightChange = (index: number, newHeight: number) => {
    const currentMediaData = hints[index]?.mediaData;
    if (!currentMediaData) return;
    const currentDims = getGeoGebraDimensions(currentMediaData);
    const clampedHeight = Math.max(220, Math.min(1000, Math.round(newHeight)));
    const updated = parseGeoGebraUrl(currentMediaData, currentDims.width, clampedHeight);
    if (updated) {
      handleUpdateHint(index, { mediaData: updated });
    }
  };

  // Interactive drag-handle for GeoGebra preview to trim white space directly
  const handlePreviewPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    index: number
  ) => {
    e.preventDefault();
    const currentMediaData = hints[index]?.mediaData;
    if (!currentMediaData) return;
    const currentDims = getGeoGebraDimensions(currentMediaData);
    const startY = e.clientY;
    const startHeight = currentDims.height;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaY = ev.clientY - startY;
      const nextH = Math.max(220, Math.min(1000, Math.round((startHeight + deltaY * 1.6) / 10) * 10));
      const updated = parseGeoGebraUrl(currentMediaData, currentDims.width, nextH);
      if (updated) {
        handleUpdateHint(index, { mediaData: updated });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
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
      console.error('Fehler bei der Bildkompression:', err);
    }
  };

  // AI Generator trigger with overwrite confirmation
  const handleTriggerAiGeneration = () => {
    // Check if user already has non-empty or customized hints
    const hasExistingContent =
      hints.length > 0 &&
      hints.some(
        (h) =>
          h.text.trim().length > 0 ||
          (h.title &&
            h.title !== 'Tipp 1' &&
            h.title !== 'Problemstellung erfassen & Skizze anfertigen')
      );

    if (hasExistingContent) {
      setShowOverwriteConfirm(true);
    } else {
      executeGenerateAiHints();
    }
  };

  const executeGenerateAiHints = async () => {
    setShowOverwriteConfirm(false);

    let effectiveContext = taskContext.trim();
    let effectiveTitle = title.trim();

    // If teacher hasn't typed anything yet, provide a friendly default task based on selected subject
    if (!effectiveContext && !effectiveTitle && !taskImage) {
      if (subject === 'Deutsch') {
        effectiveTitle = 'Textanalyse & Argumentation';
        effectiveContext =
          'Analysiere den vorliegenden Textauszug und arbeite die zentrale These und Begründungsstruktur heraus.';
      } else if (subject === 'Englisch') {
        effectiveTitle = 'Reading Comprehension & Analysis';
        effectiveContext =
          'Explain the character’s motivation and analyze their behavior in the given excerpt.';
      } else if (subject === 'Biologie') {
        effectiveTitle = 'Zellbiologie & Fotosynthese';
        effectiveContext =
          'Beschreibe die lichtabhängigen und lichtunabhängigen Reaktionen der Fotosynthese in den Chloroplasten.';
      } else if (subject === 'Physik') {
        effectiveTitle = 'Gleichförmig beschleunigte Bewegung';
        effectiveContext =
          'Ein Fahrzeug bremst mit konstanter Verzögerung. Berechne Bremszeit und Anhalteweg aus 50 km/h.';
      } else if (subject === 'Chemie') {
        effectiveTitle = 'Stöchiometrische Reaktionsberechnung';
        effectiveContext =
          'Gleiche die Verbrennungsgleichung aus und berechne die Stoffmenge des entstehenden Gases.';
      } else if (
        subject === 'Geschichte' ||
        subject === 'Wirtschaft-Politik' ||
        subject === 'Sozialwissenschaften'
      ) {
        effectiveTitle = 'Historische Quellenanalyse & Urteilsbildung';
        effectiveContext =
          'Arbeite aus der Quelle die Position des Verfassers heraus und beurteile die Argumentation historisch.';
      } else if (subject === 'Mathematik') {
        effectiveTitle = 'Satz des Pythagoras: Hypotenuse berechnen';
        effectiveContext =
          'Eine 5 m lange Feuerwehrleiter wird an einer Wand aufgestellt. Der Fußpunkt ist 3 m von der Hauswand entfernt. In welcher Höhe berührt die Leiter die Wand?';
      } else {
        effectiveTitle = 'Problemstellung & Lösungsstrategie';
        effectiveContext =
          'Erarbeite schrittweise eine begründete und strukturierte Lösung zur Aufgabenstellung.';
      }
      setTitle(effectiveTitle);
      setTaskContext(effectiveContext);
    } else if (!effectiveContext && effectiveTitle) {
      effectiveContext = `Aufgabe zum Thema: ${effectiveTitle}`;
    }

    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const result = await generateSteppedHintsWithAI(
        effectiveContext,
        effectiveTitle || 'Aufgabe',
        taskImage
      );

      // Convert generated hints to Hint items with optional media
      const newHints: Hint[] = result.hints.map((gh, idx) => ({
        id: 'hint-ai-' + Date.now() + '-' + idx,
        title: gh.title,
        text: gh.text,
        mediaType:
          gh.mediaType && ['image', 'audio', 'youtube', 'geogebra', 'h5p'].includes(gh.mediaType)
            ? gh.mediaType
            : 'none',
        mediaData: gh.mediaData || undefined,
      }));

      // Strictly overwrite all previous hint cards with the new ones
      setHints(newHints);

      const mediaCount = newHints.filter((h) => h.mediaType && h.mediaType !== 'none').length;
      const mediaNote =
        mediaCount > 0
          ? ` (inkl. ${mediaCount} passendem didaktischen Medium)`
          : '';

      if (result.engineUsed === 'user_gemini') {
        setAiSuccessMessage(
          `✨ ${newHints.length} gestufte Tipps mit Google Gemini generiert${mediaNote}!`
        );
      } else if (result.engineUsed === 'server_gemini') {
        setAiSuccessMessage(
          `✨ ${newHints.length} gestufte Tipps mit Gemini generiert${mediaNote}!`
        );
      } else {
        setAiSuccessMessage(
          `✨ ${newHints.length} gestufte Tipps erfolgreich mit didaktischer KI generiert${mediaNote}!`
        );
      }
      setTimeout(() => setAiSuccessMessage(null), 6000);
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
      id: numericId || initialItem?.id || generateNumericLernhilfeId(),
      title: title.trim(),
      subject: subject.trim(),
      grade_level: resolvedGrade || undefined,
      group_name: groupName.trim() || undefined,
      task_context: taskContext.trim(),
      task_image: taskImage,
      disclosure_mode: disclosureMode,
      hints,
      glossary: Object.keys(glossary).length > 0 ? glossary : undefined,
      qr_design: hasCustomQrDesign ? qrDesign : undefined,
      created_at: initialItem?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(item);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto my-6">
      {/* Editor Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {initialItem ? 'Lernhilfe bearbeiten' : 'Neue Lernhilfe erstellen'}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                Lernhilfe-Code:
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-indigo-900 dark:text-indigo-100 tracking-wider select-all">
                {numericId}
              </span>
              <button
                type="button"
                onClick={() => setNumericId(generateNumericLernhilfeId())}
                title="Neuen 6-stelligen Zahlencode automatisch generieren"
                className="p-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-md transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Didaktischer Tippkarten-Editor
          </h2>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
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
            title="Schließen"
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
              {taskContext && (
                <LaTeXRenderer
                  content={taskContext}
                  glossary={glossary}
                  onTermClick={(term, def) => setPreviewGlossaryModal({ term, definition: def })}
                />
              )}
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
                    {(() => {
                      const raw = (h.title || '').trim();
                      // Strip any leading "Tipp X:" or "Tipp X." or "Tipp X"
                      let cleanTitle = raw.replace(/^Tipp\s*\d+[:.]?\s*/i, '').trim();
                      cleanTitle = cleanTitle.replace(/^Tipp\s*\d*[:.]?\s*/i, '').trim();

                      if (!cleanTitle) {
                        return (
                          <span className="break-words font-extrabold text-slate-900 dark:text-slate-100">
                            Tipp {i + 1}
                          </span>
                        );
                      }

                      return (
                        <span className="break-words font-extrabold text-slate-900 dark:text-slate-100">
                          Tipp {i + 1}: <span className="font-semibold text-slate-700 dark:text-slate-300">{cleanTitle}</span>
                        </span>
                      );
                    })()}
                    {h.pin && (
                      <span className="text-xs text-amber-600 font-mono bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                        PIN: {h.pin}
                      </span>
                    )}
                  </div>
                  {h.text ? (
                    <LaTeXRenderer
                      content={h.text}
                      glossary={glossary}
                      onTermClick={(term, def) => setPreviewGlossaryModal({ term, definition: def })}
                    />
                  ) : (
                    <span className="text-slate-400 italic text-xs">Noch kein Text eingetragen.</span>
                  )}
                </div>
              ))}
            </div>

            {/* Live QR-Code Preview Card */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-center shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" />
                  <span>Schüler-Zugang &amp; QR-Code</span>
                </span>
                {hasCustomQrDesign ? (
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                    Individuelles Design aktiv
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Globales Standard-Design
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-flex items-center justify-center">
                  <canvas
                    ref={previewQrCanvasRef}
                    width={240}
                    height={240}
                    style={{ width: '180px', height: '180px', aspectRatio: '1 / 1', display: 'block' }}
                    className="rounded-lg shrink-0"
                  />
                </div>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 inline-block font-mono text-xs font-bold text-indigo-900 dark:text-indigo-200">
                Lernhilfe-Code: {numericId}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Schüler scannen diesen QR-Code oder tippen den 6-stelligen Code auf der Startseite ein.
              </p>
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
                  <option value="Wirtschaft-Politik">Wirtschaft-Politik</option>
                  <option value="Sozialwissenschaften">Sozialwissenschaften</option>
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
                        <span>Text aus Foto</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    handleInsertTermBrackets(taskTextareaRef.current, taskContext, setTaskContext)
                  }
                  className="text-xs flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/60 transition-all shadow-2xs"
                  title="Markierten Text oder neuen Fachbegriff in [[...]] setzen für interaktives Schüler-Glossar"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>[[Fachbegriff]]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaskMathHelperOpen(!isTaskMathHelperOpen)}
                  className={`text-xs flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    isTaskMathHelperOpen
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                      : 'text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                  title={isTaskMathHelperOpen ? 'Formel-Editor schließen' : 'Formel-Editor öffnen'}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{isTaskMathHelperOpen ? 'Formel-Editor schließen' : 'Formel einfügen'}</span>
                </button>
              </div>
            </div>

            {isTaskMathHelperOpen && (
              <MathFormulaHelper
                onInsertFormula={(snippet) =>
                  setTaskContext((prev) => (prev ? prev + ' ' + snippet : snippet))
                }
                onClose={() => setIsTaskMathHelperOpen(false)}
              />
            )}

            <textarea
              rows={Math.max(3, (taskContext || '').split('\n').length + Math.ceil((taskContext || '').length / 60))}
              value={taskContext}
              onPaste={handlePasteImage}
              onChange={(e) => {
                setTaskContext(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.max(88, e.target.scrollHeight)}px`;
              }}
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${Math.max(88, target.scrollHeight)}px`;
              }}
              ref={(el) => {
                taskTextareaRef.current = el;
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.max(88, el.scrollHeight)}px`;
                }
              }}
              placeholder="Hier den Aufgabentext eintragen (oder Foto aufnehmen / Screenshot per Strg+V einfügen, um Text & Formeln automatisch zu extrahieren)... Nutze [[Fachbegriff]] für interaktive Mini-Definitionen!"
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed overflow-hidden transition-[height] duration-75"
              style={{ minHeight: '88px', overflowY: 'hidden' }}
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
                  Foto oder Screenshot der Aufgabe (optional):
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
                  <span>Screenshot / Datei wählen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTaskImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                💡 <strong>Tipp:</strong> Screenshots können auch einfach mit <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-mono">Strg+V</kbd> (bzw. <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-mono">Cmd+V</kbd>) direkt aus der Zwischenablage eingefügt werden.
              </p>

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
                    {/* Single clear extraction button with automatic fallback under the hood */}
                    <button
                      type="button"
                      disabled={isExtractingText}
                      onClick={() => handleExtractText()}
                      className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition"
                      title="Extrahiert den Aufgabentext und mathematische Formeln automatisch aus dem Foto"
                    >
                      {isExtractingText ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Text wird extrahiert...</span>
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
                  onClick={handleTriggerAiGeneration}
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
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  Kostenloses KI-Modell aktiv
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors underline flex items-center gap-1"
                >
                  <span>Optionen &amp; KI-Einstellungen</span>
                </button>
              </div>
            </div>

            {aiSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{aiSuccessMessage}</span>
              </div>
            )}

            {aiError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
                {aiError}
              </div>
            )}
          </div>

          {/* Stepped Hints Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
                className="self-start sm:self-auto px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tipp hinzufügen</span>
              </button>
            </div>

            {/* Mode selection for hint disclosure */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Tipp-Freischaltung für Schüler:
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {disclosureMode === 'stepped'
                    ? '🎯 Gestuft: Schüler decken die Tipps nacheinander per Klick auf (Didaktische Stufung).'
                    : '📖 Alle direkt sichtbar: Alle Tipps sind von Anfang an aufgelistet (standardmäßig alle eingeklappt).'}
                </span>
              </div>
              <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setDisclosureMode('stepped')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    disclosureMode === 'stepped'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Nach &amp; nach (Gestuft)
                </button>
                <button
                  type="button"
                  onClick={() => setDisclosureMode('all_visible')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    disclosureMode === 'all_visible'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Alle Tipps direkt sichtbar
                </button>
              </div>
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
                      Tipp-Überschrift (ohne „Tipp ${index + 1}:“ eingeben):
                    </label>
                    <input
                      type="text"
                      value={hint.title}
                      onChange={(e) => handleUpdateHint(index, { title: e.target.value })}
                      placeholder="z.B. Problemstellung erfassen &amp; Skizze anfertigen"
                      className="w-full font-bold text-base sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                  </div>

                  {/* Math Formula Helper for this hint */}
                  {activeMathHelperHintIndex === index && (
                    <MathFormulaHelper
                      onInsertFormula={(snippet) =>
                        handleUpdateHint(index, {
                          text: hint.text ? hint.text + ' ' + snippet : snippet,
                        })
                      }
                      onClose={() => setActiveMathHelperHintIndex(null)}
                    />
                  )}

                  {/* Hint Text Area */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Erklärung / Leitfrage (mit Mathe in $formel$ oder [[Fachbegriff]]):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleInsertTermBrackets(
                              hintTextareaRefs.current[index] || null,
                              hint.text,
                              (newText) => handleUpdateHint(index, { text: newText })
                            )
                          }
                          className="text-xs flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/60 transition-all shadow-2xs"
                          title="Markierten Begriff oder neuen Fachbegriff in [[...]] setzen"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>[[Fachbegriff]]</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMathHelperHintIndex(
                              activeMathHelperHintIndex === index ? null : index
                            )
                          }
                          className={`text-xs flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            activeMathHelperHintIndex === index
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                              : 'text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          }`}
                          title={
                            activeMathHelperHintIndex === index
                              ? 'Formel-Assistent schließen'
                              : 'Formel-Assistent öffnen'
                          }
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>
                            {activeMathHelperHintIndex === index
                              ? 'Formel schließen'
                              : 'Formel einfügen'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={Math.max(3, (hint.text || '').split('\n').length + Math.ceil((hint.text || '').length / 60))}
                      value={hint.text}
                      onChange={(e) => {
                        handleUpdateHint(index, { text: e.target.value });
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.max(88, e.target.scrollHeight)}px`;
                      }}
                      onInput={(e) => {
                        const target = e.currentTarget;
                        target.style.height = 'auto';
                        target.style.height = `${Math.max(88, target.scrollHeight)}px`;
                      }}
                      ref={(el) => {
                        hintTextareaRefs.current[index] = el;
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${Math.max(88, el.scrollHeight)}px`;
                        }
                      }}
                      placeholder="Erklärung, Denkanstoß oder Leitfrage eingeben... Nutze [[Fachbegriff]] für ein klickbares Schüler-Glossar!"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed overflow-hidden transition-[height] duration-75"
                      style={{ minHeight: '88px', overflowY: 'hidden' }}
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
                        placeholder="z.B. 4112 oder leer lassen"
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
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          YouTube-Link oder Iframe:
                        </label>
                        {hint.mediaData && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: '' })}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 px-2 py-0.5 rounded-md transition-colors"
                            title="YouTube-Link entfernen"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Link löschen</span>
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={hint.mediaData || ''}
                          onChange={(e) => {
                            const parsed = parseYouTubeUrl(e.target.value) || e.target.value;
                            handleUpdateHint(index, { mediaData: parsed });
                          }}
                          placeholder="https://www.youtube.com/watch?v=... oder https://youtu.be/..."
                          className="w-full pl-3 pr-10 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        {hint.mediaData && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: '' })}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Eingabe leeren"
                            aria-label="Eingabe leeren"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Wird automatisch zu datenschutzfreundlichem youtube-nocookie.com/embed konvertiert.
                      </p>
                    </div>
                  )}

                  {hint.mediaType === 'geogebra' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          GeoGebra URL / Iframe:
                        </label>
                        <div className="flex items-center gap-2">
                          {hint.mediaData && (
                            <button
                              type="button"
                              onClick={() => handleUpdateHint(index, { mediaData: '' })}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 px-2 py-0.5 rounded-md transition-colors"
                              title="GeoGebra-Link entfernen"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Link löschen</span>
                            </button>
                          )}
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            Link, ID oder &lt;iframe&gt;
                          </span>
                        </div>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={hint.mediaData || ''}
                          onChange={(e) => {
                            const parsed = parseGeoGebraUrl(e.target.value) || e.target.value;
                            handleUpdateHint(index, { mediaData: parsed });
                          }}
                          placeholder="https://www.geogebra.org/m/... oder <iframe>"
                          className="w-full pl-3 pr-10 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        {hint.mediaData && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: '' })}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Eingabe leeren"
                            aria-label="Eingabe leeren"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Format / Width & Height Optimization Presets & Live Preview */}
                      {hint.mediaData && (() => {
                        const currentDims = getGeoGebraDimensions(hint.mediaData);
                        return (
                          <div className="p-3 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl space-y-3 border border-slate-200/80 dark:border-slate-700/80">
                            {/* 1. Width Presets */}
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  1. Breite &amp; Seitenverhältnis:
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                                  {currentDims.width} × {currentDims.height} px
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                                {[
                                  { label: 'Breitbild (16:10)', w: 960, h: currentDims.height, desc: 'Empfohlen' },
                                  { label: 'Klassisch (4:3)', w: 800, h: currentDims.height, desc: 'Standard' },
                                  { label: 'Extra Breit (16:9)', w: 1100, h: currentDims.height, desc: 'Für weite Modelle' },
                                  { label: 'Kompakt', w: 720, h: currentDims.height, desc: 'Mobil' },
                                ].map((preset) => {
                                  const isSelected = currentDims.width === preset.w;
                                  return (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      onClick={() => {
                                        const updated = parseGeoGebraUrl(hint.mediaData!, preset.w, currentDims.height);
                                        if (updated) handleUpdateHint(index, { mediaData: updated });
                                      }}
                                      className={`px-2 py-1.5 rounded-lg border text-left transition-all ${
                                        isSelected
                                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold ring-1 ring-indigo-400'
                                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="text-[11px] leading-tight">{preset.label}</div>
                                      <div className="text-[10px] text-slate-400">{preset.w} px breit</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Manual Height / Vertical Cutoff Slider & Stepper (Trim White Space) */}
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>2. Höhe anpassen (weiße Fläche unten trimmen):</span>
                                </span>
                                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60">
                                  Höhe: {currentDims.height} px
                                </span>
                              </div>

                              {/* Interactive Slider and Stepper Buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleGeoGebraHeightChange(index, currentDims.height - 30)}
                                  className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 flex items-center gap-1 shadow-2xs"
                                  title="Höhe um 30px verringern (unten abschneiden)"
                                >
                                  <Minus className="w-3 h-3" />
                                  <span>30 px</span>
                                </button>
                                <input
                                  type="range"
                                  min="220"
                                  max="850"
                                  step="10"
                                  value={currentDims.height}
                                  onChange={(e) =>
                                    handleGeoGebraHeightChange(index, parseInt(e.target.value, 10))
                                  }
                                  className="flex-1 accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                                  aria-label="GeoGebra Höhe anpassen"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleGeoGebraHeightChange(index, currentDims.height + 30)}
                                  className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 flex items-center gap-1 shadow-2xs"
                                  title="Höhe um 30px vergrößern (mehr nach unten zeigen)"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>30 px</span>
                                </button>
                              </div>

                              {/* Height Quick Presets */}
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
                                <span className="text-slate-400 text-[10px] mr-1">Höhen-Presets:</span>
                                {[
                                  { label: 'Flach (360 px)', h: 360, desc: 'wenig weiß' },
                                  { label: 'Mittel (460 px)', h: 460, desc: 'kompakt' },
                                  { label: 'Standard (580 px)', h: 580, desc: 'normal' },
                                  { label: 'Hoch (700 px)', h: 700, desc: 'groß' },
                                ].map((hp) => (
                                  <button
                                    key={hp.label}
                                    type="button"
                                    onClick={() => handleGeoGebraHeightChange(index, hp.h)}
                                    className={`px-2 py-0.5 rounded-md border text-[10px] font-medium transition-colors ${
                                      Math.abs(currentDims.height - hp.h) < 15
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {hp.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 3. Live Preview within the Editor */}
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Live-Vorschau (Ansicht für Schüler)</span>
                                </span>
                                <a
                                  href={hint.mediaData}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                >
                                  <span>Extern öffnen</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>

                              {/* Preview Frame with Resizable Bottom Bar */}
                              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shadow-xs">
                                <div
                                  className="relative w-full overflow-hidden"
                                  style={{
                                    aspectRatio: currentDims.aspectRatio,
                                    maxHeight: '480px',
                                  }}
                                >
                                  <iframe
                                    src={parseGeoGebraUrl(hint.mediaData) || hint.mediaData}
                                    title="GeoGebra Modell Vorschau"
                                    allowFullScreen
                                    allow="fullscreen; clipboard-read; clipboard-write;"
                                    className="w-full h-full border-0 block"
                                  />
                                </div>
                                {/* Interactive Resizer Handle directly below preview */}
                                <div
                                  onPointerDown={(e) => handlePreviewPointerDown(e, index)}
                                  className="cursor-ns-resize select-none bg-slate-100 dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border-t border-slate-200 dark:border-slate-700 py-1.5 px-3 flex items-center justify-center gap-2 text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors"
                                  title="Gedrückt halten und nach oben/unten ziehen, um die Höhe anzupassen"
                                >
                                  <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-500" />
                                  <span className="font-medium">Unten ziehen zum Zuschneiden der Höhe</span>
                                  <span className="font-mono text-[10px] text-slate-400">({currentDims.height} px)</span>
                                </div>
                              </div>

                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                                💡 <strong>Weiße Fläche unten wegschneiden:</strong> Verringere die Höhe mit dem Regler (z. B. auf 360–460 px) oder ziehe den unteren Rand nach oben, bis die Zeichnung bündig abschließt. Die Schüler sehen das Modell genau in diesem optimierten Zuschnitt!
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {hint.mediaType === 'h5p' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          H5P URL / Iframe:
                        </label>
                        {hint.mediaData && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: '' })}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 px-2 py-0.5 rounded-md transition-colors"
                            title="H5P-Link entfernen"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Link löschen</span>
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={hint.mediaData || ''}
                          onChange={(e) => {
                            const parsed = parseH5PUrl(e.target.value) || e.target.value;
                            handleUpdateHint(index, { mediaData: parsed });
                          }}
                          placeholder="https://h5p.org/h5p/embed/... oder <iframe>"
                          className="w-full pl-3 pr-10 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        {hint.mediaData && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHint(index, { mediaData: '' })}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 sm:p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Eingabe leeren"
                            aria-label="Eingabe leeren"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Live Preview for H5P */}
                      {hint.mediaData && (
                        <div className="p-2.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200/80 dark:border-slate-700/80">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Live-Vorschau (H5P Übung)</span>
                            </span>
                            <a
                              href={hint.mediaData}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                              <span>Extern öffnen</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white min-h-[260px] max-h-[420px]">
                            <iframe
                              src={parseH5PUrl(hint.mediaData) || hint.mediaData}
                              title="H5P Übung Vorschau"
                              allowFullScreen
                              className="w-full h-full border-0 block"
                            />
                          </div>
                        </div>
                      )}
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

          {/* Fachbegriffe & Mini-Glossar (KI-unterstützte Definitionen) */}
          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>Fachbegriffe &amp; Mini-Glossar</span>
                      <span className="text-yellow-500">✨</span>
                    </h3>
                    {detectedTerms.length > 0 ? (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                        {detectedTerms.length} {detectedTerms.length === 1 ? 'Begriff' : 'Begriffe'} erkannt
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        Keine [[Begriffe]] markiert
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Wörter in doppelten eckigen Klammern wie <code className="bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">[[Fachbegriff]]</code> werden für Schüler gepunktet unterstrichen. Beim Antippen erscheint eine schülergerechte Mini-Definition – <em>ohne</em> dass ein Tipp verbraucht wird!
                  </p>
                </div>
              </div>

              {/* Toggle expand/collapse button */}
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGlossarySectionOpen(!isGlossarySectionOpen)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-1.5 transition-colors"
                >
                  <span>{isGlossarySectionOpen ? 'Einklappen' : 'Verwalten'}</span>
                  {isGlossarySectionOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {isGlossarySectionOpen && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingGlossary || detectedTerms.length === 0}
                      onClick={() => handleGenerateGlossaryAi()}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
                      title="Erstellt mit KI schülergerechte 1-3 Sätze Definitionen für alle erkannten Fachbegriffe"
                    >
                      {isGeneratingGlossary ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>KI formuliert Definitionen...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                          <span>Alle Begriffe mit KI definieren</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Manual add term */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCustomTerm}
                      onChange={(e) => setNewCustomTerm(e.target.value)}
                      placeholder="Begriff manuell ergänzen..."
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-52"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = newCustomTerm.trim();
                          if (trimmed) {
                            setGlossary((prev) => ({ ...prev, [trimmed]: prev[trimmed] || '' }));
                            setNewCustomTerm('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newCustomTerm.trim();
                        if (trimmed) {
                          setGlossary((prev) => ({ ...prev, [trimmed]: prev[trimmed] || '' }));
                          setNewCustomTerm('');
                        }
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      + Hinzufügen
                    </button>
                  </div>
                </div>

                {/* Notifications */}
                {glossarySuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{glossarySuccess}</span>
                  </div>
                )}
                {glossaryError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{glossaryError}</span>
                  </div>
                )}

                {/* Terms List or Empty State */}
                {detectedTerms.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 space-y-2">
                    <div className="text-2xl">✨</div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Noch keine Fachbegriffe in [[Klammern]] im Text oder in den Tipps markiert.
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      Klicke oben auf den Button <span className="font-semibold text-indigo-600 dark:text-indigo-400">[[Fachbegriff]]</span> oder schreibe z. B.{' '}
                      <code className="text-indigo-600 dark:text-indigo-400 font-mono">[[Hypotenuse]]</code>,{' '}
                      <code className="text-indigo-600 dark:text-indigo-400 font-mono">[[Scheitelpunkt]]</code> oder{' '}
                      <code className="text-indigo-600 dark:text-indigo-400 font-mono">[[Subsidiaritätsprinzip]]</code> direkt in deine Erklärung.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detectedTerms.map((term) => {
                      const definition = glossary[term] || '';
                      const isGeneratingThis = generatingTerm === term;
                      return (
                        <div
                          key={term}
                          className="p-3.5 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                [[{term}]]
                              </span>
                              {definition.trim() ? (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Definition hinterlegt</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                  Noch keine Definition
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isGeneratingThis || isGeneratingGlossary}
                                onClick={() => handleGenerateGlossaryAi(term)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                title="Definition für diesen Begriff mit KI generieren"
                              >
                                {isGeneratingThis ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                    <span>Generiere...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                    <span>{definition ? 'Mit KI neu generieren' : 'Mit KI definieren'}</span>
                                  </>
                                )}
                              </button>
                              {definition && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGlossary((prev) => {
                                      const next = { ...prev };
                                      delete next[term];
                                      return next;
                                    });
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                                  title="Definition leeren"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Editable Textarea for Definition */}
                          <textarea
                            rows={2}
                            value={definition}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGlossary((prev) => ({
                                ...prev,
                                [term]: val,
                              }));
                            }}
                            placeholder={`Schreibe hier die didaktische Mini-Definition für „${term}“ (1-3 verständliche Sätze) oder klicke auf 'Mit KI definieren'...`}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                          />

                          {/* Live preview of definition KaTeX */}
                          {definition && (definition.includes('$') || definition.includes('\\')) && (
                            <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-indigo-100 dark:border-indigo-900/50">
                              <span className="text-[10px] font-bold text-indigo-500 block mb-0.5">Formel-Vorschau:</span>
                              <LaTeXRenderer content={definition} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom QR-Code Design Card for this specific Lernhilfe */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      QR-Code Design für diese Lernhilfe
                    </h3>
                    {hasCustomQrDesign ? (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                        Eigenes Design aktiv
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        Globales Standard-Design
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Wähle, ob diese Lernhilfe das globale Standard-Design oder ein eigenes individuelles QR-Code-Design nutzt.
                  </p>
                </div>
              </div>

              {/* Toggle expand/collapse button */}
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasCustomQrDesign) {
                      setHasCustomQrDesign(true);
                      setIsQrSectionOpen(true);
                    } else {
                      setIsQrSectionOpen(!isQrSectionOpen);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors ${
                    hasCustomQrDesign
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    {hasCustomQrDesign
                      ? isQrSectionOpen
                        ? 'Designer schließen'
                        : 'Design anpassen'
                      : 'Eigenes Design festlegen'}
                  </span>
                  {isQrSectionOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Design Type Switcher & Full Designer */}
            {isQrSectionOpen && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHasCustomQrDesign(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      !hasCustomQrDesign
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        !hasCustomQrDesign ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                      }`}
                    >
                      {!hasCustomQrDesign && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Standard-Design verwenden</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Übernimmt automatisch das in den Haupt-Einstellungen konfigurierte Design.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHasCustomQrDesign(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      hasCustomQrDesign
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        hasCustomQrDesign ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                      }`}
                    >
                      {hasCustomQrDesign && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Eigenes Design nur für diese Lernhilfe</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Rahmen, Farben &amp; Center-Logo individuell anpassen.
                      </div>
                    </div>
                  </button>
                </div>

                {/* Render the full interactive QrCodeDesigner if hasCustomQrDesign is enabled */}
                {hasCustomQrDesign && (
                  <div className="pt-2 animate-in fade-in">
                    <QrCodeDesigner
                      settings={qrDesign}
                      onChange={setQrDesign}
                      demoUrl={buildStudentUrl(numericId)}
                      isIndividual={true}
                      onResetToGlobalDefault={() => {
                        const globalSettings = getQrDesignSettings();
                        setQrDesign(globalSettings);
                        setHasCustomQrDesign(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
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

      {/* Warning Confirmation Modal: Overwrite Existing Hints with AI */}
      {showOverwriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Bestehende Tipps überschreiben?
                </h3>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium block">
                  Achtung: Vorhandene Inhalte werden ersetzt
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Es sind bereits <strong>{hints.length} Tippkarte(n)</strong> für diese Lernhilfe vorhanden. Wenn du fortfährst, werden alle bisherigen Tipps gelöscht und durch die neu generierten didaktischen KI-Tipps vollständig überschrieben.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverwriteConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={executeGenerateAiHints}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ja, alle Tipps überschreiben</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-Lexikon Vorschau Modal */}
      {previewGlossaryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewGlossaryModal(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/60 overflow-hidden flex flex-col animate-in zoom-in-95 sm:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white/15 backdrop-blur-sm text-yellow-300">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-indigo-200">
                    Mini-Definition • Vorschau
                  </div>
                  <h3 className="text-lg font-bold leading-tight">
                    {previewGlossaryModal.term}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewGlossaryModal(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {previewGlossaryModal.definition ? (
                  <LaTeXRenderer content={previewGlossaryModal.definition} />
                ) : (
                  <p className="text-slate-500 italic">
                    Für diesen Begriff wurde noch keine Definition hinterlegt.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Verbraucht keinen Schüler-Tipp!
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewGlossaryModal(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
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
