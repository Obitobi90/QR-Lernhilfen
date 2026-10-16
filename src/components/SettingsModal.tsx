import React, { useState, useEffect, useRef } from 'react';
import {
  getStoredGeminiKey,
  saveGeminiKey,
  getStoredGeminiModel,
  saveGeminiModel,
} from '../utils/geminiGenerator';
import {
  getSupabaseSettings,
  saveSupabaseSettings,
  getSupabaseClient,
} from '../utils/supabaseClient';
import {
  getTeacherPin,
  setTeacherPin,
  setTeacherSessionActive,
} from '../utils/teacherAuth';
import {
  isBiometricsSupported,
  isPasskeyEnrolled,
  registerPasskey,
  authenticateWithPasskey,
  removePasskey,
  getBiometricDeviceLabel,
} from '../utils/passkeyAuth';
import {
  QrDesignSettings,
  QrBorderDecoration,
  QR_BORDER_OPTIONS,
  QR_COLOR_PRESETS,
  QrPresetId,
  getQrDesignSettings,
  saveQrDesignSettings,
  renderStyledQrCode,
  processUploadedImageAsSketch,
} from '../utils/qrCodeTheme';
import { SketchStyle } from '../utils/imageSketchConverter';
import { PWAInstallButton } from './PWAInstallButton';
import {
  X,
  Key,
  Database,
  Check,
  AlertCircle,
  Copy,
  Lock,
  LogIn,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Shield,
  Eye,
  EyeOff,
  Fingerprint,
  QrCode,
  Palette,
  Upload,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  Sliders,
  Wand2,
  Edit3,
  Pipette,
  RefreshCw,
  Layers,
} from 'lucide-react';


interface SettingsModalProps {
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSettingsUpdated }) => {
  // Active Tab: 'qr' | 'security' | 'cloud' | 'pwa'
  const [activeTab, setActiveTab] = useState<'qr' | 'security' | 'cloud' | 'pwa'>('qr');

  // QR Design State
  const [qrSettings, setQrSettings] = useState<QrDesignSettings>(getQrDesignSettings());
  const [qrSaved, setQrSaved] = useState<boolean>(false);
  const [qrUploading, setQrUploading] = useState<boolean>(false);
  const qrPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Teacher PIN Security state
  const [teacherPin, setTeacherPinState] = useState<string>('1234');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [pinSaved, setPinSaved] = useState<boolean>(false);

  // Biometrics & Passkey State
  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(false);
  const [passkeyEnrolled, setPasskeyEnrolled] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string>('Passkey');
  const [passkeyActionLoading, setPasskeyActionLoading] = useState<boolean>(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeySuccess, setPasskeySuccess] = useState<string | null>(null);

  // Gemini API Key & Model state
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.5-flash');
  const [geminiSaved, setGeminiSaved] = useState<boolean>(false);

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [supabaseEnabled, setSupabaseEnabled] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Supabase Auth state
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    setTeacherPinState(getTeacherPin());
    setGeminiKey(getStoredGeminiKey());
    setGeminiModel(getStoredGeminiModel());
    setDeviceLabel(getBiometricDeviceLabel());
    setPasskeyEnrolled(isPasskeyEnrolled());

    isBiometricsSupported().then((supported) => {
      setBiometricsSupported(supported);
    });

    const sb = getSupabaseSettings();
    setSupabaseUrl(sb.url || '');
    setSupabaseAnonKey(sb.anonKey || '');
    setSupabaseEnabled(sb.enabled || false);

    // Check auth status if Supabase client is available
    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data }) => {
        if (data?.user?.email) {
          setCurrentUserEmail(data.user.email);
        }
      });
    }
  }, []);

  // Live render QR Preview on canvas whenever qrSettings change
  useEffect(() => {
    if (qrPreviewCanvasRef.current && activeTab === 'qr') {
      const demoText = `${window.location.origin}${window.location.pathname}?id=beispiel-tipp`;
      renderStyledQrCode(qrPreviewCanvasRef.current, demoText, {
        size: 260,
        customSettings: qrSettings,
      }).catch((e) => console.error('Preview QR error:', e));
    }
  }, [qrSettings, activeTab]);

  const handleSelectColorPreset = (presetId: QrPresetId) => {
    const preset = QR_COLOR_PRESETS[presetId];
    if (!preset) return;
    const updated = {
      ...qrSettings,
      preset: presetId,
      darkColor: preset.dark,
      lightColor: preset.light,
    };
    setQrSettings(updated);

    // If sketch is active and using automatic color, re-color sketch to match
    if (updated.rawUploadedImage && !updated.sketchStrokeColor) {
      updateSketchParameters(updated, { darkColor: preset.dark });
    }
  };

  const handleUpdateDarkColor = (color: string) => {
    let clean = color.trim();
    if (!clean.startsWith('#') && clean.length > 0) clean = '#' + clean;
    const updated = {
      ...qrSettings,
      darkColor: clean,
      preset: 'custom_colors' as QrPresetId,
    };
    setQrSettings(updated);

    if (updated.rawUploadedImage && !updated.sketchStrokeColor) {
      updateSketchParameters(updated, { darkColor: clean });
    }
  };

  const handleUpdateLightColor = (color: string) => {
    let clean = color.trim();
    if (!clean.startsWith('#') && clean.length > 0) clean = '#' + clean;
    setQrSettings((prev) => ({
      ...prev,
      lightColor: clean,
      preset: 'custom_colors' as QrPresetId,
    }));
  };

  const handleSelectBorder = (border: QrBorderDecoration) => {
    setQrSettings((prev) => ({
      ...prev,
      borderDecoration: border,
    }));
  };

  const updateSketchParameters = async (
    currentSettings: QrDesignSettings,
    changes: Partial<QrDesignSettings>
  ) => {
    const target = { ...currentSettings, ...changes };
    setQrSettings(target);

    if (target.rawUploadedImage) {
      try {
        setQrUploading(true);
        const strokeColor = target.sketchStrokeColor || target.darkColor;
        const { sketchUrl } = await processUploadedImageAsSketch(target.rawUploadedImage, {
          style: target.sketchStyle || 'pencil',
          strokeColor,
          intensity: target.sketchIntensity || 3,
        });
        setQrSettings((prev) => ({
          ...prev,
          ...changes,
          customLogoDataUrl: sketchUrl,
        }));
      } catch (e) {
        console.error('Failed to re-convert sketch:', e);
      } finally {
        setQrUploading(false);
      }
    }
  };

  const handleUploadCustomLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setQrUploading(true);
      const strokeColor = qrSettings.sketchStrokeColor || qrSettings.darkColor;
      const { rawUrl, sketchUrl } = await processUploadedImageAsSketch(file, {
        style: qrSettings.sketchStyle || 'pencil',
        strokeColor,
        intensity: qrSettings.sketchIntensity || 3,
      });

      setQrSettings((prev) => ({
        ...prev,
        rawUploadedImage: rawUrl,
        customLogoDataUrl: sketchUrl,
        centerLogoType: 'sketch_drawing',
        name: 'Mit Skizzen-Zeichnung',
      }));
    } catch (err: any) {
      console.error('Logo upload error:', err);
    } finally {
      setQrUploading(false);
    }
  };

  const handleRemoveCustomLogo = () => {
    setQrSettings((prev) => ({
      ...prev,
      rawUploadedImage: undefined,
      customLogoDataUrl: undefined,
      centerLogoType: 'none',
      name: QR_COLOR_PRESETS[prev.preset]?.name || 'Standard',
    }));
  };

  const handleSelectPresetIcon = (icon: 'book' | 'math' | 'graduation') => {
    setQrSettings((prev) => ({
      ...prev,
      centerLogoType: 'preset_icon',
      presetIcon: icon,
      name:
        icon === 'book'
          ? 'Buch-Symbol'
          : icon === 'math'
          ? 'Mathe-Symbol ∑'
          : 'Abschluss-Symbol 🎓',
    }));
  };

  const handleSaveQrSettings = () => {
    saveQrDesignSettings(qrSettings);
    setQrSaved(true);
    setTimeout(() => setQrSaved(false), 2500);
    onSettingsUpdated();
  };


  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherPin.trim()) return;
    setTeacherPin(teacherPin.trim());
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2500);
    onSettingsUpdated();
  };

  const handleLockNow = () => {
    setTeacherSessionActive(false);
    onClose();
    onSettingsUpdated();
  };

  const handleRegisterPasskey = async () => {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setPasskeyActionLoading(true);

    const res = await registerPasskey();
    setPasskeyActionLoading(false);

    if (res.success) {
      setPasskeyEnrolled(true);
      setPasskeySuccess(`${deviceLabel} erfolgreich eingerichtet!`);
      setTimeout(() => setPasskeySuccess(null), 3500);
    } else {
      setPasskeyError(res.error || 'Einrichtung fehlgeschlagen.');
    }
  };

  const handleTestPasskey = async () => {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setPasskeyActionLoading(true);

    const res = await authenticateWithPasskey();
    setPasskeyActionLoading(false);

    if (res.success) {
      setPasskeySuccess('Biometrie erfolgreich bestätigt!');
      setTimeout(() => setPasskeySuccess(null), 3500);
    } else {
      setPasskeyError(res.error || 'Authentifizierung fehlgeschlagen.');
    }
  };

  const handleRemovePasskey = () => {
    removePasskey();
    setPasskeyEnrolled(false);
    setPasskeySuccess(`${deviceLabel} wurde entfernt.`);
    setTimeout(() => setPasskeySuccess(null), 3000);
  };

  const handleSaveGemini = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiKey(geminiKey);
    saveGeminiModel(geminiModel);
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2000);
    onSettingsUpdated();
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseStatus(null);
    setSupabaseError(null);

    const newSettings = {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      enabled: supabaseEnabled,
    };

    saveSupabaseSettings(newSettings);

    if (!supabaseEnabled) {
      setSupabaseStatus('Cloud-Modus deaktiviert. Nutze lokalen Offline-Speicher.');
      onSettingsUpdated();
      return;
    }

    try {
      const client = getSupabaseClient();
      if (!client) {
        setSupabaseError('Ungültige Supabase-Konfiguration.');
        return;
      }
      const { error } = await client.from('lernhilfen').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        setSupabaseError(`Verbindungsfehler: ${error.message} (Bitte SQL-Schema anlegen!)`);
      } else {
        setSupabaseStatus('Erfolgreich mit Supabase verbunden!');
        onSettingsUpdated();
      }
    } catch (err: any) {
      setSupabaseError(`Fehler beim Verbinden: ${err.message}`);
    }
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    const client = getSupabaseClient();
    if (!client) {
      setAuthMessage('Bitte zuerst Supabase konfigurieren.');
      setAuthLoading(false);
      return;
    }

    try {
      if (authMode === 'login') {
        const { data, error } = await client.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setCurrentUserEmail(data.user?.email || null);
        setAuthMessage('Erfolgreich angemeldet!');
      } else {
        const { data, error } = await client.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthMessage(
          'Konto erstellt! Bitte Bestätigungs-E-Mail prüfen oder direkt einloggen.'
        );
      }
    } catch (err: any) {
      setAuthMessage(`Fehler: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
      setCurrentUserEmail(null);
      setAuthMessage('Erfolgreich abgemeldet.');
    }
  };

  const sqlSchemaSnippet = `-- Tabelle in der Supabase SQL Console anlegen:
CREATE TABLE IF NOT EXISTS public.lernhilfen (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'Allgemein',
  task_context TEXT DEFAULT '',
  task_image TEXT,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Öffentlicher Lesezugriff für Schüler:
ALTER TABLE public.lernhilfen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.lernhilfen FOR SELECT USING (true);
CREATE POLICY "Authenticated Teacher All" ON public.lernhilfen FOR ALL USING (auth.role() = 'authenticated');

-- Storage Bucket anlegen (in Supabase Storage): 'lernhilfen-media' mit Public Access`;

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlSchemaSnippet);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch (e) {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-tight">
                Optionen &amp; Gestaltung
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Passe QR-Codes, Sicherheit und Cloud-Funktionen individuell an.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'qr'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR-Code Design</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Sicherheit &amp; PIN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'cloud'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cloud &amp; KI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>App installieren</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* TAB 1: QR-CODE DESIGN STUDIO */}
          {activeTab === 'qr' && (
            <div className="space-y-6">
              {/* Introduction */}
              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>QR-Code Design Studio: Verzierungen, Skizzen &amp; Farbcodes</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Passe das Design deiner QR-Codes an: Wähle dekorative <strong>Rand-Verzierungen</strong> (z. B. elegante Zierecken, Schulheft-Muster oder einen Mathe-Formelkranz), gib <strong>eigene Farbcodes (Hex)</strong> ein und wandle hochgeladene Fotos automatisch in eine <strong>stilvolle, gestochen scharfe Skizzen-Zeichnung</strong> mit anpassbarer Linienfarbe um.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                {/* Canvas Container with strict 1:1 Aspect Ratio (No Distortion, High-DPI Sharp) */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <canvas
                    ref={qrPreviewCanvasRef}
                    width={260}
                    height={260}
                    style={{ width: '190px', height: '190px', aspectRatio: '1 / 1', display: 'block' }}
                    className="rounded-lg shrink-0"
                  />
                </div>

                <div className="space-y-2.5 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Level H (High) · Scan-sicher</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                      <span>Rand: {QR_BORDER_OPTIONS.find((b) => b.id === qrSettings.borderDecoration)?.name.split(' ')[0] || 'Schlicht'}</span>
                    </span>
                  </div>

                  <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Aktives Design: {qrSettings.name}
                  </h5>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Scharfe, unpixelierte Darstellung in der Web-App, im PDF/PNG-Download und auf allen ausgedruckten Arbeitsblatt-QR-Bögen.
                  </p>

                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={handleSaveQrSettings}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-98"
                    >
                      {qrSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Design gespeichert &amp; aktiv!</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Als Standard festlegen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* SEKTION 1: RAND-VERZIERUNGEN (DESIGNS FÜR RAHMEN) */}
              <div className="space-y-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      1. QR-Code Rand-Verzierungen (Rahmen-Designs)
                    </h5>
                  </div>
                  <span className="text-xs text-slate-500">Wähle eine Verzierung</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verziere den äußeren Rand des QR-Codes mit passenden Stilelementen für Arbeitsblätter und Unterrichtsmaterialien:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {QR_BORDER_OPTIONS.map((border) => {
                    const isSelected = qrSettings.borderDecoration === border.id;
                    return (
                      <button
                        key={border.id}
                        type="button"
                        onClick={() => handleSelectBorder(border.id)}
                        className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xl p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                          {border.previewIcon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                              {border.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 stroke-[3]" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                            {border.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEKTION 2: MANUELLE FARBEN & FARBCODES (HEX-CODES) */}
              <div className="space-y-3.5 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pipette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      2. QR-Code Farben manuell anpassen (mit Farbcodes)
                    </h5>
                  </div>
                  <span className="text-xs text-slate-500">Hex-Codes</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Passe die Vorder- und Hintergrundfarbe manuell mit exakten Hex-Farbcodes (z. B. <code className="font-mono text-indigo-600 font-bold">#3730A3</code>) oder über den visuellen Farbwähler an:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* QR Pattern Color (Dark) */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      QR-Code Muster / Vordergrund:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shadow-2xs shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={qrSettings.darkColor?.startsWith('#') && qrSettings.darkColor.length === 7 ? qrSettings.darkColor : '#3730A3'}
                          onChange={(e) => handleUpdateDarkColor(e.target.value)}
                          className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer border-0 p-0"
                          title="Farbwähler öffnen"
                        />
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={qrSettings.darkColor}
                          onChange={(e) => handleUpdateDarkColor(e.target.value)}
                          placeholder="#3730A3"
                          maxLength={9}
                          className="w-full px-3 py-1.5 font-mono text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* QR Background Color (Light) */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Hintergrundfarbe (Standard #FFFFFF):
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shadow-2xs shrink-0 cursor-pointer">
                        <input
                          type="color"
                          value={qrSettings.lightColor?.startsWith('#') && qrSettings.lightColor.length === 7 ? qrSettings.lightColor : '#FFFFFF'}
                          onChange={(e) => handleUpdateLightColor(e.target.value)}
                          className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer border-0 p-0"
                          title="Farbwähler öffnen"
                        />
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={qrSettings.lightColor}
                          onChange={(e) => handleUpdateLightColor(e.target.value)}
                          placeholder="#FFFFFF"
                          maxLength={9}
                          className="w-full px-3 py-1.5 font-mono text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Color Palette Presets */}
                <div className="pt-1 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Schnellauswahl beliebter Schulfarben:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(QR_COLOR_PRESETS) as QrPresetId[])
                      .filter((pid) => pid !== 'custom_colors')
                      .map((pid) => {
                        const pal = QR_COLOR_PRESETS[pid];
                        const isMatch = qrSettings.darkColor.toLowerCase() === pal.dark.toLowerCase();
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => handleSelectColorPreset(pid)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                              isMatch
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
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

              {/* SEKTION 3: BILD IN SKIZZENFORM UMWANDELN (MITTE) */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        3. Foto/Bild in Skizzenform umwandeln (Zentrum)
                      </h5>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Fotos werden automatisch als scharfe Strichzeichnung/Skizze gerendert – harmonisch &amp; scan-sicher!
                      </span>
                    </div>
                  </div>

                  {qrSettings.rawUploadedImage && (
                    <button
                      type="button"
                      onClick={handleRemoveCustomLogo}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 flex items-center gap-1 font-medium transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Bild entfernen</span>
                    </button>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-indigo-300 dark:border-indigo-700 cursor-pointer flex items-center justify-center gap-2 transition shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      {qrUploading ? 'Skizze wird generiert...' : 'Foto / Bild hochladen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadCustomLogo}
                      className="hidden"
                      disabled={qrUploading}
                    />
                  </label>

                  {/* Badge Shape Selector */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Badge-Form:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setQrSettings((prev) => ({ ...prev, badgeShape: 'circle' }))
                        }
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          qrSettings.badgeShape === 'circle'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Kreis
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQrSettings((prev) => ({ ...prev, badgeShape: 'rounded' }))
                        }
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          qrSettings.badgeShape === 'rounded'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Abgerundet
                      </button>
                    </div>
                  </div>

                  {/* Proportion / Fit Selector */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Bild-Proportion:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setQrSettings((prev) => ({ ...prev, logoFit: 'contain' }))
                        }
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          (qrSettings.logoFit || 'contain') === 'contain'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                        title="Vollständig sichtbar, natürliche Seitenverhältnisse ohne Verzerrung"
                      >
                        Einpassen (1:1 unverzerrt)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQrSettings((prev) => ({ ...prev, logoFit: 'cover' }))
                        }
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          qrSettings.logoFit === 'cover'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                        title="Flächig füllen mit zentriertem Zuschnitt (unverzerrt)"
                      >
                        Fläche füllen
                      </button>
                    </div>
                  </div>
                </div>


                {/* If image is active: detailed sketch controls */}
                {qrSettings.rawUploadedImage && (
                  <div className="p-3.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl space-y-3.5">
                    <div className="flex items-center gap-4">
                      {/* Converted Sketch Thumbnail */}
                      <div className="relative shrink-0">
                        <img
                          src={qrSettings.customLogoDataUrl || qrSettings.rawUploadedImage}
                          alt="Skizze"
                          className={`w-14 h-14 object-contain bg-white p-1 border-2 border-indigo-500 shadow-xs ${
                            qrSettings.badgeShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                          }`}
                        />
                        {qrUploading && (
                          <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 rounded-full flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            Aktive Skizzen-Strichzeichnung
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md">
                            Gestochen scharf
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Das Foto wurde in saubere Konturlinien umgewandelt. Du kannst den Stil und die Strichfarbe hier feineinstellen:
                        </p>
                      </div>
                    </div>

                    {/* Sketch Style Tabs */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Skizzen-Stil:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'pencil', label: '✏️ Bleistift' },
                          { id: 'ink', label: '🖋️ Tusche / Ink' },
                          { id: 'outline', label: '📐 Kontur' },
                          { id: 'charcoal', label: '🖤 Kohle / Kreide' },
                        ].map((st) => {
                          const isSel = (qrSettings.sketchStyle || 'pencil') === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() =>
                                updateSketchParameters(qrSettings, {
                                  sketchStyle: st.id as SketchStyle,
                                })
                              }
                              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                                isSel
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sketch Intensity Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Strichstärke &amp; Details:
                        </span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                          Stufe {qrSettings.sketchIntensity || 3} von 5
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={qrSettings.sketchIntensity || 3}
                        onChange={(e) =>
                          updateSketchParameters(qrSettings, {
                            sketchIntensity: Number(e.target.value),
                          })
                        }
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Filigran / Fein</span>
                        <span>Normal</span>
                        <span>Kräftige Linien</span>
                      </div>
                    </div>

                    {/* Sketch Stroke Color Setting */}
                    <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Farbanpassung der Skizzen-Linien:
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Option 1: Auto-Match QR Color */}
                        <button
                          type="button"
                          onClick={() =>
                            updateSketchParameters(qrSettings, {
                              sketchStrokeColor: undefined,
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                            !qrSettings.sketchStrokeColor
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: qrSettings.darkColor }}
                          />
                          <span>Automatisch wie QR-Code ({qrSettings.darkColor})</span>
                        </button>

                        {/* Option 2: Custom Hex Color Input */}
                        <div className="flex items-center gap-2">
                          <div className="relative w-7 h-7 rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 shadow-2xs shrink-0 cursor-pointer">
                            <input
                              type="color"
                              value={
                                qrSettings.sketchStrokeColor?.startsWith('#') &&
                                qrSettings.sketchStrokeColor.length === 7
                                  ? qrSettings.sketchStrokeColor
                                  : qrSettings.darkColor
                              }
                              onChange={(e) =>
                                updateSketchParameters(qrSettings, {
                                  sketchStrokeColor: e.target.value,
                                })
                              }
                              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0"
                              title="Eigene Skizzen-Farbe wählen"
                            />
                          </div>
                          <input
                            type="text"
                            value={qrSettings.sketchStrokeColor || ''}
                            onChange={(e) => {
                              let v = e.target.value.trim();
                              if (v && !v.startsWith('#')) v = '#' + v;
                              updateSketchParameters(qrSettings, {
                                sketchStrokeColor: v,
                              });
                            }}
                            placeholder="Eigener Hex-Code"
                            maxLength={9}
                            className="w-32 px-2.5 py-1 font-mono text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SEKTION 4: ALTERNATIVE ICONS IM ZENTRUM (FALLS KEIN FOTO) */}
              <div className="space-y-2.5 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  Alternative Zentrum-Symbole (oder schlicht pur):
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQrSettings((prev) => ({
                        ...prev,
                        centerLogoType: 'none',
                        name: 'Schlicht (Ohne Zentrum-Icon)',
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      qrSettings.centerLogoType === 'none'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base block mb-0.5">◻️</span>
                    <span className="text-xs">Kein Symbol</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPresetIcon('book')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      qrSettings.centerLogoType === 'preset_icon' &&
                      qrSettings.presetIcon === 'book'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base block mb-0.5">📖</span>
                    <span className="text-xs">Buch (Bildung)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPresetIcon('math')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      qrSettings.centerLogoType === 'preset_icon' &&
                      qrSettings.presetIcon === 'math'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base block mb-0.5 font-bold">∑</span>
                    <span className="text-xs">Mathe &amp; MINT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPresetIcon('graduation')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      qrSettings.centerLogoType === 'preset_icon' &&
                      qrSettings.presetIcon === 'graduation'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500 font-bold text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🎓</span>
                    <span className="text-xs">Abschluss &amp; Erfolg</span>
                  </button>
                </div>
              </div>

              {/* Bottom Quick Save */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Auswahl wird sofort für alle QR-Codes &amp; Druckbögen übernommen.
                </span>
                <button
                  type="button"
                  onClick={handleSaveQrSettings}
                  className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{qrSaved ? 'Gespeichert!' : 'Design jetzt speichern'}</span>
                </button>
              </div>
            </div>
          )}


          {/* TAB 2: SICHERHEIT & PIN */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Section 0: Lehrkraft-Sicherheit & PIN-Schutz */}
              <div className="space-y-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Lehrkraft-Sicherheit &amp; PIN-Schutz
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Aktiv
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Verhindert, dass Schüler durch Löschen des URL-Codes (<code className="font-mono text-indigo-500 font-semibold">?id=...</code>) in den Lehrerbereich gelangen oder Tippkarten manipulieren/löschen. Ohne PIN sehen Schüler nur das geschützte Schülerportal.
                </p>

                <form onSubmit={handleSavePin} className="space-y-2 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Lehrkraft-PIN (z. B. 4 bis 8 Ziffern/Zeichen):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPin ? 'text' : 'password'}
                        value={teacherPin}
                        onChange={(e) => setTeacherPinState(e.target.value)}
                        placeholder="1234"
                        className="w-full pl-3.5 pr-9 py-2 text-xs font-mono tracking-wider bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
                    >
                      {pinSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>PIN gesichert!</span>
                        </>
                      ) : (
                        <span>PIN ändern</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Biometrische Passkey-Entsperrung */}
                <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{deviceLabel} (Biometrischer Passkey)</span>
                    </div>
                    {passkeyEnrolled ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Aktiv</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Nicht eingerichtet</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ermöglicht das bequeme Entsperren über den Smartphone-Fingerabdrucksensor (Touch ID / Face ID) oder Windows Hello Passkey, ohne jedes Mal die PIN tippen zu müssen.
                  </p>

                  {passkeyError && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{passkeyError}</span>
                    </div>
                  )}

                  {passkeySuccess && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{passkeySuccess}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!passkeyEnrolled ? (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={handleRegisterPasskey}
                          disabled={passkeyActionLoading || !biometricsSupported}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          <span>
                            {passkeyActionLoading
                              ? 'Warte auf Eingabe...'
                              : !biometricsSupported
                              ? 'Im Vorschau-Frame nicht verfügbar'
                              : `${deviceLabel} jetzt einrichten`}
                          </span>
                        </button>
                        {!biometricsSupported && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Hinweis: Browser erlauben Passkeys/Biometrie aus Sicherheitsgründen nur im Hauptfenster oder der installierten Web-App (PWA).
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleTestPasskey}
                          disabled={passkeyActionLoading}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          <span>{passkeyActionLoading ? 'Prüfe...' : 'Biometrie testen'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePasskey}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900"
                        >
                          Entfernen
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-amber-200/60 dark:border-amber-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lehrkraft-Bereich auf diesem Gerät sperren:
                  </span>
                  <button
                    type="button"
                    onClick={handleLockNow}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Jetzt sperren</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD & KI */}
          {activeTab === 'cloud' && (
            <div className="space-y-6">
              {/* Default Free Math AI Notice */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Kostenlose didaktische MINT- &amp; Mathe-KI ist standardmäßig aktiv</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  Die Web-App generiert didaktisch gestufte Hilfen für Mathematik und Naturwissenschaften <strong>sofort und völlig kostenlos ohne API-Key</strong>. Du musst keinen Key eintragen, um die KI-Tippkarten zu nutzen!
                </p>
              </div>

              {/* Optional Custom Google Gemini API Key & Model */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Optional: Eigener Google AI API-Key für alternative Modelle
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Falls du erweiterte LLMs (z. B. Gemini 2.5 Pro für anspruchsvolle Oberstufen-Mathematik) oder automatische Bilderkennung nutzen möchtest, kannst du hier deinen eigenen Schlüssel eintragen.
                </p>

                <form onSubmit={handleSaveGemini} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Google AI Studio API-Key:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIzaSy... (leer lassen für kostenlose Standard-KI)"
                        className="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
                      >
                        {geminiSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Gespeichert!</span>
                          </>
                        ) : (
                          <span>Speichern</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Gewünschtes Gemini-Modell bei eigenem Key:
                    </label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Empfohlen: Schnell &amp; exzellent für MINT)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Höchste mathematische Denkfähigkeit)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                </form>
              </div>

              <hr className="border-slate-200 dark:border-slate-800" />

              {/* Supabase Configuration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Supabase Integration &amp; Cloud-Speicher
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supabaseEnabled}
                      onChange={(e) => setSupabaseEnabled(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Cloud-Modus aktivieren</span>
                  </label>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Solange nicht konfiguriert oder deaktiviert, nutzt die App automatisch den lokalen Demo-Modus im Browser.
                </p>

                <form onSubmit={handleTestAndSaveSupabase} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Supabase Project URL:
                    </label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      disabled={!supabaseEnabled}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Supabase Anon Public API Key:
                    </label>
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      disabled={!supabaseEnabled}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Einstellungen speichern &amp; testen
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSupabaseUrl('https://jctpkdffnttvyvimlrdw.supabase.co');
                        setSupabaseAnonKey(
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdHBrZGZmbnR0dnl2aW1scmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTM3ODAsImV4cCI6MjEwNzU2OTc4MH0._XaLwgee6Z7pOWndpvH2F5j12E--ReUg97Xk85oWG1s'
                        );
                        setSupabaseEnabled(true);
                      }}
                      className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border border-indigo-200 dark:border-indigo-800 font-medium"
                    >
                      Standard-Projekt laden (jctpkdffnttvyvimlrdw)
                    </button>
                  </div>
                </form>

                {supabaseStatus && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{supabaseStatus}</span>
                  </div>
                )}

                {supabaseError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{supabaseError}</span>
                  </div>
                )}

                {/* SQL Table Creation Accordion */}
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span>SQL-Schema für Tabelle `lernhilfen`:</span>
                    <button
                      type="button"
                      onClick={copySqlToClipboard}
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Kopiert!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>SQL kopieren</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[10px] overflow-x-auto text-slate-600 dark:text-slate-400">
                    {sqlSchemaSnippet}
                  </pre>
                </div>
              </div>

              {/* Supabase Auth */}
              {supabaseEnabled && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Lehrkraft-Konto (Supabase Auth)
                    </h4>
                  </div>

                  {currentUserEmail ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs text-slate-400">Angemeldet als Lehrkraft:</span>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {currentUserEmail}
                        </p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Abmelden</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSupabaseAuth} className="space-y-2.5">
                      <div className="flex items-center gap-3 text-xs font-semibold pb-1">
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`pb-1 border-b-2 ${
                            authMode === 'login'
                              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                              : 'border-transparent text-slate-500'
                          }`}
                        >
                          Anmelden
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('signup')}
                          className={`pb-1 border-b-2 ${
                            authMode === 'signup'
                              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                              : 'border-transparent text-slate-500'
                          }`}
                        >
                          Konto erstellen
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="lehrer@schule.de"
                          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="Passwort"
                          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>
                          {authMode === 'login' ? 'Lehrer-Login ausführen' : 'Lehrer-Konto registrieren'}
                        </span>
                      </button>

                      {authMessage && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                          {authMessage}
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: APP INSTALLATION (PWA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <PWAInstallButton variant="settings-card" />
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  Vorteile als installierte App (PWA):
                </span>
                <ul className="list-disc list-inside space-y-1">
                  <li>Schneller Direktstart vom Desktop oder Smartphone-Homescreen</li>
                  <li>Voller Offline-Zugriff auf alle bereits geladenen Lernhilfen</li>
                  <li>Unterstützung für biometrischen Schnell-Login (Face ID / Fingerabdruck)</li>
                  <li>Keine störende Browser-Adresszeile beim Präsentieren im Unterricht</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
