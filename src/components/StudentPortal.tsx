import React, { useState, useEffect } from 'react';
import { Lernhilfe } from '../types';
import { checkTeacherPin } from '../utils/teacherAuth';
import {
  authenticateWithPasskey,
  registerPasskey,
  isBiometricsSupported,
  isPasskeyEnrolled,
  getBiometricDeviceLabel,
} from '../utils/passkeyAuth';
import {
  QrCode,
  Lock,
  Search,
  BookOpen,
  ArrowRight,
  Shield,
  Moon,
  Sun,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  X,
  Sparkles,
  Fingerprint,
  Check,
} from 'lucide-react';

interface StudentPortalProps {
  items: Lernhilfe[];
  onOpenItem: (id: string) => void;
  onTeacherLogin: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  items,
  onOpenItem,
  onTeacherLogin,
  darkMode,
  onToggleDarkMode,
}) => {
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  // Teacher PIN & Biometrics Modal State
  const [showTeacherPinModal, setShowTeacherPinModal] = useState(false);
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Biometrics & Passkey State
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);
  const [passkeyEnrolled, setPasskeyEnrolled] = useState<boolean>(false);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string>('Passkey');
  const [showEnrollOfferModal, setShowEnrollOfferModal] = useState<boolean>(false);
  const [enrollLoading, setEnrollLoading] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceLabel(getBiometricDeviceLabel());
    setPasskeyEnrolled(isPasskeyEnrolled());

    isBiometricsSupported().then((supported) => {
      setBiometricsAvailable(supported);
    });
  }, []);

  // Biometric Unlock Trigger (Touch ID, Face ID, Android Fingerprint, Windows Hello)
  const handleBiometricUnlock = async () => {
    setPinError(null);
    setBiometricLoading(true);

    const res = await authenticateWithPasskey();
    setBiometricLoading(false);

    if (res.success) {
      setShowTeacherPinModal(false);
      onTeacherLogin();
    } else {
      setPinError(res.error || 'Biometrische Authentifizierung fehlgeschlagen.');
    }
  };

  // Search/Code submit handler
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const cleaned = enteredCode.trim().toLowerCase();
    if (!cleaned) return;

    // Check direct match
    const directMatch = items.find(
      (item) => item.id.toLowerCase() === cleaned
    );

    if (directMatch) {
      onOpenItem(directMatch.id);
      return;
    }

    // Check partial ID match or title match
    const matches = items.filter(
      (item) =>
        item.id.toLowerCase().includes(cleaned) ||
        item.title.toLowerCase().includes(cleaned)
    );

    if (matches.length === 1) {
      onOpenItem(matches[0].id);
      return;
    }

    if (matches.length > 1) {
      setCodeError(
        `Mehrere Treffer gefunden (${matches.length}). Bitte gib den genauen Code ein.`
      );
      return;
    }

    setCodeError(
      'Keine passende Lernhilfe gefunden. Bitte scanne den QR-Code deines Arbeitsblatts oder frage deine Lehrkraft nach dem Code.'
    );
  };

  // Teacher PIN validation
  const handleTeacherPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (checkTeacherPin(teacherPinInput)) {
      setTeacherPinInput('');

      // If this device supports biometrics and the teacher hasn't enrolled yet, offer Passkey enrollment!
      if (biometricsAvailable && !passkeyEnrolled) {
        setShowTeacherPinModal(false);
        setShowEnrollOfferModal(true);
      } else {
        setShowTeacherPinModal(false);
        onTeacherLogin();
      }
    } else {
      setPinError('Falscher Lehrkraft-PIN. Zugriff verweigert.');
      setTeacherPinInput('');
    }
  };

  // Handle Passkey Enrollment right after correct PIN
  const handleEnrollPasskeyNow = async () => {
    setEnrollError(null);
    setEnrollLoading(true);

    const result = await registerPasskey();
    setEnrollLoading(false);

    if (result.success) {
      setPasskeyEnrolled(true);
      setShowEnrollOfferModal(false);
      onTeacherLogin();
    } else {
      setEnrollError(result.error || 'Passkey-Erstellung fehlgeschlagen.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      {/* Top Bar following 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              QR-Lernhilfen
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
              Schülerportal
            </span>
          </div>

          {/* Zone 3: Quick Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Discrete Teacher Login Button with Lock / Fingerprint */}
            <button
              type="button"
              onClick={() => {
                setShowTeacherPinModal(true);
                setPinError(null);
              }}
              title={passkeyEnrolled ? `${deviceLabel} oder PIN zum Entsperren` : 'Lehrkraft-Bereich mit PIN entsperren'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            >
              {passkeyEnrolled ? (
                <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span>Lehrkraft-Bereich</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6 text-center">
          {/* Header Icon */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
            <BookOpen className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Digitale Tippkarten
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Scanne den QR-Code auf deinem Arbeitsblatt mit der Smartphone-Kamera oder gib den Lernhilfe-Code deiner Lehrkraft ein.
            </p>
          </div>

          {/* Form for manual code entry */}
          <form onSubmit={handleCodeSubmit} className="space-y-3 pt-2 text-left">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Aufgaben-Code oder Stichwort eingeben:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={enteredCode}
                  onChange={(e) => {
                    setEnteredCode(e.target.value);
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="z. B. leiter, pythagoras, fall..."
                  className="w-full pl-9 pr-3.5 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all shrink-0"
              >
                <span>Tipps öffnen</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {codeError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-snug">{codeError}</p>
              </div>
            )}
          </form>

          {/* Pedagogical Hint Box */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left bg-slate-50/70 dark:bg-slate-950/50 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Wie funktioniert das?</span>
            </div>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>Aufgabenstellung &amp; Skizze in Ruhe durchlesen</li>
              <li>Tipps Schritt für Schritt (gestuft) aufdecken, wenn du nicht weiterkommst</li>
              <li>Manche Tipps sind durch eine 4-stellige PIN der Lehrkraft geschützt</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        <span>QR-Lernhilfen · Binnendifferenzierung im Unterricht</span>
      </footer>

      {/* Teacher PIN Modal Dialog */}
      {showTeacherPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Shield className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Lehrkraft-Bereich entsperren
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherPinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Bitte gib deinen <strong>Lehrkraft-PIN</strong> ein, um Lernhilfen zu erstellen, zu bearbeiten oder zu löschen.
            </p>

            {/* Biometric One-Tap Unlock if Passkey is enrolled */}
            {passkeyEnrolled && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleBiometricUnlock}
                  disabled={biometricLoading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2.5 transition-all"
                >
                  <Fingerprint className="w-5 h-5 text-white" />
                  <span>{biometricLoading ? 'Prüfe Biometrie...' : `Mit ${deviceLabel} entsperren`}</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    oder per PIN
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                </div>
              </div>
            )}

            {biometricsAvailable && !passkeyEnrolled && (
              <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2 text-left">
                <Fingerprint className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>Tipp: Unterstützt Fingerabdruck &amp; Windows Hello nach dem ersten PIN-Login.</span>
              </div>
            )}

            <form onSubmit={handleTeacherPinSubmit} className="space-y-3">
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoFocus
                  value={teacherPinInput}
                  onChange={(e) => {
                    setTeacherPinInput(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  placeholder="PIN eingeben..."
                  className="w-full pl-9 pr-3 py-2.5 text-center text-base tracking-widest font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {pinError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                (Standard-PIN bei Ersteinrichtung: <code className="font-mono text-indigo-500 font-bold">1234</code>. Kann in den Einstellungen geändert werden.)
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTeacherPinModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Entsperren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passkey Enrollment Offer Modal (Triggered right after entering correct PIN) */}
      {showEnrollOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
              <Fingerprint className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                <span>PIN korrekt bestätigt</span>
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">
                {deviceLabel} aktivieren?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Möchtest du die Web App auf diesem Gerät künftig blitzschnell per <strong>{deviceLabel}</strong> entsperren, ohne jedes Mal die PIN tippen zu müssen?
              </p>
            </div>

            {enrollError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{enrollError}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={enrollLoading}
                onClick={handleEnrollPasskeyNow}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{enrollLoading ? 'Warte auf Bestätigung...' : `${deviceLabel} jetzt einrichten`}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEnrollOfferModal(false);
                  onTeacherLogin();
                }}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
              >
                Jetzt nicht, direkt zum Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
