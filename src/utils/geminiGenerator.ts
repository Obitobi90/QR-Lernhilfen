import { Hint, MediaType } from '../types';
import { generateMathPedagogicalHints } from './mathPedagogicalAi';
import { findRelevantPedagogicalMedia } from './didacticMediaFactory';

const STORAGE_KEY_GEMINI_KEY = 'lernhilfen_gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = 'lernhilfen_gemini_model';

export function getStoredGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveGeminiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key.trim());
  } catch (e) {
    console.error('Failed to save Gemini key', e);
  }
}

export function getStoredGeminiModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GEMINI_MODEL) || 'gemini-3.8-flash';
  } catch (e) {
    return 'gemini-3.8-flash';
  }
}

export function saveGeminiModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, model.trim());
  } catch (e) {
    console.error('Failed to save Gemini model', e);
  }
}

export interface GeneratedHintItem {
  title: string;
  text: string;
  mediaType?: MediaType;
  mediaData?: string;
}

export interface GenerateHintsResult {
  hints: GeneratedHintItem[];
  engineUsed: 'user_gemini' | 'server_gemini' | 'free_math_ai';
}

/**
 * Generates stepped pedagogical hints (scaffolding).
 * Uses Google Gemini (if user configured a key in Options or server has key),
 * or seamlessly defaults to the intelligent free Pedagogical Scaffolding AI engine.
 * Never blocks or fails with "Kein API Key"!
 */
export async function generateSteppedHintsWithAI(
  taskContext: string,
  taskTitle: string,
  imageBlobOrDataUrl?: string
): Promise<GenerateHintsResult> {
  const userApiKey = getStoredGeminiKey();
  const selectedModel = getStoredGeminiModel();

  const systemInstruction = `Du bist ein didaktisch erfahrener Pädagoge für gestufte Lernhilfen (Scaffolding) im Schulunterricht für alle Fächer.
Deine Aufgabe ist es, für eine gegebene Schüleraufgabe genau 3 bis 4 gestufte Denkanstöße (Tippkarten) zu generieren.

STRIKTE DIDAKTISCHE REGELN:
1. Verrate NIEMALS die direkte Lösung, das Endergebnis oder fertige Zwischenergebnisse!
2. Die Tipps müssen didaktisch gestuft sein:
   - Tipp 1 (Verstehen & Aktivieren): Formulierung der Problemstellung in eigenen Worten, Klären von gegebenen und gesuchten Größen bzw. Leitfragen.
   - Tipp 2 (Strategie & Werkzeug): Denkanstoß zur geeigneten Formel, Regel oder Methode. Nutze LaTeX für mathematische Formeln ($...$ für inline oder $$...$$ für abgesetzte Formeln).
   - Tipp 3 (Strukturierung & erster Schritt): Vorschlag für den ersten Rechenschritt oder eine Skizze/Tabelle, ohne das Resultat zu berechnen.
   - Tipp 4 (Selbstkontrolle / Plausibilität, optional): Impuls zur Überprüfung des Vorgehens oder zur Einheitenkontrolle.
3. Sprache: Deutsch, schülergerecht, ermutigend, klar formuliert.
4. Formuliere kurze, prägnante Titel OHNE vorangestelltes 'Tipp 1:' (z. B. 'Problemstellung erfassen' statt 'Tipp 1: Problemstellung').

DIDAKTISCHE MEDIEN-EINBETTUNG (OPTIONAL & GEZIELT):
Du darfst bei bestimmten Tipps passende Medien einpflegen, wenn es an der jeweiligen Stelle didaktisch sinnvoll ist:
- "image": Ein selbst erstelltes sauberes SVG-Diagramm oder Skizze als data:image/svg+xml;utf8,... (z. B. rechtwinkliges Dreieck, Koordinatensystem, Text-Strukturdiagramm).
- "youtube": Ein didaktisch passendes YouTube-Video (z. B. https://www.youtube.com/watch?v=kY8c2_367gA).
- "geogebra": Ein passendes interaktives GeoGebra-Modell (z. B. https://www.geogebra.org/m/k3mqfqea).
- "h5p": Eine interaktive H5P-Selbsttest-Übung (z. B. https://h5p.org/h5p/embed/104101).
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

  const promptText = `Aufgabentitel: ${taskTitle || 'Aufgabe'}
Aufgabenstellung: ${taskContext || 'Siehe Bildaufgabe'}`;

  // 1. Primary: Use the server-side Gemini route (included out-of-the-box, no user key needed)
  try {
    const serverRes = await fetch('/api/gemini/generate-hints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskTitle,
        taskContext,
        imageDataUrl: imageBlobOrDataUrl,
      }),
    });

    if (serverRes.ok) {
      const json = await serverRes.json();
      if (Array.isArray(json.hints) && json.hints.length > 0) {
        return {
          hints: json.hints.map((h: any, idx: number) => {
            let mediaType =
              h.mediaType &&
              ['none', 'image', 'audio', 'youtube', 'geogebra', 'h5p'].includes(h.mediaType)
                ? h.mediaType
                : 'none';
            let mediaData =
              h.mediaData && typeof h.mediaData === 'string' ? h.mediaData.trim() : undefined;
            if ((mediaType === 'none' || !mediaData) && (taskContext || taskTitle)) {
              const autoMedia = findRelevantPedagogicalMedia(taskContext, taskTitle, idx);
              if (autoMedia) {
                mediaType = autoMedia.mediaType;
                mediaData = autoMedia.mediaData;
              }
            }
            return {
              title: h.title,
              text: h.text,
              mediaType,
              mediaData,
            };
          }),
          engineUsed: 'server_gemini',
        };
      }
    }
  } catch (err) {
    console.warn('Server Gemini generate-hints failed, trying fallback...', err);
  }

  // 2. Secondary: If user provided a client API key in Options, call Google Gemini REST API directly:
  if (userApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(userApiKey)}`;

      const contentsParts: any[] = [];

      if (imageBlobOrDataUrl && imageBlobOrDataUrl.startsWith('data:image/')) {
        const match = imageBlobOrDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          contentsParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      contentsParts.push({
        text: promptText,
      });

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: contentsParts,
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return {
            hints: parseHintsJson(rawText, taskContext, taskTitle),
            engineUsed: 'user_gemini',
          };
        }
      }
    } catch (err) {
      console.warn('Error calling user Gemini API:', err);
    }
  }

  // 3. Fallback: Standard Free AI Engine (Pedagogical Scaffolding Engine for all subjects)
  const freeHints = generateMathPedagogicalHints(taskContext, taskTitle);
  return {
    hints: freeHints,
    engineUsed: 'free_math_ai',
  };
}

function parseHintsJson(rawText: string, taskContext = '', taskTitle = ''): GeneratedHintItem[] {
  let cleaned = rawText.trim();
  // Strip markdown codeblock if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) {
    const validMedia = ['none', 'image', 'audio', 'youtube', 'geogebra', 'h5p'];
    return parsed.map((item, idx) => {
      // Clean any accidental "Tipp 1:" prefix from titles so it's never duplicated
      const cleanTitle = (item.title || `Denkanstoß ${idx + 1}`)
        .replace(new RegExp(`^Tipp\\s*${idx + 1}[:.]?\\s*`, 'i'), '')
        .trim();

      let mediaType =
        item.mediaType && validMedia.includes(item.mediaType) ? item.mediaType : 'none';
      let mediaData =
        item.mediaData && typeof item.mediaData === 'string' ? item.mediaData.trim() : undefined;

      // If AI didn't provide media, see if our didacticMediaFactory can suggest a meaningful medium
      if ((mediaType === 'none' || !mediaData) && (taskContext || taskTitle)) {
        const autoMedia = findRelevantPedagogicalMedia(taskContext, taskTitle, idx);
        if (autoMedia) {
          mediaType = autoMedia.mediaType;
          mediaData = autoMedia.mediaData;
        }
      }

      return {
        title: cleanTitle || `Denkanstoß ${idx + 1}`,
        text: item.text || '',
        mediaType,
        mediaData: mediaType !== 'none' ? mediaData : undefined,
      };
    });
  }
  throw new Error('Ungültiges Antwortformat der KI.');
}

export interface ExtractedTaskData {
  extractedText: string;
  suggestedTitle?: string;
  detectedSubject?: string;
}

/**
 * Extracts task description and mathematical formulas from a photo/scan of an exercise or textbook page.
 * Mathematical expressions are strictly formatted in LaTeX ($...$ inline or $$...$$ block).
 */
export async function extractTaskTextFromImage(
  imageBlobOrDataUrl: string
): Promise<ExtractedTaskData> {
  // 1. Primary: Use the server-side Gemini AI engine (free & included out-of-the-box)
  try {
    const serverRes = await fetch('/api/gemini/extract-task-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: imageBlobOrDataUrl,
      }),
    });

    if (serverRes.ok) {
      const json = await serverRes.json();
      if (json && typeof json.extractedText === 'string') {
        return {
          extractedText: json.extractedText.trim(),
          suggestedTitle: json.suggestedTitle?.trim() || undefined,
          detectedSubject: json.detectedSubject?.trim() || undefined,
        };
      }
    } else {
      const errJson = await serverRes.json().catch(() => ({}));
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    // If the server failed with a specific meaningful error, rethrow it
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('Server OCR failed, checking for client fallback...', err);
  }

  // 2. Optional secondary client-side fallback if user configured their own key
  const userApiKey = getStoredGeminiKey();
  if (userApiKey) {
    const match = imageBlobOrDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(userApiKey)}`;

      const promptText = `Du bist ein Experte für mathematische und naturwissenschaftliche Texterkennung (OCR).
Deine Aufgabe ist es, aus dem beigefügten Foto eines Schulbuchs, Arbeitsblatts oder einer handschriftlichen Aufgabe:
1. Den Aufgabentext exakt und vollständig abzuschreiben.
2. Alle mathematischen Ausdrücke, Gleichungen, Brüche, Wurzeln und Potenzen sauber in LaTeX zu formatieren ($...$ inline oder $$...$$ für abgesetzte Formeln).
3. Einen treffenden kurzen Aufgabentitel vorzuschlagen.
4. Das Schulfach zu erkennen (Mathematik, Physik, Chemie, Biologie oder Sonstiges).

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "extractedText": "[Vollständiger Aufgabentext mit Formeln in $...$]",
  "suggestedTitle": "[Kurzer prägnanter Titel der Aufgabe]",
  "detectedSubject": "Mathematik"
}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
          }
          const parsed = JSON.parse(cleaned);
          return {
            extractedText: parsed.extractedText || '',
            suggestedTitle: parsed.suggestedTitle?.trim() || undefined,
            detectedSubject: parsed.detectedSubject?.trim() || undefined,
          };
        }
      }
    }
  }

  throw new Error(
    'Das Foto konnte nicht automatisch analysiert werden. Bitte stelle sicher, dass die Aufgabe gut beleuchtet und lesbar ist, oder gib den Text manuell ein.'
  );
}
