import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Server-side AI Hints Generation API Endpoint
app.post('/api/gemini/generate-hints', async (req, res) => {
  try {
    const { taskTitle, taskContext, imageDataUrl } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'No GEMINI_API_KEY set on server. Please configure it in Settings Secrets.',
      });
    }

    const systemInstruction = `Du bist ein erfahrener Pädagoge für gestufte Lernhilfen (Scaffolding) im Schulunterricht.
Deine Aufgabe ist es, für eine gegebene Schüleraufgabe genau 3 bis 4 gestufte Denkanstöße (Tippkarten) zu generieren.

STRIKTE DIDAKTISCHE REGELN:
1. Verrate NIEMALS die direkte Lösung, das Endergebnis oder fertige Rechenergebnisse!
2. Die Tipps müssen didaktisch gestuft sein:
   - Tipp 1 (Verstehen & Aktivieren): Formulierung der Problemstellung in eigenen Worten, Klären von gegebenen und gesuchten Größen.
   - Tipp 2 (Strategie & Werkzeug): Denkanstoß zur geeigneten Formel, Regel oder Methode. Nutze LaTeX für mathematische Formeln ($...$ für inline oder $$...$$ für abgesetzte Formeln).
   - Tipp 3 (Strukturierung & erster Schritt): Vorschlag für den ersten Rechenschritt oder eine Skizze/Tabelle, ohne das Resultat zu berechnen.
   - Tipp 4 (Selbstkontrolle / Plausibilität, optional): Impuls zur Überprüfung des Vorgehens oder zur Einheitenkontrolle.
3. Sprache: Deutsch, schülergerecht, ermutigend, klar formuliert.
4. Antworte AUSSCHLIESSLICH als gültiges JSON-Array:
[
  {
    "title": "Tipp 1: [Prägnante Überschrift]",
    "text": "[Hilfestellung mit Formeln in $...$]"
  }
]`;

    const contents: any[] = [];

    if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        contents.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    contents.push({
      text: `Aufgabentitel: ${taskTitle || 'Aufgabe'}\nAufgabenstellung: ${taskContext || 'Siehe Bildaufgabe'}`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const rawText = response.text || '[]';
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const hints = JSON.parse(cleaned);
    return res.json({ hints });
  } catch (error: any) {
    console.error('Error generating hints via Gemini:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate hints' });
  }
});

// Server-side AI Task & Math Formula OCR Extraction Endpoint
app.post('/api/gemini/extract-task-text', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'Kein GEMINI_API_KEY auf dem Server hinterlegt. Bitte in den Einstellungen konfigurieren.',
      });
    }

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({
        error: 'Kein Bild übermittelt. Bitte ein Foto auswählen oder mit der Smartphone-Kamera aufnehmen.',
      });
    }

    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({
        error: 'Ungültiges Bildformat (erwartet wird ein base64-kodiertes Data-URL-Bild).',
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const systemInstruction = `Du bist ein hochpräziser didaktischer Assistent für Texterkennung (OCR) und mathematische Transkription von Schulaufgaben, Arbeitsblättern und Schulbuchseiten.
Deine Aufgabe ist es, den Aufgabentext aus dem Foto oder Scan exakt, vollständig und schülergerecht auf Deutsch zu verschriftlichen.

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

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt im folgenden Format:
{
  "extractedText": "[Vollständiger transkribierter Aufgabentext mit sauberem LaTeX $...$]",
  "suggestedTitle": "[Prägnanter Titel der Aufgabe]",
  "detectedSubject": "Mathematik"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
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

    const rawText = response.text || '{}';
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);

    return res.json({
      extractedText: parsed.extractedText || '',
      suggestedTitle: parsed.suggestedTitle || '',
      detectedSubject: parsed.detectedSubject || '',
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

interface StoredLernhilfeStats {
  lernhilfeId: string;
  totalViews: number;
  hintStats: Record<string, StoredHintStat>;
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
  const existingVote = votesDb[voterKey];

  if (existingVote) {
    if (existingVote.rating === rating) {
      // User has already cast this exact vote
      return res.json({
        success: true,
        alreadyVoted: true,
        currentRating: rating,
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

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
