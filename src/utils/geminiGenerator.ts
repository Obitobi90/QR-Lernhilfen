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

function cleanAndParseJsonClient<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;

  let s = rawText.trim();
  if (s.startsWith('```json')) {
    s = s.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (s.startsWith('```')) {
    s = s.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }

  try {
    return JSON.parse(s) as T;
  } catch {
    // Continue
  }

  try {
    const fixed = s.replace(/\\(.)/g, (match, char) => {
      if (char === 'n' || char === '"' || char === '\\') return match;
      return '\\\\' + char;
    });
    return JSON.parse(fixed) as T;
  } catch {
    // Continue
  }

  try {
    const fixed2 = s
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\\(?![\\"/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    return JSON.parse(fixed2) as T;
  } catch {
    // Regex fallback
  }

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

function parseHintsJson(rawText: string, taskContext = '', taskTitle = ''): GeneratedHintItem[] {
  const parsed = cleanAndParseJsonClient<any[]>(rawText, []);
  if (Array.isArray(parsed) && parsed.length > 0) {
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
  return generateMathPedagogicalHints(taskContext, taskTitle);
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
  let serverErrorMessage: string | null = null;

  // 1. Primary: Use the built-in server-side Gemini AI engine (free & included out-of-the-box)
  const candidateEndpoints = [
    '/api/gemini/extract-task-text',
    '/api/extract-task-text',
    '/api/ocr',
  ];

  for (const endpoint of candidateEndpoints) {
    try {
      const serverRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: imageBlobOrDataUrl,
        }),
      });

      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json && typeof json.extractedText === 'string' && json.extractedText.trim().length > 0) {
          return {
            extractedText: json.extractedText.trim(),
            suggestedTitle: json.suggestedTitle?.trim() || undefined,
            detectedSubject: json.detectedSubject?.trim() || undefined,
          };
        } else {
          serverErrorMessage =
            json?.error ||
            'Auf dem Bild konnte kein Text erkannt werden. Bitte stelle sicher, dass die Aufgabe gut beleuchtet und lesbar ist.';
          break;
        }
      } else if (serverRes.status !== 404) {
        // If it's a specific non-404 error (e.g. 400 bad image or 422 unreadable)
        const errJson = await serverRes.json().catch(() => ({}));
        serverErrorMessage = errJson?.error || `Server meldete Status ${serverRes.status}`;
        break; // Don't try other endpoints if the server actually handled the request and gave a valid error
      } else {
        serverErrorMessage = 'Server meldete Status 404';
      }
    } catch (err: any) {
      serverErrorMessage = err?.message || 'Verbindung zum KI-Server fehlgeschlagen';
    }
  }

  // 2. Optional secondary client-side fallback if user configured their own custom key
  const userApiKey = getStoredGeminiKey();
  if (userApiKey) {
    try {
      const trimmed = imageBlobOrDataUrl.trim();
      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (trimmed.startsWith('data:')) {
        const commaIdx = trimmed.indexOf(',');
        if (commaIdx !== -1) {
          const meta = trimmed.substring(5, commaIdx);
          base64Data = trimmed.substring(commaIdx + 1).replace(/\s/g, '');
          const m = meta.match(/^([a-zA-Z0-9.+/-]+)/);
          if (m && m[1]) mimeType = m[1];
        }
      }

      if (base64Data) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(userApiKey)}`;

        const promptText = `Du bist ein hochpräziser Experte für mathematische und naturwissenschaftliche Texterkennung (OCR).
Transkribiere die Aufgabe aus dem beigefügten Bild exakt, vollständig und auf Deutsch.
Formatiere alle mathematischen Formeln, Brüche, Wurzeln und Potenzen sauber in LaTeX ($...$ oder $$...$$).
WICHTIG: Maskiere in JSON alle Backslashes doppelt (\\\\frac, \\\\sqrt, \\\\text, \\\\alpha).

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
            const parsed = cleanAndParseJsonClient<any>(rawText, {});
            if (parsed.extractedText && parsed.extractedText.trim().length > 0) {
              return {
                extractedText: parsed.extractedText.trim(),
                suggestedTitle: parsed.suggestedTitle?.trim() || undefined,
                detectedSubject: parsed.detectedSubject?.trim() || undefined,
              };
            }
          }
        }
      }
    } catch (clientErr) {
      console.warn('Client-side Gemini OCR also failed:', clientErr);
    }
  }

  // If server had a specific error message, report it clearly
  if (serverErrorMessage) {
    throw new Error(`Texterkennung nicht möglich: ${serverErrorMessage}`);
  }

  throw new Error(
    'Das Foto konnte nicht automatisch analysiert werden. Bitte stelle sicher, dass die Aufgabe gut beleuchtet und lesbar ist, oder gib den Text manuell ein.'
  );
}
