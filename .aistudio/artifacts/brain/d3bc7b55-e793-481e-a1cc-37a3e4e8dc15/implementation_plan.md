# Digitale QR-Lernhilfen & Gestufte Tippkarten

Eine moderne, responsive Web-Anwendung für den Schulunterricht zur differenzierten Lernunterstützung: Schüler greifen via QR-Code auf gestufte Denkanstöße zu, während Lehrkräfte im didaktischen Editor Tippkarten mit LaTeX, Multimedia und KI-Unterstützung erstellen.

> [!IMPORTANT]
> **Zusammenfassung der bestätigten Anforderungen:**
> - **Datenspeicherung**: Hybrider Ansatz mit lokalem Demo-Modus (inklusive vorinstallierter didaktischer Beispiel-Lernhilfen) plus Einstellungs-Modal zur Anbindung von Supabase (URL, Anon Key, E-Mail/Passwort Auth und Storage-Bucket `lernhilfen-media`).
> - **Mathematische Formeln**: KaTeX für blitzschnelles Rendering im Schüler-Viewer und Editor, kombiniert mit einem interaktiven visuellen Formeleditor (MathLive / math-field) und Schnell-Buttons für gängige Schulmathematik-Symbole ($\frac{a}{b}, \sqrt{x}, x^n, \cdot, \pi, \pm, \approx, \int, \sum$).
> - **Schüler-Ansicht**: Minimalistische, aufgeräumte und ablenkungsfreie Gestaltungsweise. Gestuftes Aufdecken (Progressive Disclosure) der Tipps ohne störende Popups. PIN-Sperre für geschützte Differenzierungsstufen.

---

## 1. Overview & Core Concept

- **Was die Anwendung bietet**: Lehrkräfte erstellen strukturierte Lernhilfen mit gestuften Impulsen ("Scaffolding"), die Schüler über einen individuellen QR-Code oder Direktlink (`?id=UUID`) öffnen. Schüler decken Impulse schrittweise auf (Tipp 1 $\to$ Tipp 2 $\to$ Tipp 3), um gezielte Denkanstöße zu erhalten, ohne dass die Lösung vorweggenommen wird.
- **Zielgruppe**: Lehrkräfte aller Schulformen (insbesondere MINT- und sprachliche Fächer) sowie Schülerinnen und Schüler auf Smartphones, Tablets oder Desktop-Geräten im Unterricht und bei Hausaufgaben.
- **Kernwert**: Binnendifferenzierung ohne Lehrkraft-Überlastung im Klassenraum. Schüler lernen eigenständig weiterzuarbeiten, wenn sie festhängen, während Lehrkräfte den Erstellungsprozess dank KI-Unterstützung auf wenige Sekunden verkürzen.

---

## 2. User Experience & Visual Design

### A. Nutzerpfade (User Flows)

1. **Schüler-Pfad (`?id=UUID`)**:
   - Scan des QR-Codes auf dem Arbeitsblatt $\to$ Öffnen im mobilen Browser ohne Login.
   - Anzeige des Aufgabentitels und des Aufgabenkontextes.
   - Anfangszustand: Nur Tipp 1 ist als geschlossene Karte sichtbar ("Tipp 1: Denkanstoß ansehen").
   - Klick öffnet Tipp 1 (flüssige Akkordeon-Animation mit KaTeX-Formeln und ggf. Audio/Bild/GeoGebra).
   - Nach dem Aufdecken erscheint darunter dynamisch der Button für "Nächsten Tipp anzeigen (Tipp 2)".
   - Falls ein Tipp PIN-geschützt ist: Diskrete 4-stellige Zifferneingabe; Inhalt wird erst nach korrektem Code freigeschaltet.

2. **Lehrer-Pfad (Hauptansicht ohne `id`)**:
   - Übersicht aller Lernhilfen im Raster/Listen-Layout mit Suchfeld, Fach-Tags und Schnellaktionen.
   - **QR-Code-Modal**: Sofortige Vorschau des QR-Codes mit druckfertiger Schüler-URL, Download als hochauflösendes PNG, "In Zwischenablage kopieren" und A4-Druckansicht für Kärtchen.
   - **Editor-Modal**: Erstellen & Bearbeiten von Lernhilfen, intuitive Sortierung der Tipps per Drag/Klick, KaTeX-Live-Vorschau, Medien-Manager (Kamera/Mikrofon) und KI-Assistent.
   - **Einstellungs-Modal**: Hinterlegung des persönlichen Gemini-API-Keys sowie Supabase-Konfiguration (mit Verbindungstest).

### B. Visuelle Identität & Design-Regeln

- **Aesthetic Direction**: Didaktisch-ruhige, fokussierte Typografie nach `references/6_education_simulations.md` (inspiriert von skandinavischen Bildungsplattformen). Hohe Kontraste, klare Hierarchien, keinerlei überflüssige visuelle Ablenkung ("Anti-Slop").
- **Farbpalette (60-30-10 Regel)**:
  - *Light Mode*: Leinwand in softem Slate-Weiß (`#F8FAFC`), strukturierte Karten in Reinweiß (`#FFFFFF`) mit feinen Haarlinien (`#E2E8F0`), Primärakzente in Bildungsinspiriertem Indigo/Deep Slate (`#4F46E5` / `#0F172A`), Statusfarben mit doppelter Codierung (Text + Piktogramm).
  - *Dark Mode*: Dunkler Slate-Hintergrund (`#0B0F19`), Karten in `#111827`, Randlinien `#1F2937`, lesbare optimierte KaTeX-Formeln.
- **Typografie**: Display-Überschriften in `Plus Jakarta Sans` / modernem Neo-Grotesk, Fließtext in hoher Lesbarkeit (16px, Zeilenabstand 1.6), mathematische Formeln gestochen scharf über KaTeX-Webfonts.

---

## 3. Key Product Decisions & Trade-Offs

- **Entscheidung 1: Hybrid-Backend (Demo-Modus mit LocalStorage + Supabase Client)**
  - *Gewählter Ansatz*: Die App startet voll funktionsfähig im Demo-Modus mit vorinstallierten, didaktischen Beispielen. Ein Konfigurationsdialog ermöglicht die Eingabe von Supabase-URL und Anon-Key für dauerhafte Cloud-Synchronisation und Supabase Auth.
  - *Warum*: Ermöglicht sofortigen Test im AI Studio Preview ohne Zwang zu externen Credentials, bietet Lehrkräften jedoch volle Produktionsreife mit Supabase.
- **Entscheidung 2: Client-seitige Bildkompression via Canvas**
  - *Gewählter Ansatz*: Vor dem Upload oder Speichern werden hochgeladene Bilder im Browser über ein Offscreen-Canvas automatisch auf max. 1200px Breite/Höhe bei 82% WebP/JPEG Qualität herunterskaliert.
  - *Warum*: Spart Speicherplatz und Bandbreite im Klassenzimmer (oft schwaches Schul-WLAN) und verhindert LocalStorage-Quota-Exceeded-Fehler.
- **Entscheidung 3: Web Audio Recording & MediaRecorder API**
  - *Gewählter Ansatz*: Natives Einsprechen von Audio-Tipps direkt im Browser mit visueller Zeitanzeige, Waveform/Pegel-Feedback, Sofort-Abspielfunktion und Export als Audio-Blob.
  - *Warum*: Ideal für Sprachförderung, Grundschulen oder Inklusion (Vorlesefunktion für leseschwache Schüler).
- **Entscheidung 4: Datenschutz-konforme YouTube- & Iframe-Einbindung**
  - *Gewählter Ansatz*: Automatische URL-Bereinigung zu `youtube-nocookie.com/embed/...`, Sandboxing für GeoGebra- und H5P-Einbettungen.
  - *Warum*: Konformität mit Datenschutz im Schulbereich (DSGVO/GDPR).

---

## 4. Technische Architektur & Datenmodell

### A. System-Architektur

```
┌────────────────────────────────────────────────────────────────────────┐
│                        URL Router (?id=UUID)                           │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ ?id vorhanden                   │ Keine id
                   ▼                                 ▼
   ┌───────────────────────────────┐ ┌───────────────────────────────────┐
   │        Schüler-Ansicht        │ │          Lehrer-Ansicht           │
   │  - Header (Titel & Kontext)   │ │  - Supabase Auth / Demo Bar       │
   │  - Gestufte Tipp-Karten       │ │  - Lernhilfen-Katalog & Suche     │
   │  - PIN-Entsperrung (4 Ziffern)│ │  - QR-Code Generator Modal        │
   │  - KaTeX & Rich-Media Player  │ │  - Lernhilfen-Editor & Drag/Drop  │
   └───────────────┬───────────────┘ └─────────────────┬─────────────────┘
                   │                                   │
                   │                                   ▼
                   │                     ┌───────────────────────────────┐
                   │                     │     KI-Tipp-Generator         │
                   │                     │   (Gemini 2.5/3.8 Flash)      │
                   │                     │   - Didaktische Scaffolding   │
                   │                     │   - Keine direkten Lösungen   │
                   │                     │   - Foto-Aufgabenstellung OCR │
                   │                     └─────────────┬─────────────────┘
                   │                                   │
                   ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Data Access Layer                              │
│   - Supabase Client (Tabelle 'lernhilfen', Bucket 'lernhilfen-media')  │
│   - LocalStorage Provider (vollständiges Fallback & Demo-Datensatz)    │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Datenstruktur (`Lernhilfe` & `Hint`)

```typescript
export interface Hint {
  id: string;
  title: string;              // z.B. "Denkanstoß: Welche Größen sind gegeben?"
  text: string;               // Text mit LaTeX ($...$, $$...$$)
  pin?: string;               // 4-stelliger Zifferncode, z.B. "2024"
  mediaType: 'none' | 'image' | 'audio' | 'youtube' | 'geogebra' | 'h5p';
  mediaData?: string;         // Base64 Data-URL oder Supabase Storage URL
}

export interface Lernhilfe {
  id: string;                 // UUID
  title: string;              // z.B. "Pythagoras im Alltag: Leiter an der Wand"
  subject?: string;           // z.B. "Mathematik", "Physik"
  task_context: string;       // Aufgabenstellung / Beschreibung
  task_image?: string;        // Optionales Foto der Aufgabenstellung
  hints: Hint[];              // Geordnete Tipp-Stufen
  created_at: string;
  updated_at: string;
}
```

### C. Komponenten-Hierarchie & Interaktions-Matrix

1. **`StudentView.tsx`**:
   - Verwaltet `unlockedIndex` (welcher Tipp ist aktuell freigeschaltet).
   - Verwaltet `pinEntered` pro PIN-geschütztem Tipp mit 4-stelligem Zahleneingabefeld und Rüttel-Animation bei falscher Eingabe.
   - Rendert Medienblöcke (Responsive Iframe für GeoGebra/H5P/YouTube, Custom Audio Player mit Zeitbalken, Bildanzeige mit Zoom).
2. **`TeacherView.tsx`**:
   - Header mit Auth-Status, Demo-Badge, Dark-Mode-Toggle und "Neue Lernhilfe"-CTA.
   - Suchleiste mit Fach-Filtern.
   - Karten-Raster mit Aktionen: Bearbeiten, Löschen, Vorschau in neuem Tab / Schüleransicht, QR-Code anzeigen.
3. **`QrCodeModal.tsx`**:
   - Generiert gestochen scharfen QR-Code mit Logo/Titel über Canvas.
   - Download als PNG, Kopieren in Zwischenablage, Kopiervorlage für Arbeitsblätter.
4. **`LernhilfeEditor.tsx`**:
   - Metadaten (Titel, Fach, Aufgabenstellung mit optionalem Foto).
   - Liste der Tipps mit Hinzufügen, Löschen und Reihenfolge-Änderung.
   - Visuelle Formeleingabe (MathLive math-field) + Symbolleiste für LaTeX-Schnelleinfügung.
   - Rich-Media-Eingabe mit nativer Audio-Aufnahme (`MediaRecorder`), Bild-Komprimierung (`Canvas 1200px`), Iframe-/Embed-Parser für YouTube, GeoGebra und H5P.
   - KI-Button "✨ Gestufte Tipps mit KI generieren" mit System-Prompt gegen Lösungsverrat.
5. **`SettingsModal.tsx`**:
   - Gemini API-Key (localStorage)
   - Supabase-Verbindungsdaten (URL, Anon Key, Bucket-Status)
6. **`LaTeXRenderer.tsx`**:
   - Sicheres Splitten und Rendern von Inline- (`$...$`) und Blockformeln (`$$...$$`) via KaTeX.

---

## 5. Verifikations- und Teststrategie

1. **Schüler-Ansicht**: Testen mit `?id=demo-pythagoras` auf mobilem und Desktop-Viewport; stufenweises Freischalten der Tipps testen; PIN-Eingabe (falsch $\to$ rot/Rütteln, richtig $\to$ Inhalt sichtbar).
2. **KaTeX-Rendering**: Testen komplexer mathematischer Ausdrücke (Brüche, Wurzeln, Exponenten) in Titeln und Texten.
3. **Multimedia**:
   - Bildkompression im Browser testen (überprüfen, dass Canvas auf max. 1200px skaliert).
   - Audioaufnahme mit Mikrofon starten, stoppen, anhören und speichern.
   - YouTube-Konvertierung auf `youtube-nocookie.com` testen.
   - GeoGebra- und H5P-Embeds testen.
4. **KI-Generator**: Testen der Tipp-Generierung mit MINT-Aufgabenstellung, Verifikation des didaktischen System-Prompts (keine Lösungen).
5. **QR-Code**: Überprüfen der generierten Links und des PNG-Downloads.
