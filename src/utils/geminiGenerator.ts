import { Hint } from '../types';
import { generateMathPedagogicalHints } from './mathPedagogicalAi';

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
}

export interface GenerateHintsResult {
  hints: GeneratedHintItem[];
  engineUsed: 'user_gemini' | 'server_gemini' | 'free_math_ai';
}

/**
 * Generates stepped pedagogical hints (scaffolding).
 * Uses Google Gemini (if user configured a key in Options or server has key),
 * or seamlessly defaults to the intelligent free Math & STEM Pedagogical AI engine.
 * Never blocks or fails with "Kein API Key"!
 */
export async function generateSteppedHintsWithAI(
  taskContext: string,
  taskTitle: string,
  imageBlobOrDataUrl?: string
): Promise<GenerateHintsResult> {
  const userApiKey = getStoredGeminiKey();
  const selectedModel = getStoredGeminiModel();

  const systemInstruction = `Du bist ein didaktisch erfahrener Pädagoge für gestufte Lernhilfen (Scaffolding) im Schulunterricht.
Deine Aufgabe ist es, für eine gegebene Schüleraufgabe genau 3 bis 4 gestufte Denkanstöße (Tippkarten) zu generieren.

STRIKTE DIDAKTISCHE REGELN:
1. Verrate NIEMALS die direkte Lösung, das Endergebnis oder fertige Zwischenergebnisse!
2. Die Tipps müssen didaktisch gestuft sein:
   - Tipp 1 (Verstehen & Aktivieren): Formulierung der Problemstellung in eigenen Worten, Klären von gegebenen und gesuchten Größen.
   - Tipp 2 (Strategie & Werkzeug): Denkanstoß zur geeigneten Formel, Regel oder Methode. Nutze LaTeX für mathematische Formeln ($...$ für inline oder $$...$$ für abgesetzte Formeln).
   - Tipp 3 (Strukturierung & erster Schritt): Vorschlag für den ersten Rechenschritt oder eine Skizze/Tabelle, ohne das Resultat zu berechnen.
   - Tipp 4 (Selbstkontrolle / Plausibilität, optional): Impuls zur Überprüfung des Vorgehens oder zur Einheitenkontrolle.
3. Sprache: Deutsch, schülergerecht, ermutigend, klar formuliert.
4. Formuliere kurze, prägnante Titel OHNE vorangestelltes 'Tipp 1:' (z. B. 'Problemstellung erfassen' statt 'Tipp 1: Problemstellung').
5. Antworte AUSSCHLIESSLICH als gültiges JSON-Array im folgenden Format:
[
  {
    "title": "[Prägnante Überschrift]",
    "text": "[Hilfestellung mit Formeln in $...$]"
  }
]`;

  const promptText = `Aufgabentitel: ${taskTitle || 'Aufgabe'}
Aufgabenstellung: ${taskContext || 'Siehe Bildaufgabe'}`;

  // 1. If user provided a client API key in Options, call Google Gemini REST API directly:
  if (userApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(userApiKey)}`;

      const contentsParts: any[] = [];

      if (imageBlobOrDataUrl && imageBlobOrDataUrl.startsWith('data:image/')) {
        const match = imageBlobOrDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
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
            hints: parseHintsJson(rawText),
            engineUsed: 'user_gemini',
          };
        }
      } else {
        console.warn('User Gemini API call failed, trying server or free math fallback...');
      }
    } catch (err) {
      console.warn('Error calling user Gemini API:', err);
    }
  }

  // 2. Try calling server-side proxy route if server has key configured
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
          hints: json.hints,
          engineUsed: 'server_gemini',
        };
      }
    }
  } catch (e) {
    // Continue to free math AI engine
  }

  // 3. Standard Free AI Engine (Specialized for Math & STEM, zero configuration, zero cost!)
  const freeHints = generateMathPedagogicalHints(taskContext, taskTitle);
  return {
    hints: freeHints,
    engineUsed: 'free_math_ai',
  };
}

function parseHintsJson(rawText: string): GeneratedHintItem[] {
  let cleaned = rawText.trim();
  // Strip markdown codeblock if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) {
    return parsed.map((item, idx) => {
      // Clean any accidental "Tipp 1:" prefix from titles so it's never duplicated
      const cleanTitle = (item.title || `Denkanstoß ${idx + 1}`)
        .replace(new RegExp(`^Tipp\\s*${idx + 1}[:.]?\\s*`, 'i'), '')
        .trim();

      return {
        title: cleanTitle || `Denkanstoß ${idx + 1}`,
        text: item.text || '',
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
  const userApiKey = getStoredGeminiKey();

  // 1. Try server-side proxy route first (uses server's configured GEMINI_API_KEY)
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
      if (!userApiKey && errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    if (!userApiKey) {
      throw new Error(
        'Für automatische Foto-Texterkennung (OCR) kannst du unter Optionen einen Google Gemini API-Key hinterlegen. Du kannst die Aufgabe auch direkt als Text eingeben.'
      );
    }
  }

  // 2. Fallback to client-side direct Gemini call if user provided a key
  if (userApiKey) {
    const match = imageBlobOrDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Ungültiges Bildformat für Texterkennung.');
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(userApiKey)}`;

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

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Texterkennung fehlgeschlagen (Status ${res.status})`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Keine Antwort von der Texterkennung erhalten.');

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

  throw new Error(
    'Für automatische Foto-Texterkennung (OCR) kannst du unter Optionen einen Google Gemini API-Key hinterlegen. Du kannst die Aufgabe auch direkt als Text eingeben.'
  );
}
