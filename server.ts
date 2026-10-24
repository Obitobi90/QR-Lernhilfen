import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { generateOfflineDefinitionsBatch } from './src/utils/didacticGlossaryEngine';

dotenv.config();
process.env.DISABLE_HMR = 'true';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// CORS headers for local network / cross-origin preview support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to extract base64 data and mimeType from either a data URL or remote HTTP/HTTPS URL
async function getImagePart(imageDataUrlOrUrl: string | undefined): Promise<{ mimeType: string; data: string } | null> {
  if (!imageDataUrlOrUrl || typeof imageDataUrlOrUrl !== 'string') return null;

  const trimmed = imageDataUrlOrUrl.trim();

  // 1. Data URL (flexible regex & comma splitting to handle any MIME type or parameters)
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex !== -1) {
      const meta = trimmed.substring(5, commaIndex);
      const data = trimmed.substring(commaIndex + 1).replace(/\s/g, '');
      let mimeType = 'image/jpeg';
      const mimeMatch = meta.match(/^([a-zA-Z0-9.+/-]+)/);
      if (mimeMatch && mimeMatch[1] && mimeMatch[1].includes('/')) {
        mimeType = mimeMatch[1];
      }
      return { mimeType, data };
    }
  }

  // 2. Remote URL (e.g. Supabase Storage, CDN, public image URL)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const mimeType = res.headers.get('content-type') || 'image/jpeg';
      const data = Buffer.from(arrayBuffer).toString('base64');
      return { mimeType, data };
    } catch (e) {
      console.warn('Failed to fetch remote image for Gemini:', e);
      return null;
    }
  }

  return null;
}

// Robust JSON Cleaner & Parser that safely recovers unescaped LaTeX backslashes from LLM output
function cleanAndParseJson<T = any>(raw: string | undefined | null, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;

  let s = raw.trim();
  // Strip markdown code fences
  if (s.startsWith('```json')) {
    s = s.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (s.startsWith('```')) {
    s = s.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }

  // 1. First try standard JSON.parse
  try {
    return JSON.parse(s) as T;
  } catch {
    // Continue to repair
  }

  // 2. Repair unescaped LaTeX backslashes common in math output (e.g. \frac, \sqrt, \text, \,)
  try {
    const fixed = s.replace(/\\(.)/g, (match, char) => {
      // Keep standard JSON escapes: newline \n, quote \", double backslash \\
      if (char === 'n' || char === '"' || char === '\\') {
        return match;
      }
      // Double the backslash so JSON.parse keeps it as a literal backslash for LaTeX
      return '\\\\' + char;
    });
    return JSON.parse(fixed) as T;
  } catch {
    // Continue to next recovery level
  }

  // 3. Strip control characters that break JSON and fix remaining stray backslashes
  try {
    const fixed2 = s
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\\(?![\\"/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    return JSON.parse(fixed2) as T;
  } catch {
    // Continue to regex recovery
  }

  // 4. Regex extraction for OCR object
  if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
    const mText =
      s.match(/"extractedText"\s*:\s*"([\s\S]*?)"\s*,\s*"suggestedTitle"/i) ||
      s.match(/"extractedText"\s*:\s*"([\s\S]*?)"\s*}/i);
    const mTitle = s.match(/"suggestedTitle"\s*:\s*"([^"\n]*)"/i);
    const mSubj = s.match(/"detectedSubject"\s*:\s*"([^"\n]*)"/i);

    if (mText && mText[1]) {
      return {
        extractedText: mText[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
        suggestedTitle: mTitle ? mTitle[1] : undefined,
        detectedSubject: mSubj ? mSubj[1] : undefined,
      } as unknown as T;
    }

    // If the model simply returned the transcribed text without JSON wrapper
    if (s.length > 5 && !s.startsWith('{') && !s.startsWith('[')) {
      return {
        extractedText: s,
        suggestedTitle: 'Aufgabe aus Foto',
        detectedSubject: 'Mathematik',
      } as unknown as T;
    }
  }

  return fallback;
}

// Helper to call Gemini with primary model (gemini-3.1-flash-lite) and fallbacks
async function generateGeminiContentWithFallback(params: {
  contents: any;
  config: any;
}) {
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed, trying fallback:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Keine Antwort vom KI-Modell erhalten.');
}

// Server-side AI Hints Generation API Endpoint
app.post(['/api/gemini/generate-hints', '/api/gemini/generate-hints/', '/api/generate-hints', '/api/generate-hints/'], async (req, res) => {
  try {
    const { taskTitle, taskContext, imageDataUrl } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'Kein GEMINI_API_KEY auf dem Server konfiguriert.',
      });
    }

    const systemInstruction = `Du bist ein didaktisch erfahrener Pädagoge für gestufte Lernhilfen (Scaffolding) im Schulunterricht für alle Fächer.
Deine Aufgabe ist es, für eine gegebene Schüleraufgabe genau 3 bis 4 gestufte Denkanstöße (Tippkarten) zu generieren.

STRIKTE DIDAKTISCHE REGELN:
1. Verrate NIEMALS die direkte Lösung, das Endergebnis oder fertige Rechenergebnisse!
2. Die Tipps müssen didaktisch gestuft sein:
   - Tipp 1 (Verstehen & Aktivieren): Formulierung der Problemstellung in eigenen Worten, Klären von gegebenen und gesuchten Größen bzw. Leitfragen.
   - Tipp 2 (Strategie & Werkzeug): Denkanstoß zur geeigneten Formel, Regel oder Methode. Nutze LaTeX für mathematische Formeln ($...$ für inline oder $$...$$ für abgesetzte Formeln).
   - Tipp 3 (Strukturierung & erster Schritt): Vorschlag für den ersten Rechenschritt oder eine Skizze/Tabelle, ohne das Resultat zu berechnen.
   - Tipp 4 (Selbstkontrolle / Plausibilität, optional): Impuls zur Überprüfung des Vorgehens oder zur Einheitenkontrolle.
3. Sprache: Deutsch, schülergerecht, ermutigend, klar formuliert.
4. Formuliere kurze, prägnante Titel OHNE vorangestelltes 'Tipp 1:' (z. B. 'Problemstellung erfassen' statt 'Tipp 1: Problemstellung').

DIDAKTISCHE MEDIEN (OPTIONAL & GEZIELT):
Du darfst bei bestimmten Tipps passende Medien einpflegen, wenn es an der jeweiligen Stelle sinnvoll ist:
- "image": Ein selbst erstelltes sauberes SVG-Diagramm / Skizze als data:image/svg+xml;utf8,... (z. B. Dreiecksskizze, Koordinatensystem, Ablaufdiagramm).
- "youtube": Ein didaktisch passendes YouTube-Video (z. B. https://www.youtube.com/watch?v=kY8c2_367gA).
- "geogebra": Ein passendes interaktives GeoGebra-Modell (z. B. https://www.geogebra.org/m/k3mqfqea).
- "h5p": Eine passende H5P-Selbsttest-Übung (z. B. https://h5p.org/h5p/embed/104101).
- "audio": Eine vorbereitete Audio-Erklärung oder Sprachtipp (DataUrl oder URL).
- "none": Standardwert für Tipps ohne zusätzliches Medium.

Antworte AUSSCHLIESSLICH als gültiges JSON-Array im folgenden Format:
[
  {
    "title": "[Prägnante Überschrift]",
    "text": "[Hilfestellung mit Formeln in $...$]",
    "mediaType": "none" | "image" | "youtube" | "geogebra" | "h5p" | "audio",
    "mediaData": "[Optional: SVG data:image/svg+xml,... oder URL falls mediaType != 'none']"
  }
]`;

    const parts: any[] = [];

    const imgPart = await getImagePart(imageDataUrl);
    if (imgPart) {
      parts.push({
        inlineData: {
          mimeType: imgPart.mimeType,
          data: imgPart.data,
        },
      });
    }

    parts.push({
      text: `Aufgabentitel: ${taskTitle || 'Aufgabe'}\nAufgabenstellung: ${taskContext || 'Siehe Bildaufgabe'}`,
    });

    const rawText = await generateGeminiContentWithFallback({
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const hints = cleanAndParseJson<any[]>(rawText, []);
    return res.json({ hints: Array.isArray(hints) ? hints : [] });
  } catch (error: any) {
    console.error('Error generating hints via Gemini:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate hints' });
  }
});

// Server-side AI Term Definitions Generation Endpoint (for [[Fachbegriffe]])
app.post(['/api/gemini/generate-definitions', '/api/gemini/generate-definitions/', '/api/generate-definitions'], async (req, res) => {
  try {
    const { terms, subject, gradeLevel, context } = req.body;

    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ error: 'Keine Fachbegriffe übergeben.' });
    }

    const cleanTerms = terms.map((t: any) => String(t).trim()).filter(Boolean);
    const targetSubject = subject ? String(subject).trim() : 'Mathematik';
    const targetGrade = gradeLevel ? String(gradeLevel).trim() : 'Klasse 8';
    const taskContextText = context ? String(context).trim() : '';

    // If no API key is configured on server, directly use our offline didactic curriculum engine!
    if (!process.env.GEMINI_API_KEY) {
      console.log('No GEMINI_API_KEY configured; generating curriculum-aligned definitions via didactic glossary engine.');
      const definitions = generateOfflineDefinitionsBatch(cleanTerms, targetSubject, targetGrade, taskContextText);
      return res.json({ definitions, source: 'offline-engine' });
    }

    const systemInstruction = `Du bist ein erfahrener Fachlehrer und Pädagoge für das Schulfach "${targetSubject}" an einer allgemeinbildenden Schule in Deutschland.
Deine Aufgabe ist es, für Begriffe, die in einer Schüler-Aufgabe oder in gestuften Lernhilfen markiert wurden, eine prägnante, didaktisch hochwertige und schülergerechte Mini-Definition (1 bis maximal 3 Sätze) zu erstellen.

ZIELGRUPPE & RAHMENBEDINGUNGEN:
- Schulfach: ${targetSubject} (zulässige Fächer: Mathematik, Wirtschaft-Politik, Sozialwissenschaften)
- Jahrgangsstufe / Klassenstufe: ${targetGrade}
- Aufgabenkontext (falls vorhanden): "${taskContextText || 'Allgemeiner Fachunterricht'}"

STRIKTE DIDAKTISCHE VORGABEN:

1. FACHBEZUG (STRENG AUS DEM BLICKWINKEL DES FACHS "${targetSubject}"):
   - Bei "Wirtschaft-Politik":
     * Betrachte und erkläre den Begriff aus ökonomischer, politischer oder institutioneller Perspektive (z. B. "Fußball" als milliardenschwerer Wirtschaftszweig, Unterhaltungsindustrie, Markt für TV-Übertragungsrechte, Sponsoring und Vereine als Wirtschaftsunternehmen; "Markt" als Zusammentreffen von Angebot und Nachfrage; "Subsidiaritätsprinzip" als Kompetenzverteilung zwischen Staat und Bürgern).
   - Bei "Sozialwissenschaften":
     * Betrachte und erkläre den Begriff aus gesellschaftlicher, soziologischer oder sozialpolitischer Perspektive (z. B. "Fußball" als soziales Massenphänomen, Fankultur, Instrument zur gesellschaftlichen Integration und Identitätsstiftung; "Sozialstaat" als System zur Absicherung sozialer Lebensrisiken; "Ungleichheit" als ungleiche Verteilung von Lebenschancen).
   - Bei "Mathematik":
     * UNTERSCHEIDE STRIKT zwischen echten mathematischen Fachbegriffen und Alltagsbegriffen aus Textaufgaben:
       a) ECHTE MATHEMATISCHE FACHBEGRIFFE (z. B. Scheitelpunkt, Hypotenuse, Kathete, Binomische Formeln, Scheitelform, Ableitung, Lineare Funktion, Wahrscheinlichkeit, Kongruenz):
          -> Definiere sie mathematisch präzise und anschaulich. Falls didaktisch nützlich, dürfen kurze mathematische LaTeX-Formeln in $...$ verwendet werden (z. B. $a^2 + b^2 = c^2$, $S(d|e)$).
       b) ALLTAGSBEGRIFFE & SACHKONTEXTE (z. B. Fußball, Leiter, Fahrrad, Schwimmbecken, Schifffahrt, Spielplatz):
          -> NIEMALS künstliche mathematische Formeln aufzwingen (KEINE Kugelvolumen-Formeln für einen Fußball, es sei denn der Aufgabentext fragt explizit danach!).
          -> Erkläre stattdessen den Alltagsbegriff kurz und verständlich und ordne ihn sachlich in den Kontext der Aufgabe ein (z. B. ein Fußball als Sportgerät bzw. Spielball, dessen Bewegung oder Flugbahn in der Aufgabe modelliert wird).

2. SCHÜLERGERECHTE SPRACHE (DYNAMISCH ABGESTIMMT AUF DIE JAHRGANGSSTUFE "${targetGrade}"):
   - Unterstufe (Klasse 5 - 6): Sehr anschaulich, einfache kindgerechte Worte, kurze Sätze, keine komplizierten Fremdwörter.
   - Mittelstufe (Klasse 7 - 9): Klar, sachlich, didaktisch greifbar, alltagsnah, schrittweiser Aufbau von Fachbegriffen.
   - Oberstufe (Klasse 10, EF, Q1, Q2, BBS): Fachwissenschaftlich fundiert, präzise Terminologie, theoriegeleitet und differenziert.

3. FORMALE REGELN:
   - Länge: Genau 1 bis maximal 3 Sätze.
   - Direkt auf den Punkt: Starte direkt mit der Erklärung, ohne Floskeln wie "Dieser Begriff bedeutet..." oder Höflichkeitsanreden.
   - Verständlich für Schüler, sodass sie nach dem Lesen sofort weiterarbeiten können, ohne ein Lexikon wälzen zu müssen.

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt im Format:
{
  "Begriff 1": "Schülergerechte Definition in 1-3 Sätzen...",
  "Begriff 2": "..."
}`;

    const rawText = await generateGeminiContentWithFallback({
      contents: {
        parts: [
          {
            text: `Fach: ${targetSubject}\nJahrgangsstufe: ${targetGrade}\nAufgabenkontext: ${taskContextText || 'Keiner'}\n\nBitte erstelle die schülergerechten Mini-Definitionen für folgende Fachbegriffe:\n${cleanTerms.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}`,
          },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const definitions = cleanAndParseJson<Record<string, string>>(rawText, {});
    // Fall back for any missing terms to offline engine
    const offlineFallback = generateOfflineDefinitionsBatch(cleanTerms, targetSubject, targetGrade, taskContextText);
    const finalDefinitions = { ...offlineFallback, ...(definitions || {}) };

    return res.json({ definitions: finalDefinitions });
  } catch (error: any) {
    console.warn('Error generating term definitions via Gemini, falling back to didactic engine:', error.message || error);
    // Never fail with 500: always provide didactic fallback
    try {
      const { terms, subject, gradeLevel, context } = req.body || {};
      const cleanTerms = Array.isArray(terms) ? terms.map((t: any) => String(t).trim()).filter(Boolean) : [];
      const definitions = generateOfflineDefinitionsBatch(
        cleanTerms,
        subject ? String(subject) : 'Mathematik',
        gradeLevel ? String(gradeLevel) : 'Klasse 8',
        context ? String(context) : ''
      );
      return res.json({ definitions, source: 'offline-engine-fallback' });
    } catch {
      return res.status(500).json({ error: error.message || 'Failed to generate definitions' });
    }
  }
});

// Server-side AI Task & Math Formula OCR Extraction Endpoint
const ocrRoutePaths = [
  '/api/gemini/extract-task-text',
  '/api/gemini/extract-task-text/',
  '/api/extract-task-text',
  '/api/extract-task-text/',
  '/api/gemini/ocr',
  '/api/gemini/ocr/',
  '/api/ocr',
  '/api/ocr/',
  '/api/extract-text',
  '/api/extract-text/',
];

app.get(ocrRoutePaths, (_req, res) => {
  res.json({ ok: true, endpoint: 'ocr', method: 'POST', body: '{ imageDataUrl }' });
});

app.post(ocrRoutePaths, async (req, res) => {
  try {
    const { imageDataUrl } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'Kein GEMINI_API_KEY auf dem Server hinterlegt.',
      });
    }

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({
        error: 'Kein Bild übermittelt. Bitte ein Foto auswählen oder mit der Smartphone-Kamera aufnehmen.',
      });
    }

    const imgPart = await getImagePart(imageDataUrl);
    if (!imgPart) {
      return res.status(400).json({
        error: 'Das Bild konnte nicht geladen werden. Bitte stelle sicher, dass die Datei ein gültiges Bild ist.',
      });
    }

    const systemInstruction = `Du bist ein hochpräziser didaktischer Assistent für Texterkennung (OCR) und mathematische Transkription von Schulaufgaben, Arbeitsblättern und Schulbuchseiten.
Deine Aufgabe ist es, den Aufgabentext aus dem Foto oder Screenshot exakt, vollständig und schülergerecht auf Deutsch zu verschriftlichen.

STRIKTE REGELN FÜR DIE TRANSKRIPTION:
1. MATHEMATISCHE FORMELN & SYMBOLE:
   Alle Formeln, Terme, Brüche, Wurzeln, Exponenten, Gleichungen, Maßeinheiten und Variablen MÜSSEN in syntaktisch korrektem LaTeX notiert werden:
   - Inline-Formeln in einfache Dollarzeichen: z.B. $f(x) = 2x^2 - 4x + 1$, $a^2 + b^2 = c^2$, $\\frac{3}{4}$, $\\sqrt{49} = 7$, $v = 50\\,\\text{km/h}$, $\\alpha = 45^\\circ$
   - Abgesetzte oder komplexe Formeln in doppelte Dollarzeichen: $$c = \\sqrt{a^2 + b^2}$$
2. STRUKTUR & VOLLSTÄNDIGKEIT:
   - Behalte Nummerierungen (z.B. Aufgabe 1, 2a, 2b) und Absätze exakt bei.
   - Kennzeichne gegebene und gesuchte Werte übersichtlich.
3. AUTHENTIZITÄT:
   - Verändere die Aufgabe nicht und löse sie nicht. Transkribiere genau das, was auf dem Aufgabenfoto steht.
4. METADATEN:
   - Schlage einen prägnanten, didaktischen Aufgabentitel vor (z.B. "Satz des Pythagoras: Berechnung der Hypotenuse").
   - Erkenne das Fach (z.B. Mathematik, Physik, Chemie, Biologie, Informatik, Deutsch, Englisch).

WICHTIG FÜR JSON:
Maskiere jeden Backslash für LaTeX doppelt (\\\\frac statt \\frac, \\\\sqrt statt \\sqrt, \\\\text statt \\text, \\\\alpha statt \\alpha), damit das JSON valide ist!

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt im folgenden Format:
{
  "extractedText": "[Vollständiger transkribierter Aufgabentext mit sauberem LaTeX $...$]",
  "suggestedTitle": "[Prägnanter Titel der Aufgabe]",
  "detectedSubject": "Mathematik"
}`;

    const rawText = await generateGeminiContentWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: 'Bitte extrahiere den Aufgabentext sowie alle mathematischen Formeln und Zahlen exakt aus diesem Foto und verschriftliche die Aufgabenstellung.',
          },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1, // Sehr niedrige Temperatur für maximale OCR- und Formel-Präzision
      },
    });

    const parsed = cleanAndParseJson<{
      extractedText?: string;
      suggestedTitle?: string;
      detectedSubject?: string;
    }>(rawText, {});

    const extractedText = (parsed.extractedText || '').trim();

    if (!extractedText) {
      return res.status(422).json({
        error: 'Auf dem Bild konnte kein Aufgabentext erkannt werden. Bitte stelle sicher, dass die Aufgabe scharf und gut lesbar ist.',
      });
    }

    return res.json({
      extractedText,
      suggestedTitle: (parsed.suggestedTitle || '').trim() || undefined,
      detectedSubject: (parsed.detectedSubject || '').trim() || undefined,
    });
  } catch (error: any) {
    console.error('Error extracting task text via Gemini:', error);
    return res.status(500).json({
      error: error.message || 'Fehler beim Extrahieren des Aufgabentexts aus dem Foto.',
    });
  }
});

// ==========================================
// STATISTICS & FEEDBACK API (QR & TIPPS)
// ==========================================
const STATS_FILE = path.resolve(process.cwd(), 'lernhilfen_stats.json');

interface StoredHintStat {
  hintId: string;
  views: number;
  helpfulCount: number;
  unhelpfulCount: number;
}

interface PupilSuggestion {
  id: string;
  lernhilfeId: string;
  text: string;
  ip: string;
  voterId: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredLernhilfeStats {
  lernhilfeId: string;
  totalViews: number;
  hintStats: Record<string, StoredHintStat>;
  suggestions?: PupilSuggestion[];
  lastViewedAt?: string;
  updatedAt: string;
}

interface VoteRecord {
  rating: 'up' | 'down';
  ip: string;
  voterId: string;
  timestamp: string;
}

let statsDb: Record<string, StoredLernhilfeStats> = {};
let votesDb: Record<string, VoteRecord> = {};

// Load stats from disk on startup
try {
  if (fs.existsSync(STATS_FILE)) {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    statsDb = parsed.stats || {};
    votesDb = parsed.votes || {};
  }
} catch (e) {
  console.warn('Could not read stats file, initializing fresh store:', e);
}

function saveStatsToDisk() {
  try {
    fs.writeFileSync(
      STATS_FILE,
      JSON.stringify({ stats: statsDb, votes: votesDb }, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.warn('Could not save stats file:', e);
  }
}

const getClientIp = (req: express.Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
};

// 1. Get statistics for a specific Lernhilfe
app.get('/api/stats/:lernhilfeId', (req, res) => {
  const { lernhilfeId } = req.params;
  const itemStats = statsDb[lernhilfeId] || {
    lernhilfeId,
    totalViews: 0,
    hintStats: {},
    updatedAt: new Date().toISOString(),
  };
  return res.json({ stats: itemStats });
});

// 2. Track view for Lernhilfe or specific hint
app.post('/api/stats/:lernhilfeId/view', (req, res) => {
  const { lernhilfeId } = req.params;
  const { hintId } = req.body || {};

  if (!statsDb[lernhilfeId]) {
    statsDb[lernhilfeId] = {
      lernhilfeId,
      totalViews: 0,
      hintStats: {},
      updatedAt: new Date().toISOString(),
    };
  }

  const stat = statsDb[lernhilfeId];
  stat.updatedAt = new Date().toISOString();
  stat.lastViewedAt = new Date().toISOString();

  // If hintId is provided, increment specific hint view count
  if (hintId && typeof hintId === 'string') {
    if (!stat.hintStats[hintId]) {
      stat.hintStats[hintId] = {
        hintId,
        views: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
      };
    }
    stat.hintStats[hintId].views += 1;
  } else {
    // General task open view
    stat.totalViews += 1;
  }

  saveStatsToDisk();
  return res.json({ success: true, stats: stat });
});

// 3. Submit feedback (Thumbs up / Thumbs down) per hint with IP & voter token verification
app.post('/api/stats/:lernhilfeId/vote', (req, res) => {
  const { lernhilfeId } = req.params;
  const { hintId, rating, voterId } = req.body || {};

  if (!hintId || !rating || (rating !== 'up' && rating !== 'down')) {
    return res.status(400).json({ error: 'Ungültige Parameter (hintId und rating up/down erforderlich).' });
  }

  const clientIp = getClientIp(req);
  const voterKey = `${lernhilfeId}:::${hintId}:::${clientIp}:::${voterId || ''}`;

  if (!statsDb[lernhilfeId]) {
    statsDb[lernhilfeId] = {
      lernhilfeId,
      totalViews: 1,
      hintStats: {},
      updatedAt: new Date().toISOString(),
    };
  }

  const stat = statsDb[lernhilfeId];
  if (!stat.hintStats[hintId]) {
    stat.hintStats[hintId] = {
      hintId,
      views: 1,
      helpfulCount: 0,
      unhelpfulCount: 0,
    };
  }

  const hintStat = stat.hintStats[hintId];
  const existingKey = Object.keys(votesDb).find((key) => {
    if (key === voterKey) return true;
    const [lId, hId, ip, vId] = key.split(':::');
    if (lId !== lernhilfeId || hId !== hintId) return false;
    if (voterId && vId && vId === voterId) return true;
    if (clientIp && ip && ip === clientIp) return true;
    return false;
  }) || voterKey;

  const existingVote = votesDb[existingKey];

  if (existingVote) {
    if (existingVote.rating === rating) {
      // User clicked the same vote button again -> remove the vote (toggle off)
      if (existingVote.rating === 'up') {
        hintStat.helpfulCount = Math.max(0, hintStat.helpfulCount - 1);
      } else {
        hintStat.unhelpfulCount = Math.max(0, hintStat.unhelpfulCount - 1);
      }
      delete votesDb[existingKey];
      stat.updatedAt = new Date().toISOString();
      saveStatsToDisk();

      return res.json({
        success: true,
        removed: true,
        currentRating: null,
        stats: stat,
      });
    } else {
      // User is changing their vote (e.g. from down to up or up to down)
      if (existingVote.rating === 'up') {
        hintStat.helpfulCount = Math.max(0, hintStat.helpfulCount - 1);
        hintStat.unhelpfulCount += 1;
      } else {
        hintStat.unhelpfulCount = Math.max(0, hintStat.unhelpfulCount - 1);
        hintStat.helpfulCount += 1;
      }
      existingVote.rating = rating;
      existingVote.timestamp = new Date().toISOString();
    }
  } else {
    // New vote from this IP/voter
    if (rating === 'up') {
      hintStat.helpfulCount += 1;
    } else {
      hintStat.unhelpfulCount += 1;
    }
    votesDb[voterKey] = {
      rating,
      ip: clientIp,
      voterId: voterId || '',
      timestamp: new Date().toISOString(),
    };
  }

  stat.updatedAt = new Date().toISOString();
  saveStatsToDisk();

  return res.json({
    success: true,
    currentRating: rating,
    stats: stat,
  });
});

// 4. Reset stats for a Lernhilfe (Teacher only)
app.post('/api/stats/:lernhilfeId/reset', (req, res) => {
  const { lernhilfeId } = req.params;
  statsDb[lernhilfeId] = {
    lernhilfeId,
    totalViews: 0,
    hintStats: {},
    suggestions: [],
    updatedAt: new Date().toISOString(),
  };

  // Remove vote records for this lernhilfe
  for (const key of Object.keys(votesDb)) {
    if (key.startsWith(`${lernhilfeId}:::`)) {
      delete votesDb[key];
    }
  }

  saveStatsToDisk();
  return res.json({ success: true, stats: statsDb[lernhilfeId] });
});

// 5. Get current pupil's suggestion for a Lernhilfe
app.get('/api/stats/:lernhilfeId/suggestion', (req, res) => {
  const { lernhilfeId } = req.params;
  const voterId = req.query.voterId as string;
  const clientIp = getClientIp(req);

  const stat = statsDb[lernhilfeId];
  if (!stat || !Array.isArray(stat.suggestions)) {
    return res.json({ suggestion: null });
  }

  const found = stat.suggestions.find(
    (s) => (voterId && s.voterId === voterId) || s.ip === clientIp
  );

  return res.json({ suggestion: found || null });
});

// 6. Submit or edit pupil's suggestion for additional/better hints
app.post('/api/stats/:lernhilfeId/suggestion', (req, res) => {
  const { lernhilfeId } = req.params;
  const { text, voterId } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text ist erforderlich' });
  }

  const clientIp = getClientIp(req);

  if (!statsDb[lernhilfeId]) {
    statsDb[lernhilfeId] = {
      lernhilfeId,
      totalViews: 1,
      hintStats: {},
      suggestions: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const stat = statsDb[lernhilfeId];
  if (!Array.isArray(stat.suggestions)) {
    stat.suggestions = [];
  }

  // Check if this pupil already submitted a suggestion (by voterId or IP)
  const existingIdx = stat.suggestions.findIndex(
    (s) => (voterId && s.voterId === voterId) || s.ip === clientIp
  );

  const cleanText = text.trim().slice(0, 1000);

  if (existingIdx >= 0) {
    // Edit existing suggestion
    stat.suggestions[existingIdx] = {
      ...stat.suggestions[existingIdx],
      text: cleanText,
      voterId: voterId || stat.suggestions[existingIdx].voterId,
      updatedAt: new Date().toISOString(),
    };
    saveStatsToDisk();
    return res.json({
      success: true,
      isEdit: true,
      suggestion: stat.suggestions[existingIdx],
    });
  } else {
    // Create new suggestion
    const newSug: PupilSuggestion = {
      id: 'sug-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      lernhilfeId,
      text: cleanText,
      ip: clientIp,
      voterId: voterId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stat.suggestions.unshift(newSug);
    saveStatsToDisk();
    return res.json({
      success: true,
      isEdit: false,
      suggestion: newSug,
    });
  }
});

// ==========================================
// PERSISTENT LERNHILFEN REPOSITORY API
// ==========================================
const ITEMS_FILE = path.resolve(process.cwd(), 'lernhilfen_store.json');

const INITIAL_SERVER_ITEMS = [
  {
    id: 'pythagoras-leiter-demo',
    title: 'Aufgabe 1: Die Feuerwehrleiter an der Hauswand',
    subject: 'Mathematik',
    grade_level: 'Klasse 9',
    group_name: 'Arbeitsblatt zum Satz des Pythagoras',
    task_context:
      'Eine 5 m lange Feuerwehrleiter wird an einer Hauswand angelehnt. Der Fußpunkt der Leiter steht 3 m von der Hauswand entfernt. In welcher Höhe $h$ berührt die Leiter die Wand?',
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    hints: [
      {
        id: 'h1',
        title: 'Tipp 1: Rechtwinkliges Dreieck skizzieren',
        text: 'Fertige eine saubere Skizze an! Hauswand, Erdboden und Leiter bilden zusammen ein rechtwinkliges Dreieck mit dem rechten Winkel $\\gamma = 90^\\circ$ zwischen Wand und Boden.\n\nIdentifiziere Katheten und Hypotenuse.',
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
    task_context:
      'Ein Fußballfeld hat eine Länge von $105\\,\\text{m}$ und eine Breite von $68\\,\\text{m}$. Ein Spieler schlägt einen weiten Diagonalpass von einer Eckfahne zur genau gegenüberliegenden Eckfahne. Wie lang ist dieser Pass (Luftlinie)?',
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
    id: 'freier-fall-physik',
    title: 'Physik: Freier Fall & Bremsweg',
    subject: 'Physik',
    grade_level: 'Klasse 10',
    group_name: 'Stationenlernen Mechanik',
    task_context:
      'Ein Stein fällt von einer $45\\,\\text{m}$ hohen Klippe ins Meer. Berechne die Fallzeit $t$ und die Auftreffgeschwindigkeit $v$, wenn der Luftwiderstand vernachlässigt wird ($g \\approx 9{,}81\\,\\text{m/s}^2$).',
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
    grade_level: 'EF',
    task_context:
      'Gleiche die Verbrennung von Propan-Gas mit Sauerstoff zu Kohlenstoffdioxid und Wasser stöchiometrisch aus:\n$$\\dots\\,\\text{C}_3\\text{H}_8 + \\dots\\,\\text{O}_2 \\longrightarrow \\dots\\,\\text{CO}_2 + \\dots\\,\\text{H}_2\\text{O}$$',
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

let itemsDb: any[] = [];
let deletedIdsDb: Set<string> = new Set<string>();

try {
  if (fs.existsSync(ITEMS_FILE)) {
    const raw = fs.readFileSync(ITEMS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      itemsDb = parsed.length > 0 ? parsed : INITIAL_SERVER_ITEMS;
    } else if (parsed && typeof parsed === 'object') {
      itemsDb = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : INITIAL_SERVER_ITEMS;
      if (Array.isArray(parsed.deletedIds)) {
        deletedIdsDb = new Set(parsed.deletedIds.map((id: any) => String(id).trim()));
      }
    } else {
      itemsDb = INITIAL_SERVER_ITEMS;
    }
  } else {
    itemsDb = INITIAL_SERVER_ITEMS;
    saveItemsToDisk();
  }
} catch (e) {
  itemsDb = INITIAL_SERVER_ITEMS;
}

function saveItemsToDisk() {
  try {
    fs.writeFileSync(
      ITEMS_FILE,
      JSON.stringify(
        {
          items: itemsDb,
          deletedIds: Array.from(deletedIdsDb),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (e) {
    console.warn('Could not save items to disk:', e);
  }
}

// 1. Get all Lernhilfen and deleted IDs (for multi-device sync)
app.get('/api/lernhilfen', (_req, res) => {
  return res.json({
    items: itemsDb,
    deletedIds: Array.from(deletedIdsDb),
  });
});

// 2. Get deleted IDs list specifically
app.get('/api/lernhilfen/deleted', (_req, res) => {
  return res.json({ deletedIds: Array.from(deletedIdsDb) });
});

// 3. Get specific Lernhilfe by id
app.get('/api/lernhilfen/:id', (req, res) => {
  const item = itemsDb.find((i) => String(i.id) === String(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Lernhilfe nicht gefunden' });
  }
  return res.json({ item });
});

// 4. Save or update Lernhilfe (supports single item or batch sync)
app.post('/api/lernhilfen', (req, res) => {
  const body = req.body;
  if (body?.batch && Array.isArray(body.batch)) {
    const itemMap = new Map<string, any>();
    itemsDb.forEach((it) => itemMap.set(String(it.id), it));

    body.batch.forEach((it: any) => {
      if (it?.id && it?.title) {
        const cleanId = String(it.id).trim();
        // CRITICAL: Never re-add / resurrect an item that has been deleted on any device
        if (!deletedIdsDb.has(cleanId)) {
          itemMap.set(cleanId, it);
        }
      }
    });

    itemsDb = Array.from(itemMap.values());
    saveItemsToDisk();
    return res.json({
      success: true,
      count: itemsDb.length,
      deletedIds: Array.from(deletedIdsDb),
    });
  }

  const newItem = body;
  if (!newItem || !newItem.id || !newItem.title) {
    return res.status(400).json({ error: 'Ungültige Daten' });
  }

  const cleanId = String(newItem.id).trim();
  // If an item is explicitly re-saved / recreated by teacher, remove from deleted tombstones
  deletedIdsDb.delete(cleanId);

  const idx = itemsDb.findIndex((i) => String(i.id) === cleanId);
  if (idx >= 0) {
    itemsDb[idx] = { ...newItem, id: cleanId, updated_at: new Date().toISOString() };
  } else {
    itemsDb.unshift({
      ...newItem,
      id: cleanId,
      created_at: newItem.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  saveItemsToDisk();
  return res.json({ success: true, item: newItem });
});

// 5. Delete Lernhilfe by id (tracks tombstone to prevent smartphone zombie resurrection)
app.delete('/api/lernhilfen/:id', (req, res) => {
  const { id } = req.params;
  const cleanId = String(id).trim();

  // Add to deleted tombstone set
  deletedIdsDb.add(cleanId);
  itemsDb = itemsDb.filter((i) => String(i.id) !== cleanId);

  // Also clean up stats and votes for this deleted item
  if (statsDb[cleanId]) {
    delete statsDb[cleanId];
  }
  for (const key of Object.keys(votesDb)) {
    if (key.startsWith(`${cleanId}:::`)) {
      delete votesDb[key];
    }
  }

  saveItemsToDisk();
  saveStatsToDisk();
  return res.json({ success: true, deletedId: cleanId });
});

// ==========================================
// URL SHORTENER API & REDIRECT ROUTES
// ==========================================
const shortUrlMemoryCache = new Map<string, string>();

async function shortenSingleUrl(longUrl: string): Promise<string> {
  const trimmed = longUrl.trim();
  if (!trimmed) return '';
  if (shortUrlMemoryCache.has(trimmed)) {
    return shortUrlMemoryCache.get(trimmed)!;
  }

  // 1. Try TinyURL API
  try {
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIStudio/1.0',
      },
    });
    if (response.ok) {
      const shortUrl = (await response.text()).trim();
      if (shortUrl && shortUrl.startsWith('http')) {
        shortUrlMemoryCache.set(trimmed, shortUrl);
        return shortUrl;
      }
    }
  } catch (err: any) {
    console.warn('TinyURL shortener failed, trying fallback:', err?.message);
  }

  // 2. Try da.gd API as fallback
  try {
    const response2 = await fetch(`https://da.gd/s?url=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIStudio/1.0',
      },
    });
    if (response2.ok) {
      const shortUrl2 = (await response2.text()).trim();
      if (shortUrl2 && shortUrl2.startsWith('http')) {
        shortUrlMemoryCache.set(trimmed, shortUrl2);
        return shortUrl2;
      }
    }
  } catch (err2: any) {
    console.warn('da.gd shortener failed:', err2?.message);
  }

  // Fallback: return original trimmed URL if external shortener unreachable
  return trimmed;
}

// Shorten single or multiple URLs
app.post('/api/shorten-url', async (req, res) => {
  try {
    const { url, urls } = req.body;
    if (url && typeof url === 'string') {
      const shortUrl = await shortenSingleUrl(url);
      return res.json({
        shortUrl,
        displayUrl: shortUrl.replace(/^https?:\/\//, ''),
      });
    }

    if (Array.isArray(urls)) {
      const results: Record<string, string> = {};
      await Promise.all(
        urls.map(async (u) => {
          if (typeof u === 'string') {
            const short = await shortenSingleUrl(u);
            results[u] = short;
          }
        })
      );
      return res.json({ results });
    }

    return res.status(400).json({ error: 'Missing url or urls parameter' });
  } catch (e: any) {
    console.error('Error in /api/shorten-url:', e);
    return res.status(500).json({ error: e.message || 'Failed to shorten URL' });
  }
});

// Direct short redirect routes for fast browser typing
app.get('/t/:id', (req, res) => {
  const { id } = req.params;
  return res.redirect(`/?id=${encodeURIComponent(id)}`);
});

app.get('/s/:id', (req, res) => {
  const { id } = req.params;
  return res.redirect(`/?id=${encodeURIComponent(id)}`);
});

// Network info endpoint to provide local IP addresses for testing on smartphones
app.get('/api/network-info', (_req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return res.json({
    port: PORT,
    ipAddresses: addresses,
    suggestedUrls: addresses.map((ip) => `http://${ip}:${PORT}`),
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Only start standalone listener when not in Vercel Serverless environment
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
