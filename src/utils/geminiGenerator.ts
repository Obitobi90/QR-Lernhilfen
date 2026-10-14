import { Hint } from '../types';

const STORAGE_KEY_GEMINI_KEY = 'lernhilfen_gemini_api_key';

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

export interface GeneratedHintItem {
  title: string;
  text: string;
}

/**
 * Generates stepped pedagogical hints (scaffolding) using Gemini Flash.
 * Strictly adheres to the rule: NEVER reveal the final answer or solution.
 */
export async function generateSteppedHintsWithAI(
  taskContext: string,
  taskTitle: string,
  imageBlobOrDataUrl?: string
): Promise<GeneratedHintItem[]> {
  const userApiKey = getStoredGeminiKey();

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
4. Antworte AUSSCHLIESSLICH als gültiges JSON-Array im folgenden Format:
[
  {
    "title": "Tipp 1: [Prägnante Überschrift]",
    "text": "[Hilfestellung mit Formeln in $...$]"
  },
  ...
]`;

  const promptText = `Aufgabentitel: ${taskTitle || 'Aufgabe'}
Aufgabenstellung: ${taskContext || 'Siehe Bildaufgabe'}`;

  // If user provided a client API key in localStorage, call Google Gemini REST API directly:
  if (userApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(userApiKey)}`;

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

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini API Fehler: Status ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Keine Antwort von Gemini erhalten.');
    }

    return parseHintsJson(rawText);
  }

  // Fallback: try calling server-side proxy route if configured
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
      if (Array.isArray(json.hints)) {
        return json.hints;
      }
    }
  } catch (e) {
    // Continue to error message
  }

  throw new Error('Kein Gemini API-Key hinterlegt! Bitte trage deinen API-Key in den Einstellungen oben rechts ein.');
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
    return parsed.map((item, idx) => ({
      title: item.title || `Tipp ${idx + 1}: Denkanstoß`,
      text: item.text || '',
    }));
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
      // If server returned an explicit error message and there's no user API key, throw it
      if (!userApiKey && errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (e: any) {
    if (!userApiKey) {
      throw e;
    }
  }

  // 2. Client-side fallback if user provided a key in localStorage
  if (userApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(userApiKey)}`;

    const contentsParts: any[] = [];
    if (imageBlobOrDataUrl.startsWith('data:image/')) {
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
      text: 'Bitte extrahiere den Aufgabentext und alle mathematischen Formeln und Zahlen exakt aus diesem Foto und verschriftliche die Aufgabenstellung.',
    });

    const systemInstruction = `Du bist ein hochpräziser didaktischer Assistent für Texterkennung (OCR) und mathematische Transkription von Schulaufgaben, Arbeitsblättern und Schulbuchseiten.
Deine Aufgabe ist es, den Aufgabentext aus dem Foto präzise, strukturiert und vollständig auf Deutsch zu verschriftlichen.

STRIKTE REGELN FÜR DIE TRANSKRIPTION:
1. MATHEMATISCHE FORMELN & SYMBOLE:
   Alle Formeln, Terme, Brüche, Wurzeln, Exponenten, Gleichungen und Variablen MÜSSEN in korrektem LaTeX formatiert werden:
   - Inline-Formeln in einfache Dollarzeichen: z.B. $f(x) = 2x^2 - 4x + 1$, $a^2 + b^2 = c^2$, $\\frac{3}{4}$, $\\sqrt{49} = 7$, $v = 50\\,\\text{km/h}$
   - Abgesetzte Formeln in doppelte Dollarzeichen: $$c = \\sqrt{a^2 + b^2}$$
2. STRUKTUR:
   Behalte Aufzählungen, Teilaufgaben (a, b, c) und Absätze exakt bei.
3. KORREKTHEIT:
   Verschriftliche exakt das, was auf dem Aufgabenfoto steht, ohne Lösung oder Abweichungen.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "extractedText": "[Vollständiger transkribierter Aufgabentext mit sauberem LaTeX $...$]",
  "suggestedTitle": "[Prägnanter Titel der Aufgabe]",
  "detectedSubject": "Mathematik"
}`;

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
      throw new Error(errData?.error?.message || `Gemini API Fehler: Status ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Keine Antwort von Gemini erhalten.');
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    return {
      extractedText: parsed.extractedText || '',
      suggestedTitle: parsed.suggestedTitle || undefined,
      detectedSubject: parsed.detectedSubject || undefined,
    };
  }

  throw new Error('Kein Gemini API-Key aktiv. Bitte prüfe die API-Key-Konfiguration in den Einstellungen.');
}

