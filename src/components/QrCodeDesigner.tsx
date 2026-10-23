import React, { useState, useEffect, useRef } from 'react';
import {
  QrDesignSettings,
  QrPresetId,
  QrBorderDecoration,
  QR_BORDER_OPTIONS,
  QR_COLOR_PRESETS,
  renderStyledQrCode,
  processUploadedImageAsSketch,
  getDefaultQrDesignSettings,
  getQrDesignSettings,
} from '../utils/qrCodeTheme';
import { convertImageToSketch, SketchStyle } from '../utils/imageSketchConverter';
import {
  Sparkles,
  Upload,
  Trash2,
  Sliders,
  Palette,
  BookOpen,
  GraduationCap,
  Calculator,
  RotateCcw,
  ZoomIn,
  Move,
  Wand2,
  X,
} from 'lucide-react';

interface QrCodeDesignerProps {
  settings: QrDesignSettings;
  onChange: (updated: QrDesignSettings) => void;
  demoUrl?: string;
  isIndividual?: boolean;
  onResetToGlobalDefault?: () => void;
}

export const QrCodeDesigner: React.FC<QrCodeDesignerProps> = ({
  settings,
  onChange,
  demoUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?id=123456`,
  isIndividual = false,
  onResetToGlobalDefault,
}) => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live render QR Preview on canvas whenever settings or demoUrl changes
  useEffect(() => {
    if (canvasRef.current) {
      renderStyledQrCode(canvasRef.current, demoUrl, {
        size: 260,
        customSettings: settings,
      }).catch((e) => console.error('QR Designer preview error:', e));
    }
  }, [settings, demoUrl]);

  // Color preset selector
  const handleSelectColorPreset = (presetId: QrPresetId) => {
    const preset = QR_COLOR_PRESETS[presetId];
    if (!preset) return;
    onChange({
      ...settings,
      preset: presetId,
      name: preset.name,
      darkColor: preset.dark,
      lightColor: preset.light,
    });
  };

  const handleUpdateDarkColor = (color: string) => {
    onChange({
      ...settings,
      preset: 'custom_colors',
      darkColor: color,
    });
  };

  const handleUpdateLightColor = (color: string) => {
    onChange({
      ...settings,
      preset: 'custom_colors',
      lightColor: color,
    });
  };

  // Upload image and convert to sketch
  const handleUploadCustomLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const stroke = settings.sketchStrokeColor || settings.darkColor;
      const res = await processUploadedImageAsSketch(file, {
        style: settings.sketchStyle || 'pencil',
        strokeColor: stroke,
        intensity: settings.sketchIntensity || 3,
      });

      onChange({
        ...settings,
        centerLogoType: 'sketch_drawing',
        rawUploadedImage: res.rawUrl,
        customLogoDataUrl: res.sketchUrl,
        logoZoom: 1.0,
        logoOffsetX: 0,
        logoOffsetY: 0,
        logoFit: 'contain',
      });
    } catch (err: any) {
      console.error('Bild-Verarbeitung fehlgeschlagen:', err);
      setUploadError('Bild-Verarbeitung fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    } finally {
      setUploading(false);
    }
  };

  // Re-generate sketch when style/intensity/color changes
  const updateSketchParameters = async (
    newParams: {
      style?: SketchStyle;
      strokeColor?: string;
      intensity?: number;
      logoZoom?: number;
      logoOffsetX?: number;
      logoOffsetY?: number;
      logoFit?: 'contain' | 'cover';
      badgeShape?: 'circle' | 'rounded';
    }
  ) => {
    const updated = { ...settings, ...newParams };
    onChange(updated);

    if (
      settings.rawUploadedImage &&
      (newParams.style !== undefined ||
        newParams.strokeColor !== undefined ||
        newParams.intensity !== undefined)
    ) {
      setUploading(true);
      try {
        const stroke =
          updated.sketchStrokeColor && updated.sketchStrokeColor.trim()
            ? updated.sketchStrokeColor
            : updated.darkColor;

        const newSketchUrl = await convertImageToSketch(settings.rawUploadedImage, {
          style: updated.sketchStyle || 'pencil',
          strokeColor: stroke,
          intensity: updated.sketchIntensity || 3,
        });

        onChange({
          ...updated,
          customLogoDataUrl: newSketchUrl,
        });
      } catch (err) {
        console.error('Failed to update sketch parameters:', err);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRemoveCustomLogo = () => {
    onChange({
      ...settings,
      centerLogoType: 'none',
      rawUploadedImage: undefined,
      customLogoDataUrl: undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Context banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {isIndividual ? 'Individuelles QR-Code Design' : 'QR-Code Gesamtdesign'}
              {isIndividual && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Nur für diese Lernhilfe
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Passe Rand, Farben und das Zentrum passend zum Thema der Aufgabe an.
            </p>
          </div>
        </div>

        {onResetToGlobalDefault && (
          <button
            type="button"
            onClick={onResetToGlobalDefault}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 font-medium transition shadow-2xs shrink-0"
            title="Setzt das Design auf die globalen Einstellungen zurück"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Auf Standard-Design zurücksetzen</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live QR Preview Canvas (Sticky) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-100/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 lg:sticky lg:top-4">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Live-Vorschau des QR-Codes
          </span>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={260}
              height={260}
              className="w-[220px] h-[220px] sm:w-[240px] sm:h-[240px] rounded-xl"
            />
          </div>

          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              {settings.name || 'Benutzerdefiniertes Design'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              Farben: {settings.darkColor} / {settings.lightColor}
            </span>
          </div>
        </div>

        {/* Right Column: Settings Sections */}
        <div className="lg:col-span-7 space-y-5">
          {/* SEKTION 1: RANDVERZIERUNG */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Didaktischer Schmuckrand &amp; Zierrahmen
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QR_BORDER_OPTIONS.map((border) => {
                const isSelected = settings.borderDecoration === border.id;
                return (
                  <button
                    key={border.id}
                    type="button"
                    onClick={() => onChange({ ...settings, borderDecoration: border.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{border.previewIcon}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">
                        {border.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block line-clamp-2">
                        {border.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEKTION 2: FARBSCHEMA */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Farbschema &amp; Kontraste
              </h5>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Vordergrundfarbe (QR-Punkte):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.darkColor}
                    onChange={(e) => handleUpdateDarkColor(e.target.value)}
                    className="w-10 h-9 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={settings.darkColor}
                    onChange={(e) => handleUpdateDarkColor(e.target.value)}
                    placeholder="#3730A3"
                    maxLength={9}
                    className="flex-1 px-3 py-1.5 font-mono text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Hintergrundfarbe:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.lightColor}
                    onChange={(e) => handleUpdateLightColor(e.target.value)}
                    className="w-10 h-9 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={settings.lightColor}
                    onChange={(e) => handleUpdateLightColor(e.target.value)}
                    placeholder="#FFFFFF"
                    maxLength={9}
                    className="flex-1 px-3 py-1.5 font-mono text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Schnellauswahl beliebter Farbkombinationen:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(QR_COLOR_PRESETS) as QrPresetId[])
                  .filter((pid) => pid !== 'custom_colors')
                  .map((pid) => {
                    const pal = QR_COLOR_PRESETS[pid];
                    const isMatch = settings.darkColor.toLowerCase() === pal.dark.toLowerCase();
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => handleSelectColorPreset(pid)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                          isMatch
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: pal.dark }}
                        />
                        <span>{pal.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* SEKTION 3: ZENTRUM / LOGO / SKIZZE */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                3
              </span>
              <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Zentrum: Vorlagen-Icon oder Foto/Skizze
              </h5>
            </div>

            {/* Center Logo Options: None vs Preset vs Custom Sketch */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    centerLogoType: 'none',
                  })
                }
                className={`p-2 rounded-xl border text-center transition-all ${
                  settings.centerLogoType === 'none'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <span className="text-xs block">Ohne Logo</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    centerLogoType: 'preset_icon',
                    presetIcon: 'book',
                  })
                }
                className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  settings.centerLogoType === 'preset_icon' && settings.presetIcon === 'book'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="text-xs block">Buch-Icon</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    centerLogoType: 'preset_icon',
                    presetIcon: 'math',
                  })
                }
                className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  settings.centerLogoType === 'preset_icon' && settings.presetIcon === 'math'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span className="text-xs block">Mathe-Icon</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    centerLogoType: 'preset_icon',
                    presetIcon: 'graduation',
                  })
                }
                className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  settings.centerLogoType === 'preset_icon' && settings.presetIcon === 'graduation'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span className="text-xs block">Schule-Icon</span>
              </button>
            </div>

            {/* Custom Image / Sketch Upload */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Eigenes Foto / Schullogo als Strichzeichnung:
                </span>
                {settings.rawUploadedImage && (
                  <button
                    type="button"
                    onClick={handleRemoveCustomLogo}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bild entfernen</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-2 transition shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Wird verarbeitet...' : 'Foto / Bild hochladen'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomLogo}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>

                {/* Badge Shape */}
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => updateSketchParameters({ badgeShape: 'circle' })}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      settings.badgeShape === 'circle'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Kreis-Badge
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSketchParameters({ badgeShape: 'rounded' })}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      settings.badgeShape === 'rounded'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Eckig-Badge
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center justify-between gap-2">
                  <span>{uploadError}</span>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg text-rose-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Advanced controls if image is uploaded */}
              {settings.rawUploadedImage && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 animate-in fade-in">
                  {/* Style selector */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Skizzen-Stil:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { id: 'pencil', label: '✏️ Bleistift' },
                        { id: 'ink', label: '✒️ Tinte' },
                        { id: 'outline', label: '📐 Kontur' },
                        { id: 'charcoal', label: '🎨 Kohle' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateSketchParameters({ style: st.id as SketchStyle })}
                          className={`px-2 py-1 text-xs rounded-lg border font-semibold ${
                            (settings.sketchStyle || 'pencil') === st.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zoom slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Größe / Zoom:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {Math.round((settings.logoZoom || 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={220}
                      step={5}
                      value={Math.round((settings.logoZoom || 1.0) * 100)}
                      onChange={(e) =>
                        updateSketchParameters({ logoZoom: Number(e.target.value) / 100 })
                      }
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
