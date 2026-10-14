import React, { useState, useEffect } from 'react';
import {
  getStoredGeminiKey,
  saveGeminiKey,
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
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSettingsUpdated }) => {
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

  // Gemini API Key state
  const [geminiKey, setGeminiKey] = useState<string>('');
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
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2500);
    onSettingsUpdated();
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseStatus('Verbindung wird getestet...');
    setSupabaseError(null);

    const newSettings = {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      enabled: supabaseEnabled,
    };

    saveSupabaseSettings(newSettings);

    if (!newSettings.enabled) {
      setSupabaseStatus('Demo-Modus aktiv (Lokale Speicherung)');
      onSettingsUpdated();
      return;
    }

    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase Client konnte nicht initialisiert werden.');
      }
      const { data, error } = await client.from('lernhilfen').select('id').limit(1);
      if (error && !error.message.includes('relation "lernhilfen" does not exist')) {
        throw error;
      }
      setSupabaseStatus('Verbindung zu Supabase erfolgreich hergestellt!');
      onSettingsUpdated();
    } catch (err: any) {
      setSupabaseError('Verbindungsfehler: ' + (err.message || 'Prüfe URL und Anon-Key.'));
      setSupabaseStatus(null);
    }
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      alert('Bitte richte zuerst die Supabase URL und den Anon Key ein und aktiviere Supabase.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (authMode === 'login') {
        const { data, error } = await client.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setCurrentUserEmail(data.user?.email || authEmail);
        setAuthMessage('Erfolgreich angemeldet!');
      } else {
        const { data, error } = await client.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthMessage('Registrierung erfolgreich! Bitte prüfe ggf. dein Postfach zur Bestätigung.');
      }
      onSettingsUpdated();
    } catch (err: any) {
      setAuthMessage('Auth-Fehler: ' + (err.message || 'Ungültige Anmeldedaten'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
      setCurrentUserEmail(null);
      setAuthMessage('Abgemeldet.');
      onSettingsUpdated();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              Einstellungen &amp; Backend
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
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

            {/* Biometrische Passkey-Entsperrung (Fingerprint / Windows Hello) */}
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
                        ? 'Biometrie wird nicht unterstützt'
                        : `${deviceLabel} jetzt einrichten`}
                    </span>
                  </button>
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

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Section 1: Google Gemini API Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-600" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Google Gemini API-Key (für KI-Tipp-Vorschläge)
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Wird ausschließlich in deinem lokalen Browser (localStorage) gespeichert, um didaktisch
              gestufte Tipps für MINT-Aufgaben zu generieren.
            </p>

            <form onSubmit={handleSaveGemini} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
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
            </form>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Section 2: Supabase Configuration */}
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
              Solange nicht konfiguriert oder deaktiviert, nutzt die App automatisch den lokalen
              Demo-Modus im Browser.
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

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Section 3: Supabase Auth (Teacher Login) */}
          {supabaseEnabled && (
            <div className="space-y-3">
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

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
