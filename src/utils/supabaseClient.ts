import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lernhilfe, SupabaseSettings } from '../types';

const STORAGE_KEY_SETTINGS = 'lernhilfen_supabase_settings';
const STORAGE_KEY_ITEMS = 'lernhilfen_local_items_v1';
const STORAGE_KEY_DELETED = 'lernhilfen_deleted_ids_v1';

export function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return new Set(list.map((x) => String(x).trim()));
      }
    }
  } catch (e) {}
  return new Set<string>();
}

export function markIdAsDeleted(id: string): void {
  const cleanId = String(id || '').trim();
  if (!cleanId) return;
  try {
    const set = getDeletedIds();
    set.add(cleanId);
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function unmarkDeletedId(id: string): void {
  const cleanId = String(id || '').trim();
  if (!cleanId) return;
  try {
    const set = getDeletedIds();
    if (set.has(cleanId)) {
      set.delete(cleanId);
      localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

const syncBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('lernhilfen_sync_bus')
  : null;

export function notifySyncChange() {
  try {
    syncBroadcast?.postMessage({ type: 'SYNC_CHANGE', timestamp: Date.now() });
    window.dispatchEvent(new CustomEvent('app-items-updated'));
  } catch (e) {}
}

export function subscribeToSyncChanges(callback: () => void): () => void {
  const handler = () => callback();
  if (syncBroadcast) {
    syncBroadcast.addEventListener('message', handler);
  }
  window.addEventListener('app-items-updated', handler);
  return () => {
    if (syncBroadcast) {
      syncBroadcast.removeEventListener('message', handler);
    }
    window.removeEventListener('app-items-updated', handler);
  };
}

export const SAMPLE_LERNHILFEN: Lernhilfe[] = [
  {
    id: 'pythagoras-leiter-demo',
    title: 'Aufgabe 1: Die Feuerwehrleiter an der Hauswand',
    subject: 'Mathematik',
    grade_level: 'Klasse 9',
    group_name: 'Arbeitsblatt zum Satz des Pythagoras',
    task_context: 'Eine 5 m lange Feuerwehrleiter wird an einer Hauswand angelehnt. Der Fußpunkt der Leiter steht 3 m von der Hauswand entfernt. In welcher Höhe $h$ berührt die Leiter die Wand?',
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    glossary: {
      'Katheten': 'Die beiden Seiten in einem rechtwinkligen Dreieck, die den rechten Winkel (90°) direkt einschließen.',
      'Hypotenuse': 'Die längste Seite im rechtwinkligen Dreieck. Sie liegt immer direkt gegenüber dem rechten Winkel.',
    },
    hints: [
      {
        id: 'h1',
        title: 'Tipp 1: Rechtwinkliges Dreieck skizzieren',
        text: 'Fertige eine saubere Skizze an! Hauswand, Erdboden und Leiter bilden zusammen ein rechtwinkliges Dreieck mit dem rechten Winkel $\\gamma = 90^\\circ$ zwischen Wand und Boden.\n\nIdentifiziere [[Katheten]] und [[Hypotenuse]].',
        mediaType: 'none',
      },
      {
        id: 'h2',
        title: 'Tipp 2: Mathematischen Satz auswählen',
        text: 'In jedem rechtwinkligen Dreieck gilt der Satz des Pythagoras:\n$$a^2 + b^2 = c^2$$\nHierbei ist $c$ immer die Hypotenuse (die längste Seite gegenüber dem rechten Winkel – also die Leiter!).\n\nSetze die Werte ein:\n- Kathete $a = 3\\,\\text{m}$ (Abstand)\n- Kathete $b = h$ (gesuchte Höhe)\n- Hypotenuse $c = 5\\,\\text{m}$ (Leiterlänge)',
        mediaType: 'youtube',
        mediaData: 'https://www.youtube.com/watch?v=kY8c2_367gA',
      },
      {
        id: 'h3',
        title: 'Tipp 3: Gleichung nach der Höhe umstellen',
        text: 'Stelle die Formel nach der gesuchten Kathete $h$ um:\n$$3^2 + h^2 = 5^2$$\n$$9 + h^2 = 25$$\nZiehe auf beiden Seiten $9$ ab und ziehe anschließend die Quadratwurzel $\\sqrt{\\dots}$!',
        pin: '2024',
        mediaType: 'none',
      },
    ],
  },
  {
    id: 'pythagoras-fussball-demo',
    title: 'Aufgabe 2: Diagonaler Pass im Fußballfeld',
    subject: 'Mathematik',
    grade_level: 'Klasse 9',
    group_name: 'Arbeitsblatt zum Satz des Pythagoras',
    task_context: 'Ein Fußballfeld hat eine Länge von $105\\,\\text{m}$ und eine Breite von $68\\,\\text{m}$. Ein Spieler schlägt einen weiten Diagonalpass von einer Eckfahne zur genau gegenüberliegenden Eckfahne. Wie lang ist dieser Pass (Luftlinie)?',
    created_at: new Date(Date.now() - 3600000 * 24 * 2 + 120000).toISOString(),
    updated_at: new Date().toISOString(),
    hints: [
      {
        id: 'pfb1',
        title: 'Tipp 1: Rechteck und Diagonale erkennen',
        text: 'Ein Fußballfeld ist ein Rechteck. Wenn du von einer Ecke zur gegenüberliegenden Ecke ziehst, teilt die Diagonale $d$ das Feld in zwei kongruente rechtwinklige Dreiecke.',
        mediaType: 'none',
      },
      {
        id: 'pfb2',
        title: 'Tipp 2: Pythagoras anwenden',
        text: 'Die beiden Seitenlinien bilden die Katheten $a = 105\\,\\text{m}$ und $b = 68\\,\\text{m}$. Die Diagonale $d$ ist die gesuchte Hypotenuse:\n$$d^2 = a^2 + b^2 = 105^2 + 68^2$$',
        mediaType: 'none',
      },
    ],
  },
  {
    id: 'wipo-magisches-viereck',
    title: 'Wirtschaft-Politik: Das Magische Viereck der Wirtschaftspolitik',
    subject: 'Wirtschaft-Politik',
    grade_level: 'Klasse 10',
    group_name: 'Wirtschaftspolitik & Stabilität',
    task_context: 'Analysiere, warum die vier Ziele des [[Stabilitätsgesetz]]es von 1967 als „magisch“ bezeichnet werden und welcher Zielkonflikt zwischen [[Preisniveaustabilität]] und hohem Beschäftigungsstand entstehen kann.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    glossary: {
      'Stabilitätsgesetz': 'Bundesgesetz von 1967 zur Förderung der Stabilität und des Wachstums der Gesamtwirtschaft.',
      'Preisniveaustabilität': 'Zustand, in dem der Durchschnitt der Preise kaum steigt (unter 2% Inflationsrate laut EZB).',
      'Magisches Viereck': 'Die vier wirtschaftspolitischen Hauptziele: Preisniveaustabilität, hoher Beschäftigungsstand, stetiges Wirtschaftswachstum und außenwirtschaftliches Gleichgewicht.',
    },
    hints: [
      {
        id: 'w1',
        title: 'Tipp 1: Die vier Ecken des Vierecks benennen',
        text: 'Erinnere dich an die 4 Hauptziele im [[Magisches Viereck]]:\n1. Stabilität des Preisniveaus\n2. Hoher Beschäftigungsstand (geringe Arbeitslosigkeit)\n3. Außenwirtschaftliches Gleichgewicht\n4. Angemessenes und stetiges Wirtschaftswachstum',
        mediaType: 'none',
      },
      {
        id: 'w2',
        title: 'Tipp 2: Warum eigentlich „magisch“?',
        text: 'Das Viereck heißt „magisch“, weil es in der Praxis fast unmöglich (wie Zauberei) ist, alle vier Ziele gleichzeitig im vollen Umfang zu erreichen. Es herrschen ständige Zielharmonien und Zielkonflikte.',
        mediaType: 'none',
      },
      {
        id: 'w3',
        title: 'Tipp 3: Den Zielkonflikt (Phillips-Kurve) erläutern',
        text: 'Wird die Wirtschaft stark angekurbelt, um Arbeitslosigkeit zu senken, steigt die Nachfrage nach Gütern und Arbeitskräften. Das führt oft zu steigenden Löhnen und Preisen – die Inflation steigt und gefährdet die [[Preisniveaustabilität]].',
        mediaType: 'none',
      },
    ],
  },
  {
    id: 'sowi-subsidiaritaet',
    title: 'Sozialwissenschaften: Sozialstaat & Subsidiaritätsprinzip',
    subject: 'Sozialwissenschaften',
    grade_level: 'Oberstufe (Q1)',
    group_name: 'Der deutsche Sozialstaat',
    task_context: 'Erläutere die Bedeutung des [[Subsidiaritätsprinzip]]s für die Verteilung von Zuständigkeiten im deutschen [[Sozialstaat]] an einem konkreten Beispiel (z. B. Pflege von Angehörigen oder Jugendhilfe).',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    glossary: {
      'Subsidiaritätsprinzip': 'Grundsatz, nach dem gesellschaftliche Aufgaben immer von der kleinstmöglichen Einheit (Individuum, Familie, Gemeinde) erledigt werden sollen, bevor die übergeordnete staatliche Instanz eingreift.',
      'Sozialstaat': 'Ein Staat, der in seiner Verfassung verankert hat, für soziale Gerechtigkeit und soziale Sicherheit seiner Bürgerinnen und Bürger zu sorgen.',
    },
    hints: [
      {
        id: 'sw1',
        title: 'Tipp 1: Kernidee des Subsidiaritätsprinzips',
        text: 'Das [[Subsidiaritätsprinzip]] besagt: Was die kleinere Einheit (Familie, Nachbarschaft, Kommune) selbst bewältigen kann, darf ihr die größere Einheit (der Zentralstaat) nicht abnehmen. Hilfe des Staates erfolgt erst als Unterstützung zur Selbsthilfe.',
        mediaType: 'none',
      },
      {
        id: 'sw2',
        title: 'Tipp 2: Konkretes Anwendungsbeispiel',
        text: 'Beispiel Kinderbetreuung & Wohlfahrtsverbände: Zunächst sorgen Eltern und freie Träger (z. B. DRK, Caritas, Diakonie) für Kitas. Die Stadt oder der Staat greift erst regulierend oder finanziell ein, wenn freie Initiativen das Angebot nicht decken können.',
        mediaType: 'none',
      },
    ],
  },
];

const DEFAULT_SUPABASE_URL = 'https://jctpkdffnttvyvimlrdw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdHBrZGZmbnR0dnl2aW1scmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTM3ODAsImV4cCI6MjEwNzU2OTc4MH0._XaLwgee6Z7pOWndpvH2F5j12E--ReUg97Xk85oWG1s';

export function getSupabaseSettings(): SupabaseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: parsed.url || DEFAULT_SUPABASE_URL,
        anonKey: parsed.anonKey || DEFAULT_SUPABASE_ANON_KEY,
        enabled: parsed.enabled !== false, // Enabled by default unless user explicitly disabled it
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    enabled: true, // Cloud mode active by default
  };
}


export function saveSupabaseSettings(settings: SupabaseSettings): void {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

let cachedSupabase: SupabaseClient | null = null;
let currentConfigKey = '';
let realtimeChannel: any = null;

function setupRealtimeListener(client: SupabaseClient) {
  try {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    realtimeChannel = client
      .channel('lernhilfen_realtime_deletions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lernhilfen' },
        (payload: any) => {
          if (payload?.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) {
              const cleanId = String(delId).trim();
              markIdAsDeleted(cleanId);
              const localItems = getLocalLernhilfen().filter(
                (x) => String(x.id).trim() !== cleanId
              );
              saveLocalLernhilfen(localItems);
            }
          }
          notifySyncChange();
        }
      )
      .subscribe();
  } catch (e) {
    // Realtime channel fallback
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const settings = getSupabaseSettings();
  if (!settings.enabled || !settings.url || !settings.anonKey) {
    return null;
  }

  const key = `${settings.url}::${settings.anonKey}`;
  if (cachedSupabase && currentConfigKey === key) {
    return cachedSupabase;
  }

  try {
    cachedSupabase = createClient(settings.url, settings.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentConfigKey = key;
    setupRealtimeListener(cachedSupabase);
    return cachedSupabase;
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    return null;
  }
}

// Local Storage helpers
function getLocalLernhilfen(): Lernhilfe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(SAMPLE_LERNHILFEN));
      return SAMPLE_LERNHILFEN;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SAMPLE_LERNHILFEN;
  } catch (e) {
    return SAMPLE_LERNHILFEN;
  }
}

function saveLocalLernhilfen(items: Lernhilfe[]): void {
  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
}

export const SUPABASE_QUICK_FIX_SQL = `-- ============================================================
-- 1-KLICK REPARATUR FÜR DEINE SUPABASE-TABELLE 'lernhilfen'
-- Kopiere diesen Code in die Supabase SQL Console und klicke 'RUN':
-- ============================================================

-- 1. Spalte 'id' zu TEXT umwandeln (erlaubt 6-stellige Schüler-Codes wie 482105):
ALTER TABLE public.lernhilfen ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.lernhilfen ALTER COLUMN id TYPE TEXT USING id::text;

-- 2. Alle neuen Spalten nachrüsten:
ALTER TABLE public.lernhilfen ADD COLUMN IF NOT EXISTS disclosure_mode TEXT DEFAULT 'stepped';
ALTER TABLE public.lernhilfen ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.lernhilfen ADD COLUMN IF NOT EXISTS task_image TEXT;
ALTER TABLE public.lernhilfen ADD COLUMN IF NOT EXISTS qr_design JSONB;

-- 3. Row Level Security freigeben (Lese- und Schreibzugriff für alle Geräte):
ALTER TABLE public.lernhilfen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.lernhilfen;
CREATE POLICY "Public Read Access" ON public.lernhilfen FOR SELECT USING (true);
DROP POLICY IF EXISTS "Teacher Full Access" ON public.lernhilfen;
CREATE POLICY "Teacher Full Access" ON public.lernhilfen FOR ALL USING (true) WITH CHECK (true);`;

export interface SchemaHealthResult {
  ok: boolean;
  message: string;
  missingColumns: string[];
  isIdUuid: boolean;
  hasRlsIssue: boolean;
}

export async function checkSupabaseSchemaHealth(): Promise<SchemaHealthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: 'Supabase-Client konnte nicht initialisiert werden.',
      missingColumns: [],
      isIdUuid: false,
      hasRlsIssue: false,
    };
  }

  const missingColumns: string[] = [];
  let isIdUuid = false;
  let hasRlsIssue = false;

  // 1. Probe for expected columns
  const expectedCols = [
    'id',
    'title',
    'subject',
    'task_context',
    'task_image',
    'hints',
    'grade_level',
    'group_name',
    'disclosure_mode',
    'qr_design',
    'updated_at',
  ];

  for (const col of expectedCols) {
    try {
      const { error } = await supabase.from('lernhilfen').select(col).limit(1);
      if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
        missingColumns.push(col);
      }
    } catch {
      missingColumns.push(col);
    }
  }

  // 2. Probe if non-uuid id string is accepted by upsert or if syntax error
  try {
    const testProbeId = 'schema_probe_' + Date.now();
    const probeRes = await supabase.from('lernhilfen').upsert({ id: testProbeId, title: 'probe', hints: [] });
    if (probeRes.error) {
      if (probeRes.error.message.includes('uuid')) {
        isIdUuid = true;
      }
      if (probeRes.error.code === '42501' || probeRes.error.message.includes('policy')) {
        hasRlsIssue = true;
      }
    } else {
      // Clean up test probe row
      await supabase.from('lernhilfen').delete().eq('id', testProbeId);
    }
  } catch (e) {}

  const hasIssues = missingColumns.length > 0 || isIdUuid || hasRlsIssue;
  let message = 'Supabase-Datenbank ist vollständig und korrekt eingerichtet!';
  if (hasIssues) {
    const parts = [];
    if (isIdUuid) parts.push("Spalte 'id' ist UUID statt TEXT");
    if (missingColumns.length > 0) parts.push(`Fehlende Spalten: ${missingColumns.join(', ')}`);
    if (hasRlsIssue) parts.push('Schreibzugriff durch RLS blockiert');
    message = `Reparatur erforderlich: ${parts.join(' · ')}`;
  }

  return {
    ok: !hasIssues,
    message,
    missingColumns,
    isIdUuid,
    hasRlsIssue,
  };
}

// Unified Database API (Server Disk Store + LocalStorage + Supabase Cloud)
export async function fetchLernhilfen(): Promise<Lernhilfe[]> {
  const settings = getSupabaseSettings();
  const deletedIds = getDeletedIds();
  const localItems = getLocalLernhilfen().filter((it) => it && it.id && !deletedIds.has(String(it.id).trim()));
  const supabase = getSupabaseClient();

  const mergedMap = new Map<string, Lernhilfe>();
  // 1. Start with local items (strictly excluding already deleted ones)
  localItems.forEach((it) => {
    if (it && it.id) {
      const cleanId = String(it.id).trim();
      if (!deletedIds.has(cleanId)) {
        mergedMap.set(cleanId, it);
      }
    }
  });

  // 2. Fetch from server disk store (/api/lernhilfen) - ensures sync across all devices on the same app
  try {
    const res = await fetch('/api/lernhilfen');
    if (res.ok) {
      const data = await res.json();

      // Ingest remote server tombstones (items deleted on PC)
      if (Array.isArray(data?.deletedIds)) {
        data.deletedIds.forEach((delId: string) => {
          const cleanDel = String(delId).trim();
          if (cleanDel) {
            deletedIds.add(cleanDel);
            markIdAsDeleted(cleanDel);
            mergedMap.delete(cleanDel);
          }
        });
      }

      if (Array.isArray(data?.items)) {
        data.items.forEach((srvItem: Lernhilfe) => {
          if (srvItem && srvItem.id) {
            const cleanId = String(srvItem.id).trim();
            // Skip deleted items completely
            if (deletedIds.has(cleanId)) return;

            const existing = mergedMap.get(cleanId);
            if (!existing) {
              mergedMap.set(cleanId, srvItem);
            } else {
              const srvTime = new Date(srvItem.updated_at || srvItem.created_at || 0).getTime();
              const locTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
              if (srvTime >= locTime) {
                mergedMap.set(cleanId, srvItem);
              }
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('Server /api/lernhilfen fetch error, proceeding with available data:', err);
  }

  // 3. Fetch from Supabase Cloud if enabled
  if (settings.enabled && supabase) {
    try {
      const { data, error } = await supabase
        .from('lernhilfen')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch notice:', error.message);
        // Only dispatch error event if not the known default RLS restriction
        if (error.code !== '42501') {
          window.dispatchEvent(
            new CustomEvent('cloud-sync-error', {
              detail: {
                message: `Cloud-Synchronisation: ${error.message}`,
                code: error.code,
                hint: error.code === 'PGRST204' ? 'Spalten fehlen in Supabase' : error.message,
              },
            })
          );
        }
      } else if (Array.isArray(data)) {
        const cloudIds = new Set(data.map((row: any) => String(row.id).trim()));

        // Authoritative Cloud Deletion Reconciliation:
        // If a local item was in localStorage, but is no longer present in Supabase,
        // and it was created more than 15 seconds ago (not in the middle of being drafted),
        // it was deleted on another device (e.g. desktop PC).
        // Automatically purge it so smartphones delete it without resurrection!
        localItems.forEach((localIt) => {
          const cleanLocalId = String(localIt.id).trim();
          if (!cloudIds.has(cleanLocalId)) {
            const createdAt = new Date(localIt.created_at || 0).getTime();
            const isJustCreated = Date.now() - createdAt < 15000;
            if (!isJustCreated) {
              deletedIds.add(cleanLocalId);
              markIdAsDeleted(cleanLocalId);
              mergedMap.delete(cleanLocalId);
            }
          }
        });

        data.forEach((row: any) => {
          if (row && row.id) {
            const cleanId = String(row.id).trim();
            // Skip if item is marked deleted
            if (deletedIds.has(cleanId)) return;

            const cloudItem: Lernhilfe = {
              id: cleanId,
              title: row.title || 'Ohne Titel',
              subject: row.subject || 'Allgemein',
              grade_level: row.grade_level || undefined,
              group_name: row.group_name || undefined,
              task_context: row.task_context || '',
              task_image: row.task_image || undefined,
              disclosure_mode: row.disclosure_mode || 'stepped',
              hints: Array.isArray(row.hints) ? row.hints : [],
              qr_design: row.qr_design || undefined,
              glossary: row.glossary || undefined,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
            };

            const existing = mergedMap.get(cleanId);
            if (!existing) {
              mergedMap.set(cleanId, cloudItem);
            } else {
              const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at || 0).getTime();
              const curTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
              if (cloudTime >= curTime) {
                // Preserve local glossary if cloud column is null or not yet migrated
                const preservedGlossary = cloudItem.glossary || existing.glossary;
                mergedMap.set(cleanId, {
                  ...cloudItem,
                  glossary: preservedGlossary,
                });
              }
            }
          }
        });
      }
    } catch (err: any) {
      console.warn('Supabase fetch exception:', err);
    }
  }

  const finalDeleted = getDeletedIds();
  const mergedList = Array.from(mergedMap.values())
    .filter((it) => it && it.id && !finalDeleted.has(String(it.id).trim()))
    .sort((a, b) => {
      const timeA = new Date(b.created_at || 0).getTime();
      const timeB = new Date(a.created_at || 0).getTime();
      return timeA - timeB;
    });

  // Save merged result back to localStorage
  saveLocalLernhilfen(mergedList);

  // Sync legitimate items back to server in background (EXCLUDING deleted items)
  try {
    fetch('/api/lernhilfen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: mergedList }),
    }).catch(() => {});
  } catch (e) {}

  return mergedList;
}

export async function fetchLernhilfeById(id: string): Promise<Lernhilfe | null> {
  // 1. Check local items first
  const localItems = getLocalLernhilfen();
  const localFound = localItems.find((item) => item.id === id);
  if (localFound) return localFound;

  // 2. Check server disk store (/api/lernhilfen/:id)
  try {
    const res = await fetch(`/api/lernhilfen/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.item) {
        saveLocalLernhilfen([data.item, ...localItems.filter((x) => x.id !== id)]);
        return data.item;
      }
    }
  } catch (e) {}

  // 3. Check Supabase if enabled
  const supabase = getSupabaseClient();
  const settings = getSupabaseSettings();
  if (settings.enabled && supabase) {
    try {
      const { data, error } = await supabase
        .from('lernhilfen')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const item: Lernhilfe = {
          id: String(data.id),
          title: data.title || '',
          subject: data.subject || '',
          grade_level: data.grade_level || undefined,
          group_name: data.group_name || undefined,
          task_context: data.task_context || '',
          task_image: data.task_image || undefined,
          disclosure_mode: data.disclosure_mode || 'stepped',
          hints: Array.isArray(data.hints) ? data.hints : [],
          qr_design: data.qr_design || undefined,
          glossary: data.glossary || localItems.find((x) => String(x.id).trim() === id)?.glossary || undefined,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
        // Cache locally
        saveLocalLernhilfen([item, ...localItems.filter((x) => x.id !== id)]);
        return item;
      }
    } catch (e) {
      console.warn('Supabase fetch by ID failed:', e);
    }
  }

  // 3. Check server disk store
  try {
    const res = await fetch(`/api/lernhilfen/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.item) return data.item;
    }
  } catch (e) {}

  return null;
}

export async function saveLernhilfe(item: Lernhilfe): Promise<Lernhilfe> {
  const cleanId = String(item.id).trim();
  // If this item was previously marked deleted, unmark it as it is being actively saved
  unmarkDeletedId(cleanId);

  const updatedItem: Lernhilfe = {
    ...item,
    id: cleanId,
    updated_at: new Date().toISOString(),
  };

  // Always update local storage first so UI is immediately updated and offline resilient
  const localItems = getLocalLernhilfen();
  const existingIdx = localItems.findIndex((x) => String(x.id).trim() === cleanId);
  if (existingIdx >= 0) {
    localItems[existingIdx] = updatedItem;
  } else {
    localItems.unshift(updatedItem);
  }
  saveLocalLernhilfen(localItems);

  // Sync with server disk store
  try {
    await fetch('/api/lernhilfen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem),
    });
  } catch (e) {
    console.warn('Could not sync item to server disk store:', e);
  }

  // Sync with Supabase if explicitly enabled
  const settings = getSupabaseSettings();
  const supabase = getSupabaseClient();
  if (settings.enabled && supabase) {
    try {
      const basePayload: Record<string, any> = {
        id: updatedItem.id,
        title: updatedItem.title,
        subject: updatedItem.subject || 'Allgemein',
        grade_level: updatedItem.grade_level || null,
        group_name: updatedItem.group_name || null,
        task_context: updatedItem.task_context || '',
        task_image: updatedItem.task_image || null,
        disclosure_mode: updatedItem.disclosure_mode || 'stepped',
        hints: updatedItem.hints || [],
        qr_design: updatedItem.qr_design || null,
        glossary: updatedItem.glossary || null,
        updated_at: updatedItem.updated_at,
      };

      const activePayload: Record<string, any> = { ...basePayload };
      const strippedColumns: string[] = [];
      let upsertError: any = null;
      let upsertSuccess = false;

      // Adaptive retry loop: If older Supabase schema misses newer columns (e.g. disclosure_mode, qr_design, task_image, group_name),
      // we extract the missing column from the error message, drop it from the payload, and retry so saving always succeeds without error!
      for (let attempt = 0; attempt < 6; attempt++) {
        const { error } = await supabase.from('lernhilfen').upsert(activePayload);
        if (!error) {
          upsertSuccess = true;
          upsertError = null;
          break;
        }

        upsertError = error;

        // Check if error is due to a missing column in PostgREST schema cache or Postgres
        // PostgREST pattern: "Could not find the 'xyz' column of 'lernhilfen' in the schema cache"
        // Postgres error: 'column "xyz" of relation "lernhilfen" does not exist'
        const colMatch =
          error.message?.match(/Could not find the '([^']+)' column/i) ||
          error.message?.match(/column '([^']+)' of/i) ||
          error.message?.match(/column "([^"]+)" does not exist/i);

        const detectedCol = colMatch ? colMatch[1] : null;

        if (detectedCol && detectedCol in activePayload) {
          strippedColumns.push(detectedCol);
          delete activePayload[detectedCol];
          continue; // retry immediately without this column
        }

        // If specific column name wasn't parsed but code is PGRST204 or message mentions column:
        if (error.code === 'PGRST204' || (error.message && error.message.toLowerCase().includes('column'))) {
          const fallbackCandidates = ['disclosure_mode', 'qr_design', 'task_image', 'group_name', 'grade_level'];
          let dropped = false;
          for (const cand of fallbackCandidates) {
            if (cand in activePayload && !strippedColumns.includes(cand)) {
              strippedColumns.push(cand);
              delete activePayload[cand];
              dropped = true;
              break;
            }
          }
          if (dropped) continue;
        }

        // Other non-column errors (e.g. RLS or network), stop retrying
        break;
      }

      if (upsertSuccess) {
        if (strippedColumns.length > 0) {
          // Saving succeeded! Notify peacefully that core data was saved in Cloud
          window.dispatchEvent(
            new CustomEvent('cloud-sync-success', {
              detail: {
                message: `In Supabase Cloud gesichert (Spalten [${strippedColumns.join(', ')}] in Supabase noch nicht vorhanden – SQL-Befehl in Einstellungen verfügbar).`,
              },
            })
          );
        } else {
          window.dispatchEvent(
            new CustomEvent('cloud-sync-success', {
              detail: {
                message: 'Erfolgreich mit Supabase Cloud synchronisiert.',
              },
            })
          );
        }
      } else if (upsertError) {
        let userMessage = `Cloud-Speicherung: ${upsertError.message}`;
        const isUuidError = upsertError.message?.includes('uuid');
        const isColumnError = upsertError.code === 'PGRST204' || upsertError.message?.includes('column');

        if (isColumnError) {
          userMessage = `Lokal & auf Server gesichert. Supabase-Tabelle benötigt Spalten-Update (${upsertError.message})`;
        } else if (isUuidError) {
          userMessage = `Lokal & auf Server gesichert. (Spalte 'id' in Supabase ist als UUID angelegt; bitte im SQL-Editor zu TEXT ändern).`;
        } else if (upsertError.code === '42501' || upsertError.message?.includes('policy')) {
          userMessage = `Lokal & auf Server gesichert. (Supabase Cloud-Projekt ist schreibgeschützt / RLS 42501)`;
        }

        window.dispatchEvent(
          new CustomEvent('cloud-sync-error', {
            detail: {
              message: userMessage,
              rawError: upsertError,
              isUuidError,
              isColumnError,
              quickSql: SUPABASE_QUICK_FIX_SQL,
            },
          })
        );
      }
    } catch (e: any) {
      console.warn('Supabase upsert warning:', e);
      window.dispatchEvent(
        new CustomEvent('cloud-sync-error', {
          detail: {
            message: `Verbindungsfehler: ${e.message}`,
          },
        })
      );
    }
  }

  notifySyncChange();
  return updatedItem;
}

export async function deleteLernhilfe(id: string): Promise<void> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return;

  // 1. Mark as tombstone deleted ID immediately so this device and other devices never resurrect it
  markIdAsDeleted(cleanId);

  // 2. Delete from local storage immediately
  const localItems = getLocalLernhilfen().filter((x) => String(x.id).trim() !== cleanId);
  saveLocalLernhilfen(localItems);

  // 3. Delete from server disk store (and record server tombstone)
  try {
    await fetch(`/api/lernhilfen/${encodeURIComponent(cleanId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch (e) {
    console.warn('Could not delete item from server store:', e);
  }

  // 4. Delete from Supabase if explicitly enabled
  const supabase = getSupabaseClient();
  const settings = getSupabaseSettings();
  if (settings.enabled && supabase) {
    try {
      const { error } = await supabase.from('lernhilfen').delete().eq('id', cleanId);
      if (error) {
        console.warn('Supabase delete error:', error);
      }
    } catch (e) {
      console.warn('Supabase delete failed:', e);
    }
  }

  notifySyncChange();
}

export async function uploadMediaToSupabase(
  blob: Blob,
  fileName: string,
  bucketName = 'lernhilfen-media'
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const filePath = `uploads/${Date.now()}_${fileName}`;
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, blob, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      console.error('Supabase storage upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  } catch (e) {
    console.error('Failed to upload media to Supabase storage:', e);
    return null;
  }
}
