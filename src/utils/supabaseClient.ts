import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lernhilfe, SupabaseSettings } from '../types';

const STORAGE_KEY_SETTINGS = 'lernhilfen_supabase_settings';
const STORAGE_KEY_ITEMS = 'lernhilfen_local_items_v1';

export const SAMPLE_LERNHILFEN: Lernhilfe[] = [
  {
    id: 'pythagoras-leiter-demo',
    title: 'Satz des Pythagoras: Die Feuerwehrleiter',
    subject: 'Mathematik',
    task_context: 'Eine 5 m lange Feuerwehrleiter wird an einer Hauswand angelehnt. Der Fußpunkt der Leiter steht 3 m von der Hauswand entfernt. In welcher Höhe $h$ berührt die Leiter die Wand?',
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    hints: [
      {
        id: 'h1',
        title: 'Tipp 1: Rechtwinkliges Dreieck skizzieren',
        text: 'Fertige eine saubere Skizze an! Hauswand, Erdboden und Leiter bilden zusammen ein rechtwinkliges Dreieck mit dem rechten Winkel $\\gamma = 90^\\circ$ zwischen Wand und Boden.\n\nIdentifiziere:',
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
    id: 'freier-fall-physik',
    title: 'Physik: Freier Fall & Bremsweg',
    subject: 'Physik',
    task_context: 'Ein Stein fällt von einer $45\\,\\text{m}$ hohen Klippe ins Meer. Berechne die Fallzeit $t$ und die Auftreffgeschwindigkeit $v$, wenn der Luftwiderstand vernachlässigt wird ($g \\approx 9{,}81\\,\\text{m/s}^2$).',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    hints: [
      {
        id: 'pf1',
        title: 'Tipp 1: Bewegungsart bestimmen',
        text: 'Es handelt sich um eine gleichmäßig beschleunigte Bewegung ohne Anfangsgeschwindigkeit ($v_0 = 0$). Die Beschleunigung ist die Erdbeschleunigung $g = 9{,}81\\,\\text{m/s}^2$.',
        mediaType: 'none',
      },
      {
        id: 'pf2',
        title: 'Tipp 2: Formel für die Fallstrecke',
        text: 'Das Weg-Zeit-Gesetz lautet:\n$$s(t) = \\frac{1}{2} \\cdot g \\cdot t^2$$\nMultipliziere mit $2$ und teile durch $g$, um nach der Zeit $t$ aufzulösen:\n$$t = \\sqrt{\\frac{2s}{g}}$$',
        mediaType: 'geogebra',
        mediaData: 'https://www.geogebra.org/m/k3mqfqea',
      },
      {
        id: 'pf3',
        title: 'Tipp 3: Geschwindigkeit berechnen',
        text: 'Sobald du die Fallzeit $t$ berechnet hast (ca. $3\\,\\text{Sekunden}$), kannst du die Geschwindigkeit berechnen mit:\n$$v = g \\cdot t$$\nDenke an die Einheit $\\text{m/s}$ und multipliziere optional mit $3{,}6$ für $\\text{km/h}$.',
        mediaType: 'none',
      },
    ],
  },
  {
    id: 'chemie-stoechiometrie',
    title: 'Chemie: Reaktionsgleichung ausgleichen',
    subject: 'Chemie',
    task_context: 'Gleiche die Verbrennung von Propan-Gas mit Sauerstoff zu Kohlenstoffdioxid und Wasser stöchiometrisch aus:\n$$\\dots\\,\\text{C}_3\\text{H}_8 + \\dots\\,\\text{O}_2 \\longrightarrow \\dots\\,\\text{CO}_2 + \\dots\\,\\text{H}_2\\text{O}$$',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hints: [
      {
        id: 'ch1',
        title: 'Tipp 1: Reihenfolge beim Ausgleichen',
        text: 'Beginne mit den Kohlenstoffatomen (C), gleiche danach die Wasserstoffatome (H) aus und zähle erst ganz zum Schluss die Sauerstoffatome (O) auf beiden Seiten zusammen.',
        mediaType: 'none',
      },
      {
        id: 'ch2',
        title: 'Tipp 2: C und H ausgleichen',
        text: 'Links haben wir $3$ C-Atome $\\Rightarrow$ setze rechts eine $3$ vor $\\text{CO}_2$.\nLinks haben wir $8$ H-Atome $\\Rightarrow$ setze rechts eine $4$ vor $\\text{H}_2\\text{O}$ (denn $4 \\times 2 = 8$).\n\nWie viele O-Atome hast du nun auf der rechten Seite insgesamt?',
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
        enabled: parsed.enabled !== undefined ? parsed.enabled : true,
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    enabled: true,
  };
}

export function saveSupabaseSettings(settings: SupabaseSettings): void {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

let cachedSupabase: SupabaseClient | null = null;
let currentConfigKey = '';

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

// Unified Database API (Supabase or LocalStorage)
export async function fetchLernhilfen(): Promise<Lernhilfe[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lernhilfen')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error, using local fallback:', error.message);
        return getLocalLernhilfen();
      }

      if (data && data.length > 0) {
        // Map database row to Lernhilfe interface
        return data.map((row: any) => ({
          id: row.id,
          title: row.title || 'Ohne Titel',
          subject: row.subject || 'Allgemein',
          task_context: row.task_context || '',
          task_image: row.task_image || undefined,
          hints: Array.isArray(row.hints) ? row.hints : [],
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }));
      }

      // If table exists but is empty, seed initial sample cards to Supabase
      if (data && data.length === 0) {
        try {
          const seedPayload = SAMPLE_LERNHILFEN.map((item) => ({
            id: item.id,
            title: item.title,
            subject: item.subject || 'Allgemein',
            task_context: item.task_context,
            task_image: item.task_image || null,
            hints: item.hints,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));
          await supabase.from('lernhilfen').upsert(seedPayload);
          return SAMPLE_LERNHILFEN;
        } catch (seedErr) {
          console.warn('Auto-seed into Supabase failed:', seedErr);
        }
      }
    } catch (e) {
      console.warn('Supabase request failed, falling back to local storage:', e);
    }
  }

  return getLocalLernhilfen();
}

export async function fetchLernhilfeById(id: string): Promise<Lernhilfe | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lernhilfen')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          title: data.title || '',
          subject: data.subject || '',
          task_context: data.task_context || '',
          task_image: data.task_image || undefined,
          hints: Array.isArray(data.hints) ? data.hints : [],
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('Supabase fetch by ID failed, falling back to local storage:', e);
    }
  }

  const items = getLocalLernhilfen();
  return items.find((item) => item.id === id) || null;
}

export async function saveLernhilfe(item: Lernhilfe): Promise<Lernhilfe> {
  const supabase = getSupabaseClient();
  const updatedItem: Lernhilfe = {
    ...item,
    updated_at: new Date().toISOString(),
  };

  // Always update local storage so data is safely backed up
  const localItems = getLocalLernhilfen();
  const existingIdx = localItems.findIndex((x) => x.id === item.id);
  if (existingIdx >= 0) {
    localItems[existingIdx] = updatedItem;
  } else {
    localItems.unshift(updatedItem);
  }
  saveLocalLernhilfen(localItems);

  if (supabase) {
    try {
      const payload = {
        id: updatedItem.id,
        title: updatedItem.title,
        subject: updatedItem.subject || 'Allgemein',
        task_context: updatedItem.task_context,
        task_image: updatedItem.task_image || null,
        hints: updatedItem.hints,
        updated_at: updatedItem.updated_at,
      };

      const { error } = await supabase.from('lernhilfen').upsert(payload);
      if (error) {
        console.warn('Supabase upsert warning:', error.message);
      }
    } catch (e) {
      console.error('Supabase upsert failed:', e);
    }
  }

  return updatedItem;
}

export async function deleteLernhilfe(id: string): Promise<void> {
  // Delete from local storage
  const localItems = getLocalLernhilfen().filter((x) => x.id !== id);
  saveLocalLernhilfen(localItems);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('lernhilfen').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete failed:', e);
    }
  }
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
