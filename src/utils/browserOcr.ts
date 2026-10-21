import { createWorker } from 'tesseract.js';
import type { ExtractedTaskData } from './geminiGenerator';

/**
 * Intelligent post-processor for OCR text from school textbooks & worksheets.
 * Converts raw OCR text into clean German school task text and KaTeX math formulas.
 */
export function formatOcrMathText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Replace common unicode math symbols with standard LaTeX / clean representation
  text = text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/·/g, ' \\cdot ')
    .replace(/×/g, ' \\cdot ')
    .replace(/±/g, ' \\pm ')
    .replace(/°/g, '^\\circ')
    .replace(/≠/g, ' \\neq ')
    .replace(/≤/g, ' \\le ')
    .replace(/≥/g, ' \\ge ')
    .replace(/≈/g, ' \\approx ');

  // Clean lines and trim excessive whitespace
  const rawLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const formattedLines = rawLines.map((line) => {
    // If the line already has LaTeX formulas, preserve them
    if (line.includes('$')) return line;

    // Detect standalone equations like "c^2 = a^2 + b^2" or "f(x) = 2x + 1"
    const isFullEquation = /^[a-zA-Z0-9^_+*/() -]+=[a-zA-Z0-9^_+*/() -]+$/.test(line);
    if (isFullEquation && line.length > 3 && !line.includes('Aufgabe') && !line.includes('Berechne')) {
      let eq = line
        .replace(/(\d+),(\d+)/g, '$1{,}$2')
        .replace(/\b(cm|mm|m|km|kg|g|s|h|min|minuten|grad)\b/gi, '\\,\\text{$1}');
      return `$${eq}$`;
    }

    // Format sub-exercises like "a = 3,5 cm" or "c = 12 cm" or "x = 4"
    let processed = line.replace(
      /\b([a-zA-Z](?:\([a-zA-Z0-9]+\))?)\s*=\s*([0-9]+(?:,[0-9]+)?(?:\s*[a-zA-Z]+)?)/g,
      (match, varName, value) => {
        let cleanVal = value.trim();
        cleanVal = cleanVal.replace(/(\d+),(\d+)/g, '$1{,}$2');
        cleanVal = cleanVal.replace(
          /\b(cm|mm|m|km|kg|g|s|h|min)\b/gi,
          '\\,\\text{$1}'
        );
        return `$${varName} = ${cleanVal}$`;
      }
    );

    // Format Pythagorean formula pattern: a^2 + b^2 = c^2
    processed = processed.replace(
      /\b([a-z]\^[0-9]\s*\+\s*[a-z]\^[0-9]\s*=\s*[a-z]\^[0-9])\b/gi,
      '$$$1$$'
    );

    // Format square root expressions: sqrt(x) or Wurzel(x)
    processed = processed.replace(
      /(?:sqrt|wurzel)\s*\(([^)]+)\)/gi,
      '$\\sqrt{$1}$'
    );

    return processed;
  });

  return formattedLines.join('\n\n');
}

/**
 * Detects educational subject based on keywords in recognized task text.
 */
function detectSubjectFromText(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes('pythagoras') ||
    lower.includes('dreieck') ||
    lower.includes('hypotenuse') ||
    lower.includes('kathete') ||
    lower.includes('funktion') ||
    lower.includes('parabel') ||
    lower.includes('quadrat') ||
    lower.includes('gleichung') ||
    lower.includes('bruch') ||
    lower.includes('radius') ||
    lower.includes('ableitung') ||
    lower.includes('integral') ||
    lower.includes('berechne')
  ) {
    return 'Mathematik';
  }
  if (
    lower.includes('geschwindigkeit') ||
    lower.includes('beschleunigung') ||
    lower.includes('kraft') ||
    lower.includes('newton') ||
    lower.includes('spannung') ||
    lower.includes('stromstärke') ||
    lower.includes('widerstand')
  ) {
    return 'Physik';
  }
  if (
    lower.includes('reaktion') ||
    lower.includes('molekül') ||
    lower.includes('säure') ||
    lower.includes('base') ||
    lower.includes('stoffmenge')
  ) {
    return 'Chemie';
  }
  if (
    lower.includes('zelle') ||
    lower.includes('fotosynthese') ||
    lower.includes('organ') ||
    lower.includes('genetik')
  ) {
    return 'Biologie';
  }
  if (
    lower.includes('algorithm') ||
    lower.includes('programm') ||
    lower.includes('variable') ||
    lower.includes('schleife')
  ) {
    return 'Informatik';
  }
  return 'Mathematik';
}

/**
 * Extracts a concise title from the recognized text.
 */
function deriveTitleFromText(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'Aufgabe aus Foto';

  const firstLine = lines[0];
  // If first line starts with "Aufgabe ...", clean it up
  if (firstLine.length < 60) {
    return firstLine.replace(/[$*#_]/g, '').trim();
  }
  return firstLine.substring(0, 50).trim() + '...';
}

/**
 * 100% Server-Independent OCR Engine running completely inside the browser via Tesseract.js WebAssembly / Web Workers.
 * Never fails with 404 because no server network call is required!
 */
export async function performBrowserOcr(
  imageBlobOrDataUrl: string,
  onProgress?: (percent: number, statusText: string) => void
): Promise<ExtractedTaskData> {
  let worker: any = null;

  try {
    if (onProgress) onProgress(10, 'Initialisiere Browser-Texterkennung (Offline / Serverunabhängig)...');

    // Try German language model first, with automatic fallback to English
    try {
      worker = await createWorker('deu');
    } catch (deuErr) {
      console.warn('German tesseract worker load failed, falling back to English:', deuErr);
      worker = await createWorker('eng');
    }

    if (onProgress) onProgress(40, 'Analysiere Schriftzeichen und mathematische Symbole...');

    const ret = await worker.recognize(imageBlobOrDataUrl);
    const rawText = ret?.data?.text || '';

    if (onProgress) onProgress(85, 'Formatiere Aufgabentext und mathematische Formeln...');

    const formatted = formatOcrMathText(rawText);

    if (!formatted.trim()) {
      throw new Error(
        'Die Browser-Texterkennung konnte keine Schriftzeichen im Bild finden. Bitte stelle sicher, dass das Bild scharf und nicht zu dunkel ist.'
      );
    }

    const suggestedTitle = deriveTitleFromText(formatted);
    const detectedSubject = detectSubjectFromText(formatted);

    if (onProgress) onProgress(100, 'Texterkennung erfolgreich abgeschlossen!');

    return {
      extractedText: formatted,
      suggestedTitle,
      detectedSubject,
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn('Worker termination warning:', e);
      }
    }
  }
}
