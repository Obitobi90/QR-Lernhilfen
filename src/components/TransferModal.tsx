import React, { useState, useEffect, useRef } from 'react';
import { Lernhilfe } from '../types';
import QRCode from 'qrcode';
import {
  X,
  Smartphone,
  QrCode,
  Download,
  Upload,
  Check,
  Copy,
  RefreshCw,
  HardDrive,
  Database,
  Cloud,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Info,
} from 'lucide-react';
import { checkSupabaseSchemaHealth, SchemaHealthResult } from '../utils/supabaseClient';
import { getEffectiveBaseUrl } from '../utils/appUrl';

interface TransferModalProps {
  items: Lernhilfe[];
  onClose: () => void;
  onImportBatch: (newItems: Lernhilfe[]) => Promise<void>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  items,
  onClose,
  onImportBatch,
  onSync,
  isSyncing,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'backup' | 'status'>('qr');
  const [selectedItemId, setSelectedItemId] = useState<string>(() => (items[0] ? items[0].id : ''));
  const [copiedLink, setCopiedLink] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [serverStats, setServerStats] = useState<{ count: number; ok: boolean } | null>(null);
  const [schemaHealth, setSchemaHealth] = useState<SchemaHealthResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0] || null;

  // Build direct import transfer URL
  const baseUrl = getEffectiveBaseUrl();
  const transferUrl = selectedItem
    ? `${baseUrl}${window.location.pathname}?importId=${encodeURIComponent(selectedItem.id)}`
    : baseUrl;

  // Render QR Code onto canvas
  useEffect(() => {
    if (activeTab === 'qr' && canvasRef.current && transferUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        transferUrl,
        {
          width: 260,
          margin: 2,
          color: {
            dark: '#1e1b4b', // deep indigo
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        },
        (error) => {
          if (error) console.error('Error generating transfer QR code:', error);
        }
      );
    }
  }, [activeTab, transferUrl]);

  // Load server stats and health check when status tab is opened
  useEffect(() => {
    if (activeTab === 'status') {
      setIsCheckingHealth(true);
      // Check server /api/lernhilfen
      fetch('/api/lernhilfen')
        .then((res) => res.json())
        .then((data) => {
          setServerStats({
            ok: true,
            count: Array.isArray(data?.items) ? data.items.length : 0,
          });
        })
        .catch(() => {
          setServerStats({ ok: false, count: 0 });
        });

      // Check Supabase health
      checkSupabaseSchemaHealth()
        .then((res) => {
          setSchemaHealth(res);
        })
        .finally(() => {
          setIsCheckingHealth(false);
        });
    }
  }, [activeTab]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(transferUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lernhilfen-backup-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Lese Backup-Datei ein...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const importedArray = Array.isArray(parsed) ? parsed : [parsed];

        // Basic validation
        const validItems: Lernhilfe[] = importedArray.filter(
          (x) => x && typeof x.id === 'string' && typeof x.title === 'string'
        );

        if (validItems.length === 0) {
          setImportStatus('Fehler: Keine gültigen Lernhilfen in dieser Datei gefunden.');
          setIsImporting(false);
          return;
        }

        await onImportBatch(validItems);
        setImportStatus(`Erfolg: ${validItems.length} Lernhilfen erfolgreich importiert!`);
      } catch (err: any) {
        setImportStatus(`Fehler beim Import: ${err.message}`);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 id="transfer-modal-title" className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Geräte synchronisieren &amp; Übertragen
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Karten direkt zwischen PC und Smartphone austauschen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Smartphone-Scan (QR)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Backup &amp; Datei</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Synchronisations-Status</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* TAB 1: SMARTPHONE QR SCAN */}
          {activeTab === 'qr' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/80 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Sofort-Übertragung per Kamera: </span>
                  Scanne den QR-Code mit der normalen Smartphone-Kamera. Die Lernhilfe wird sofort geöffnet und dauerhaft in deiner Lehrkraft-Übersicht auf dem Smartphone gespeichert!
                </div>
              </div>

              {/* Select Lernhilfe */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Zu übertragende Lernhilfe auswählen:
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.subject || 'Allgemein'} · {item.hints.length} Tipps)
                    </option>
                  ))}
                </select>
              </div>

              {/* QR Code Canvas */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/80">
                  <canvas ref={canvasRef} className="rounded-lg" />
                </div>
                {selectedItem && (
                  <div className="text-center max-w-sm">
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {selectedItem.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Code: <span className="font-mono">{selectedItem.id}</span> · {selectedItem.hints.length} Denkanstöße
                    </p>
                  </div>
                )}
              </div>

              {/* Direct Link Share */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={transferUrl}
                  className="flex-1 text-xs px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 select-all font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Kopiert!' : 'Link kopieren'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BACKUP (JSON EXPORT & IMPORT) */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Alle {items.length} Lernhilfen als Datei exportieren
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Erstelle eine Sicherheitskopie aller deiner erstellten Lernhilfen inklusive aller didaktischen Tipps, QR-Designs und Formeln.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Backup-Datei herunterladen (.json)</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Lernhilfen aus Backup-Datei importieren
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lade eine zuvor exportierte .json-Datei auf dieses Gerät, um alle Karten sofort hinzuzufügen.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? 'Importiere...' : 'Backup-Datei auswählen (.json)'}</span>
                </button>

                {importStatus && (
                  <p className={`text-xs font-bold pt-1 ${importStatus.startsWith('Erfolg') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {importStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SYNCHRONISATIONS-STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              <div className="space-y-3">
                {/* 1. Local Browser Storage */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Lokaler Browser-Speicher
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Auf diesem Gerät (PC/Smartphone)
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg">
                    {items.length} Lernhilfen
                  </span>
                </div>

                {/* 2. App-Server Store */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Integrierter App-Server (/api/lernhilfen)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Dauerhafter Speicher für alle verbundenen Geräte
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {serverStats?.ok ? (
                      <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg">
                        Online · {serverStats.count} Karten
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg">
                        Lokal / Fallback
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Supabase Cloud Database */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Supabase Cloud-Datenbank
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Optionale globale Cloud-Synchronisation
                        </p>
                      </div>
                    </div>
                    <div>
                      {isCheckingHealth ? (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Prüfe...
                        </span>
                      ) : schemaHealth?.ok ? (
                        <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Aktiv
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded-lg flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Schreibschutz (RLS 42501)
                        </span>
                      )}
                    </div>
                  </div>

                  {schemaHealth && !schemaHealth.ok && (
                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                      <p className="font-semibold mb-1">
                        Warum synchronisiert Supabase nicht automatisch?
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        Das vorgegebene Standard-Supabase-Projekt blockiert externe Schreibzugriffe (RLS 42501). Deine Lernhilfen sind auf dem App-Server und lokal auf diesem Gerät gesichert.
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        👉 Nutze für die Übertragung auf dein Smartphone einfach den Reiter <strong>"Smartphone-Scan (QR)"</strong> oder hinterlege in den Einstellungen dein eigenes kostenloses Supabase-Projekt.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Force Cloud Sync Button */}
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronisiere jetzt...' : 'Jetzt alle Quellen synchronisieren'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
