import React, { useState, useEffect } from 'react';
import { Lernhilfe } from './types';
import {
  fetchLernhilfen,
  fetchLernhilfeById,
  saveLernhilfe,
  deleteLernhilfe,
  getSupabaseSettings,
  getSupabaseClient,
  subscribeToSyncChanges,
} from './utils/supabaseClient';

import { generateNumericLernhilfeId } from './utils/idGenerator';
import { StudentView } from './components/StudentView';
import { StudentPortal } from './components/StudentPortal';
import { TeacherView } from './components/TeacherView';
import { LernhilfeEditor } from './components/LernhilfeEditor';
import { QrCodeModal } from './components/QrCodeModal';
import { WorksheetQrModal } from './components/WorksheetQrModal';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { TransferModal } from './components/TransferModal';
import {
  isTeacherSessionActive,
  setTeacherSessionActive,
} from './utils/teacherAuth';
import {
  Moon,
  Sun,
  Settings,
  QrCode,
  BookOpen,
  Cloud,
  HardDrive,
  RefreshCw,
  Smartphone,
  Lock,
  Check,
  AlertTriangle,
  Trash2,
  X,
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
  const [groupPresetForNew, setGroupPresetForNew] = useState<string | undefined>(undefined);
  const [qrModalItem, setQrModalItem] = useState<Lernhilfe | null>(null);
  const [worksheetQrModal, setWorksheetQrModal] = useState<{
    groupName: string;
    items: Lernhilfe[];
  } | null>(null);
  const [statsModalItem, setStatsModalItem] = useState<Lernhilfe | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'qr' | 'security' | 'cloud' | 'pwa'>('qr');
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState<boolean>(() => {
    const sb = getSupabaseSettings();
    return sb.enabled && !!sb.url && !!sb.anonKey;
  });

  // Teacher Preview vs Real Student Access
  const [isTeacherPreview, setIsTeacherPreview] = useState<boolean>(false);

  // Teacher Authentication state (protects overview, create, edit, delete against student URL manipulation)
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(() => isTeacherSessionActive());

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Cloud sync in progress state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success',
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setToast({ message, type, actionLabel, onAction });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, actionLabel ? 7000 : 4500);
  };

  // Listen for Cloud synchronization notifications & errors
  useEffect(() => {
    const handleSyncError = (e: any) => {
      const msg = e.detail?.message || 'Cloud-Synchronisationsfehler';
      const isUuid = e.detail?.isUuidError || msg.includes('UUID') || msg.includes('uuid');
      const isCol = e.detail?.isColumnError || msg.includes('Spalten');

      if (isUuid || isCol) {
        showToast(
          msg,
          'error',
          'Reparatur öffnen',
          () => {
            setSettingsInitialTab('cloud');
            setIsSettingsOpen(true);
          }
        );
      } else {
        showToast(msg, 'error');
      }
    };
    const handleSyncSuccess = (e: any) => {
      const msg = e.detail?.message || 'Erfolgreich mit Cloud synchronisiert';
      showToast(msg, 'success');
    };

    window.addEventListener('cloud-sync-error', handleSyncError);
    window.addEventListener('cloud-sync-success', handleSyncSuccess);

    return () => {
      window.removeEventListener('cloud-sync-error', handleSyncError);
      window.removeEventListener('cloud-sync-success', handleSyncSuccess);
    };
  }, []);

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

  // URL Query Parameter Listener (?id=UUID or ?importId=... or ?importPayload=...)
  const syncFromUrl = async () => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    const isPreviewParam = params.get('preview') === 'teacher';
    setIsTeacherPreview(isPreviewParam);

    // 1. Direct transfer import by ID
    const importId = params.get('importId');
    if (importId) {
      try {
        const item = await fetchLernhilfeById(importId);
        if (item) {
          await saveLernhilfe(item);
          setItems((prev) => {
            const idx = prev.findIndex((x) => x.id === item.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = item;
              return copy;
            }
            return [item, ...prev];
          });
          showToast(`Lernhilfe "${item.title}" erfolgreich auf dieses Smartphone übertragen!`, 'success');
          // Clean URL param
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      } catch (e) {
        console.warn('Transfer import by ID error:', e);
      }
    }

    // 2. Direct transfer import by JSON payload
    const importPayload = params.get('importPayload');
    if (importPayload) {
      try {
        const parsed = JSON.parse(decodeURIComponent(importPayload));
        if (parsed && parsed.id && parsed.title) {
          await saveLernhilfe(parsed);
          setItems((prev) => {
            const idx = prev.findIndex((x) => x.id === parsed.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = parsed;
              return copy;
            }
            return [parsed, ...prev];
          });
          showToast(`Lernhilfe "${parsed.title}" erfolgreich importiert!`, 'success');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      } catch (e) {
        console.warn('Transfer import by payload error:', e);
      }
    }

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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const data = await fetchLernhilfen();
      setItems(data);
      showToast(`Cloud-Synchronisation abgeschlossen (${data.length} Lernhilfen geladen).`, 'success');
    } catch (e: any) {
      showToast(`Fehler bei der Synchronisation: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check if teacher is authenticated via Supabase session
    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          setTeacherSessionActive(true);
          setIsTeacherAuthenticated(true);
        }
      });
      const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setTeacherSessionActive(true);
          setIsTeacherAuthenticated(true);
        }
      });
      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  // AUTOMATED PARALLEL SYNCHRONIZATION:
  // 1. Instant cross-tab & local bus listener
  useEffect(() => {
    const unsubscribe = subscribeToSyncChanges(() => {
      fetchLernhilfen().then((updated) => {
        setItems(updated);
      }).catch(() => {});
    });
    return unsubscribe;
  }, []);

  // 2. Auto-sync on window focus / tab visibility / smartphone screen unlock
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchLernhilfen().then((updated) => {
          setItems((prev) => {
            const prevHash = prev.map((x) => `${x.id}:${x.updated_at}`).join('|');
            const nextHash = updated.map((x) => `${x.id}:${x.updated_at}`).join('|');
            return prevHash !== nextHash ? updated : prev;
          });
        }).catch(() => {});
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // 3. Continuous background heartbeat polling (every 4 seconds when viewing overview)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll when tab is visible and teacher is not in middle of writing a card
      if (document.visibilityState === 'visible' && !isCreatingNew && !editingItem) {
        fetchLernhilfen().then((updated) => {
          setItems((prev) => {
            const prevHash = prev.map((x) => `${x.id}:${x.updated_at}`).join('|');
            const nextHash = updated.map((x) => `${x.id}:${x.updated_at}`).join('|');
            return prevHash !== nextHash ? updated : prev;
          });
        }).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isCreatingNew, editingItem]);


  // Student Navigation: Open Preview from Teacher Dashboard
  const handleOpenStudentView = (id: string) => {
    setIsTeacherPreview(true);
    const newUrl = `${window.location.pathname}?id=${encodeURIComponent(id)}&preview=teacher`;
    window.history.pushState({}, '', newUrl);
    syncFromUrl();
  };

  // Student Navigation: Open Direct Student View (from Student Portal)
  const handleOpenStudentDirect = (id: string) => {
    setIsTeacherPreview(false);
    const newUrl = `${window.location.pathname}?id=${encodeURIComponent(id)}`;
    window.history.pushState({}, '', newUrl);
    syncFromUrl();
  };

  const handleCloseTeacherPreview = () => {
    setIsTeacherPreview(false);
    window.history.pushState({}, '', window.location.pathname);
    syncFromUrl();
  };

  // CRUD actions with immediate optimistic updates and toast notifications
  const handleSaveLernhilfe = async (item: Lernhilfe) => {
    // Optimistically update list
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    setIsCreatingNew(false);
    setEditingItem(null);
    showToast(`„${item.title}“ wurde gespeichert!`, 'success');

    try {
      await saveLernhilfe(item);
    } catch (e) {
      console.error('Save failed:', e);
      showToast('Fehler beim Speichern der Lernhilfe.', 'error');
    }
  };

  const handleDeleteLernhilfe = async (id: string) => {
    const itemToDelete = items.find((i) => i.id === id);
    // Optimistically remove from list immediately
    setItems((prev) => prev.filter((i) => i.id !== id));
    showToast(`„${itemToDelete?.title || 'Lernhilfe'}“ wurde gelöscht (auf Smartphone & Cloud synchronisiert).`, 'info');

    try {
      await deleteLernhilfe(id);
    } catch (e) {
      console.error('Delete failed:', e);
      showToast('Fehler beim Löschen.', 'error');
    }
  };

  const handleDuplicateLernhilfe = async (item: Lernhilfe) => {
    const duplicated: Lernhilfe = {
      ...item,
      id: generateNumericLernhilfeId(items.map((i) => i.id)),
      title: `${item.title} (Kopie)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically prepend to list immediately
    setItems((prev) => [duplicated, ...prev]);
    showToast(`„${duplicated.title}“ erfolgreich dupliziert!`, 'success');

    try {
      await saveLernhilfe(duplicated);
    } catch (e) {
      console.error('Duplicate failed:', e);
      showToast('Fehler beim Duplizieren.', 'error');
    }
  };

  const handleUngroupWorksheet = async (groupName: string) => {
    const itemsInGroup = items.filter((i) => i.group_name === groupName);
    if (itemsInGroup.length === 0) return;

    // Optimistically update list
    setItems((prev) =>
      prev.map((item) =>
        item.group_name === groupName ? { ...item, group_name: undefined } : item
      )
    );
    showToast(`Arbeitsblatt-Zuordnung für ${itemsInGroup.length} Karten aufgehoben.`, 'info');

    for (const it of itemsInGroup) {
      try {
        await saveLernhilfe({ ...it, group_name: undefined });
      } catch (e) {
        console.error('Failed to ungroup item:', it.id, e);
      }
    }
  };

  const handleDeleteWorksheet = async (groupName: string) => {
    const itemsInGroup = items.filter((i) => i.group_name === groupName);
    if (itemsInGroup.length === 0) return;

    // Optimistically remove all items in this worksheet
    const ids = new Set(itemsInGroup.map((i) => i.id));
    setItems((prev) => prev.filter((i) => !ids.has(i.id)));
    showToast(`Arbeitsblatt „${groupName}“ mit ${itemsInGroup.length} Aufgaben gelöscht.`, 'info');

    for (const it of itemsInGroup) {
      try {
        await deleteLernhilfe(it.id);
      } catch (e) {
        console.error('Failed to delete item from worksheet:', it.id, e);
      }
    }
  };

  const handleImportBatch = async (newItems: Lernhilfe[]) => {
    for (const it of newItems) {
      await saveLernhilfe(it);
    }
    const refreshed = await fetchLernhilfen();
    setItems(refreshed);
    showToast(`${newItems.length} Lernhilfen erfolgreich importiert und gespeichert!`, 'success');
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
            {isTeacherPreview && (
              <button
                onClick={handleCloseTeacherPreview}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Vorschau schließen
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <StudentView
        item={studentItem}
        isTeacherPreview={isTeacherPreview}
        onClosePreview={handleCloseTeacherPreview}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    );
  }

  // 2. Student Portal: When ?id= is missing and user is NOT authenticated as Teacher
  // Prevents pupils from clearing the URL and accessing the teacher dashboard
  if (!isTeacherAuthenticated) {
    return (
      <StudentPortal
        items={items}
        onOpenItem={handleOpenStudentDirect}
        onTeacherLogin={() => {
          setTeacherSessionActive(true);
          setIsTeacherAuthenticated(true);
        }}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    );
  }

  // 3. Teacher Mode (Only visible when authenticated via Teacher PIN)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar following 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
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
            <span className="hidden md:inline-block px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800">
              Lehrkraft-Modus
            </span>
          </div>

          {/* Zone 2: Storage & Sync Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {isSupabaseEnabled ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200/80 dark:border-emerald-800/60 text-[11px]"
                title="Automatische Cloud-Synchronisation aktiv"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Cloud aktiv</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]"
                title="Lokaler Speicher aktiv"
              >
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                <span>Lokaler Speicher</span>
              </div>
            )}
          </div>

          {/* Zone 3: Quick Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Proactive Sync Button: Grünes Icon direkt neben dem Sperrsymbol */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              title={
                isSyncing
                  ? 'Synchronisation läuft...'
                  : 'Synchronisation proaktiv aktualisieren (frische Daten von allen Geräten laden)'
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {/* Quick Lock / Teacher Logout Button */}
            <button
              type="button"
              onClick={() => {
                setTeacherSessionActive(false);
                setIsTeacherAuthenticated(false);
              }}
              title="Lehrkraft-Bereich sperren (Schutz vor Schülern)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors shadow-xs cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Sperren</span>
            </button>

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Settings & Options gear button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Einstellungen & Optionen"
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
            initialItem={
              editingItem ||
              (groupPresetForNew
                ? {
                    id: '',
                    title: '',
                    group_name: groupPresetForNew,
                    task_context: '',
                    hints: [],
                    created_at: '',
                    updated_at: '',
                  }
                : null)
            }
            existingGroups={Array.from(
              new Set(items.map((i) => i.group_name?.trim()).filter(Boolean))
            ) as string[]}
            onSave={(item) => {
              handleSaveLernhilfe(item);
              setGroupPresetForNew(undefined);
            }}
            onCancel={() => {
              setIsCreatingNew(false);
              setEditingItem(null);
              setGroupPresetForNew(undefined);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <TeacherView
            items={items}
            onCreateNew={(groupPreset) => {
              setGroupPresetForNew(groupPreset);
              setIsCreatingNew(true);
            }}
            onEdit={(item) => setEditingItem(item)}
            onDuplicate={handleDuplicateLernhilfe}
            onDelete={handleDeleteLernhilfe}
            onOpenQr={(item) => setQrModalItem(item)}
            onOpenWorksheetQr={(groupName, groupItems) =>
              setWorksheetQrModal({ groupName, items: groupItems })
            }
            onOpenStats={(item) => setStatsModalItem(item)}
            onOpenPreview={handleOpenStudentView}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onUngroupWorksheet={handleUngroupWorksheet}
            onDeleteWorksheet={handleDeleteWorksheet}
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
      {isTransferOpen && (
        <TransferModal
          items={items}
          onClose={() => setIsTransferOpen(false)}
          onImportBatch={handleImportBatch}
          onSync={handleManualSync}
          isSyncing={isSyncing}
        />
      )}

      {qrModalItem && (
        <QrCodeModal
          item={qrModalItem}
          allWorksheetItems={
            qrModalItem.group_name
              ? items.filter((i) => i.group_name === qrModalItem.group_name)
              : undefined
          }
          onOpenWorksheetQr={(groupName, groupItems) => {
            setQrModalItem(null);
            setWorksheetQrModal({ groupName, items: groupItems });
          }}
          onClose={() => setQrModalItem(null)}
          onOpenPreview={(id) => {
            setQrModalItem(null);
            handleOpenStudentView(id);
          }}
          onOpenSettings={() => {
            setQrModalItem(null);
            setIsSettingsOpen(true);
          }}
        />
      )}

      {worksheetQrModal && (
        <WorksheetQrModal
          groupName={worksheetQrModal.groupName}
          items={worksheetQrModal.items}
          onClose={() => setWorksheetQrModal(null)}
          onOpenPreview={(id) => {
            setWorksheetQrModal(null);
            handleOpenStudentView(id);
          }}
        />
      )}

      {statsModalItem && (
        <StatsModal
          item={statsModalItem}
          onClose={() => setStatsModalItem(null)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          initialTab={settingsInitialTab}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsUpdated={() => {
            setIsTeacherAuthenticated(isTeacherSessionActive());
            loadData();
          }}
          onOpenTransfer={() => setIsTransferOpen(true)}
        />
      )}

      {/* Floating Action Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-700 dark:border-slate-300'
            }`}
          >
            {toast.type === 'success' && (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            {toast.type === 'error' && (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            {toast.type === 'info' && (
              <Trash2 className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
            )}
            <span className="max-w-xs">{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors shadow-2xs whitespace-nowrap shrink-0"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
