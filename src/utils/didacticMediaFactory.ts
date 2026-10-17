import { MediaType } from '../types';

/**
 * Encodes SVG string to standard data:image/svg+xml data URL
 */
function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.trim());
}

/**
 * 1. SVG: Rechtwinkliges Dreieck mit Katheten & Hypotenuse
 */
export function getSvgRightTriangle(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 230" width="100%" height="100%">
  <rect width="380" height="230" fill="#f8fafc" rx="14" stroke="#e2e8f0" stroke-width="1.5"/>
  <path d="M 60 170 L 300 170 L 60 45 Z" fill="#e0e7ff" stroke="#3730a3" stroke-width="3" stroke-linejoin="round"/>
  <!-- Right angle mark -->
  <path d="M 60 148 L 82 148 L 82 170" fill="none" stroke="#4338ca" stroke-width="2"/>
  <circle cx="71" cy="159" r="2.5" fill="#4338ca"/>
  <!-- Points -->
  <circle cx="60" cy="170" r="4" fill="#1e1b4b"/>
  <circle cx="300" cy="170" r="4" fill="#1e1b4b"/>
  <circle cx="60" cy="45" r="4" fill="#1e1b4b"/>
  <!-- Labels -->
  <text x="50" y="190" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#64748b">C (90°)</text>
  <text x="310" y="175" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#64748b">B</text>
  <text x="50" y="35" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#64748b">A</text>
  <text x="180" y="196" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#1e1b4b" text-anchor="middle">Kathete a</text>
  <text x="34" y="112" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#1e1b4b" text-anchor="middle">Kathete b</text>
  <text x="200" y="98" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#4338ca" text-anchor="middle">Hypotenuse c (längste Seite)</text>
</svg>`;
  return svgToDataUrl(svg);
}

/**
 * 2. SVG: Trigonometrie-Dreieck mit Gegenkathete, Ankathete & Hypotenuse bezüglich Winkel Alpha
 */
export function getSvgTrigonometryTriangle(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 230" width="100%" height="100%">
  <rect width="380" height="230" fill="#f8fafc" rx="14" stroke="#e2e8f0" stroke-width="1.5"/>
  <path d="M 60 170 L 310 170 L 310 50 Z" fill="#ecfdf5" stroke="#059669" stroke-width="3" stroke-linejoin="round"/>
  <!-- Right angle at (310, 170) -->
  <path d="M 288 170 L 288 148 L 310 148" fill="none" stroke="#059669" stroke-width="2"/>
  <circle cx="299" cy="159" r="2.5" fill="#059669"/>
  <!-- Angle arc for alpha at (60, 170) -->
  <path d="M 95 170 A 35 35 0 0 0 88 145" fill="none" stroke="#d97706" stroke-width="2.5"/>
  <text x="105" y="160" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#b45309">α</text>
  <!-- Labels -->
  <text x="185" y="196" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#065f46" text-anchor="middle">Ankathete von α (liegt an α an)</text>
  <text x="345" y="112" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#065f46" text-anchor="middle">Gegenkathete</text>
  <text x="165" y="95" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#047857" text-anchor="middle">Hypotenuse</text>
</svg>`;
  return svgToDataUrl(svg);
}

/**
 * 3. SVG: Textanalyse & Argumentationsaufbau (Deutsch / Sprachen / Geschichte)
 */
export function getSvgTextAnalysisStructure(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 230" width="100%" height="100%">
  <rect width="400" height="230" fill="#f8fafc" rx="14" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Step 1: Einleitung -->
  <rect x="25" y="25" width="350" height="45" rx="8" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>
  <text x="45" y="52" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#1e1b4b">1. Einleitung</text>
  <text x="145" y="52" font-family="system-ui, sans-serif" font-size="11" fill="#4338ca">Titel · Autor · Textsorte · Entstehungszeit · Thema</text>

  <!-- Step 2: Hauptteil -->
  <rect x="25" y="85" width="350" height="70" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="45" y="112" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#78350f">2. Hauptteil (Sinnabschnitte)</text>
  <text x="45" y="138" font-family="system-ui, sans-serif" font-size="11" fill="#92400e">Behauptung (These)  ➔  Begründung  ➔  Beleg / Textzitat (Z. ...)</text>

  <!-- Step 3: Schluss -->
  <rect x="25" y="170" width="350" height="42" rx="8" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="45" y="196" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#14532d">3. Schluss / Fazit</text>
  <text x="160" y="196" font-family="system-ui, sans-serif" font-size="11" fill="#15803d">Zusammenfassung · Absicht des Autors · Eigenes Urteil</text>
</svg>`;
  return svgToDataUrl(svg);
}

/**
 * 4. SVG: Quadratische Funktion & Parabel mit Scheitelpunkt
 */
export function getSvgParabola(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 230" width="100%" height="100%">
  <rect width="380" height="230" fill="#f8fafc" rx="14" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Axes -->
  <line x1="40" y1="180" x2="340" y2="180" stroke="#94a3b8" stroke-width="2"/>
  <line x1="190" y1="210" x2="190" y2="25" stroke="#94a3b8" stroke-width="2"/>
  <!-- Arrow heads -->
  <polygon points="340,180 332,175 332,185" fill="#94a3b8"/>
  <polygon points="190,25 185,33 195,33" fill="#94a3b8"/>
  <text x="345" y="184" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">x</text>
  <text x="195" y="22" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">y</text>
  <!-- Parabola curve: S at (190, 70), opening downwards or upwards -->
  <path d="M 80 185 Q 190 30 300 185" fill="none" stroke="#7c3aed" stroke-width="3"/>
  <!-- Vertex S -->
  <circle cx="190" cy="107" r="5" fill="#e11d48"/>
  <text x="202" y="105" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#be123c">Scheitelpunkt S(d | e)</text>
  <!-- Nullstellen -->
  <circle cx="118" cy="180" r="4" fill="#2563eb"/>
  <circle cx="262" cy="180" r="4" fill="#2563eb"/>
  <text x="105" y="202" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#1d4ed8">x₁</text>
  <text x="260" y="202" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#1d4ed8">x₂</text>
</svg>`;
  return svgToDataUrl(svg);
}

/**
 * 5. SVG: Physik - Freier Fall / Beschleunigung Diagramm
 */
export function getSvgPhysicsMotion(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 230" width="100%" height="100%">
  <rect width="380" height="230" fill="#f8fafc" rx="14" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Cliff / Building -->
  <rect x="45" y="60" width="70" height="135" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
  <line x1="20" y1="195" x2="350" y2="195" stroke="#475569" stroke-width="3"/>
  <!-- Height arrow -->
  <line x1="30" y1="60" x2="30" y2="195" stroke="#2563eb" stroke-width="2" marker-start="url(#arr)" marker-end="url(#arr)"/>
  <text x="20" y="135" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#1d4ed8" text-anchor="end">Höhe h</text>
  <!-- Falling object -->
  <circle cx="150" cy="75" r="8" fill="#e11d48"/>
  <!-- Trajectory dashed -->
  <path d="M 150 75 Q 155 140 180 195" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-dasharray="4,4"/>
  <!-- Acceleration arrow g -->
  <line x1="185" y1="80" x2="185" y2="125" stroke="#059669" stroke-width="2.5"/>
  <polygon points="185,130 180,122 190,122" fill="#059669"/>
  <text x="195" y="105" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#047857">g ≈ 9,81 m/s²</text>
  <!-- Ground impact -->
  <text x="200" y="185" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#1e293b">Aufprall: v = g · t</text>
</svg>`;
  return svgToDataUrl(svg);
}

/**
 * Automatically inspects the task topic and returns a matching, meaningful pedagogical medium
 * for a specific stepped hint (e.g. Hint 1 for visual diagram, Hint 2 for video or interactive applet).
 */
export function findRelevantPedagogicalMedia(
  taskContext: string,
  taskTitle: string,
  hintIndex: number
): { mediaType: MediaType; mediaData: string } | null {
  const combined = (taskTitle + ' ' + taskContext).toLowerCase();

  // 1. SATZ DES PYTHAGORAS
  if (
    combined.includes('pythagoras') ||
    combined.includes('rechtwinklig') ||
    combined.includes('hypotenuse') ||
    combined.includes('kathete') ||
    combined.includes('leiter')
  ) {
    if (hintIndex === 0) {
      // Tipp 1: Skizze anfertigen -> SVG Right Triangle
      return {
        mediaType: 'image',
        mediaData: getSvgRightTriangle(),
      };
    }
    if (hintIndex === 1) {
      // Tipp 2: Satz des Pythagoras Erklärvideo (Lehrer Schmidt / Didaktik)
      return {
        mediaType: 'youtube',
        mediaData: 'https://www.youtube.com/watch?v=kY8c2_367gA',
      };
    }
  }

  // 2. TRIGONOMETRIE (SINUS, KOSINUS, TANGENS)
  if (
    combined.includes('sinus') ||
    combined.includes('kosinus') ||
    combined.includes('tangens') ||
    combined.includes('trigonometrie')
  ) {
    if (hintIndex === 0) {
      return {
        mediaType: 'image',
        mediaData: getSvgTrigonometryTriangle(),
      };
    }
    if (hintIndex === 1) {
      // GeoGebra Interactive Trigonometry Triangle
      return {
        mediaType: 'geogebra',
        mediaData: 'https://www.geogebra.org/m/k3mqfqea',
      };
    }
  }

  // 3. PARABEL & QUADRATISCHE FUNKTIONEN
  if (
    combined.includes('parabel') ||
    combined.includes('quadratische funktion') ||
    combined.includes('scheitelpunkt') ||
    combined.includes('pq-formel') ||
    combined.includes('nullstelle')
  ) {
    if (hintIndex === 0) {
      return {
        mediaType: 'image',
        mediaData: getSvgParabola(),
      };
    }
    if (hintIndex === 1) {
      // GeoGebra Parabel-Plotter
      return {
        mediaType: 'geogebra',
        mediaData: 'https://www.geogebra.org/m/k3mqfqea',
      };
    }
  }

  // 4. PHYSIK: FREIER FALL & BESCHLEUNIGTE BEWEGUNG
  if (
    combined.includes('freier fall') ||
    combined.includes('beschleunig') ||
    combined.includes('bremsweg') ||
    combined.includes('fallzeit') ||
    combined.includes('geschwindigkeit')
  ) {
    if (hintIndex === 0) {
      return {
        mediaType: 'image',
        mediaData: getSvgPhysicsMotion(),
      };
    }
    if (hintIndex === 1) {
      // GeoGebra Physics Model
      return {
        mediaType: 'geogebra',
        mediaData: 'https://www.geogebra.org/m/k3mqfqea',
      };
    }
  }

  // 5. DEUTSCH / ENGLISCH / TEXTE & QUELLENANALYSE
  if (
    combined.includes('text') ||
    combined.includes('analyse') ||
    combined.includes('erörter') ||
    combined.includes('charakter') ||
    combined.includes('argument') ||
    combined.includes('quelle')
  ) {
    if (hintIndex === 0) {
      return {
        mediaType: 'image',
        mediaData: getSvgTextAnalysisStructure(),
      };
    }
  }

  // 6. INTERAKTIVE ÜBUNGEN & H5P
  if (combined.includes('h5p') || combined.includes('interaktiv') || combined.includes('selbsttest')) {
    if (hintIndex === 1) {
      return {
        mediaType: 'h5p',
        mediaData: 'https://h5p.org/h5p/embed/104101',
      };
    }
  }

  return null;
}
