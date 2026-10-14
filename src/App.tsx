import React, { useState, useEffect } from 'react';
import { Lernhilfe } from './types';
import {
  fetchLernhilfen,
  fetchLernhilfeById,
  saveLernhilfe,
  deleteLernhilfe,
  getSupabaseSettings,
} from './utils/supabaseClient';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { LernhilfeEditor } from './components/LernhilfeEditor';
import { QrCodeModal } from './components/QrCodeModal';
import { SettingsModal } from './components/SettingsModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  Moon,
  Sun,
  Settings,
  QrCode,
  BookOpen,
  Cloud,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lernhilfen_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  // Items in repository
  const [items, setItems] = useState<Lernhilfe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active student view id from ?id=UUID
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentItem, setStudentItem] = useState<Lernhilfe | null>(null);

  // Modals & Editor states
  const [editingItem, setEditingItem] = useState<Lernhilfe | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [qrModalItem, setQrModalItem] = useState<Lernhilfe | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState<boolean>(false);

  // Apply dark mode class and data-theme to documentElement and body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (darkMode) {
      root.classList.add('dark');
      body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      body.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.removeAttribute('data-theme');
      body.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem('lernhilfen_dark_mode', String(darkMode));
    } catch (e) {}
  }, [darkMode]);

  // URL Query Parameter Listener (?id=UUID)
  const syncFromUrl = async () => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');

    if (idFromUrl) {
      setStudentId(idFromUrl);
      const found = await fetchLernhilfeById(idFromUrl);
      setStudentItem(found);
    } else {
      setStudentId(null);
      setStudentItem(null);
    }
  };

  useEffect(() => {
    syncFromUrl();

    const handlePopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load repository items
  const loadData = async () => {
    setLoading(true);
    const sb = getSupabaseSettings();
    setIsSupabaseEnabled(sb.enabled && !!sb.url && !!sb.anonKey);

    const data = await fetchLernhilfen();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Student Navigation: Open Preview or Return to Teacher View
  const handleOpenStudentView = (id: string) => {
    const newUrl = `${window.location.pathname}?id=${encodeURIComponent(id)}`;
    window.history.pushState({}, '', newUrl);
    syncFromUrl();
  };

  const handleReturnToTeacher = () => {
    window.history.pushState({}, '', window.location.pathname);
    syncFromUrl();
  };

  // CRUD actions
  const handleSaveLernhilfe = async (item: Lernhilfe) => {
    await saveLernhilfe(item);
    setIsCreatingNew(false);
    setEditingItem(null);
    await loadData();
  };

  const handleDeleteLernhilfe = async (id: string) => {
    await deleteLernhilfe(id);
    await loadData();
  };

  const handleDuplicateLernhilfe = async (item: Lernhilfe) => {
    const duplicated: Lernhilfe = {
      ...item,
      id: 'lh-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      title: `${item.title} (Kopie)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveLernhilfe(duplicated);
    await loadData();
  };

  // 1. If student mode is active (?id=...)
  if (studentId) {
    if (loading && !studentItem) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Lernhilfe wird geladen...</span>
          </div>
        </div>
      );
    }

    if (!studentItem) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
          <div className="max-w-md w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-4 shadow-md">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Lernhilfe nicht gefunden</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Der angeforderte Code existiert nicht mehr oder wurde von der Lehrkraft entfernt.
            </p>
            <button
              onClick={handleReturnToTeacher}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              Zurück zur Übersicht
            </button>
          </div>
        </div>
      );
    }

    return (
      <StudentView
        item={studentItem}
        onBackToTeacher={handleReturnToTeacher}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    );
  }

  // 2. Teacher Mode (Default view when no ?id=... in URL)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar following 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setIsCreatingNew(false);
                setEditingItem(null);
              }}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors"
            >
              QR-Lernhilfen
            </a>
          </div>

          {/* Zone 2: Storage Status Badge (clean, non-redundant) */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            {isSupabaseEnabled ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Supabase Cloud</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Lokaler Speicher</span>
              </div>
            )}
          </div>

          {/* Zone 3: Quick Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Install on Android / iOS button */}
            <PWAInstallButton />

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Settings gear button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Einstellungen &amp; Backend"
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {isCreatingNew || editingItem ? (
          <LernhilfeEditor
            initialItem={editingItem}
            onSave={handleSaveLernhilfe}
            onCancel={() => {
              setIsCreatingNew(false);
              setEditingItem(null);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <TeacherView
            items={items}
            onCreateNew={() => setIsCreatingNew(true)}
            onEdit={(item) => setEditingItem(item)}
            onDuplicate={handleDuplicateLernhilfe}
            onDelete={handleDeleteLernhilfe}
            onOpenQr={(item) => setQrModalItem(item)}
            onOpenPreview={handleOpenStudentView}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isSupabaseEnabled={isSupabaseEnabled}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 no-print">
        <p>
          Digitale QR-Lernhilfen &amp; Gestufte Tippkarten · Binnendifferenzierung im Schulunterricht
        </p>
      </footer>

      {/* Modals */}
      {qrModalItem && (
        <QrCodeModal
          item={qrModalItem}
          onClose={() => setQrModalItem(null)}
          onOpenPreview={(id) => {
            setQrModalItem(null);
            handleOpenStudentView(id);
          }}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSettingsUpdated={loadData}
        />
      )}
    </div>
  );
}
