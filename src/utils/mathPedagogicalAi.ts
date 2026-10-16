import { GeneratedHintItem } from './geminiGenerator';

/**
 * High-Quality Pedagogical Math & STEM Scaffolding Engine.
 * Provides graduated (stepped) hints for classroom tasks without requiring an API key.
 * Strictly adheres to pedagogical scaffolding: NEVER reveals the final solution or result.
 * Supports German school curricula (Grades 5-13, Realschule, Gymnasium, Gesamtschule, Berufskolleg).
 */
export function generateMathPedagogicalHints(
  taskContext: string,
  taskTitle: string
): GeneratedHintItem[] {
  const combined = (taskTitle + ' ' + taskContext).trim();
  const text = combined.toLowerCase();

  // Extract numbers and potential variables/units from context
  const numbersFound = combined.match(/\b\d+([.,]\d+)?\s*(m|cm|mm|km|s|min|h|kg|g|€|%|°)?\b/gi) || [];
  const numbersDisplay = numbersFound.slice(0, 4).join(', ');

  // 1. SATZ DES PYTHAGORAS & RECHTWINKLIGE DREIECKE
  if (
    text.includes('pythagoras') ||
    text.includes('rechtwinklig') ||
    text.includes('hypotenuse') ||
    text.includes('kathete') ||
    text.includes('leiter') ||
    (text.includes('dreieck') && (text.includes('höhe') || text.includes('diagonale')))
  ) {
    return [
      {
        title: 'Problemstellung erfassen & Skizze anfertigen',
        text: `Fertige zuerst eine saubere Handskizze an! Zeichne die gegebenen Strecken ein ${numbersDisplay ? `(${numbersDisplay})` : ''} und markiere den rechten Winkel ($90^\\circ$).\n\nÜberlege: Welche Strecken bilden die beiden Katheten (am rechten Winkel) und welche ist die Hypotenuse (die längste Seite gegenüber dem rechten Winkel)?`,
      },
      {
        title: 'Mathematischen Satz & Formel aktivieren',
        text: `In jedem rechtwinkligen Dreieck gilt der Satz des Pythagoras:\n$$a^2 + b^2 = c^2$$\nWichtig: Die Hypotenuse steht immer alleine auf einer Seite der Gleichung! Handelt es sich bei deiner gesuchten Größe um eine Kathete oder um die Hypotenuse?`,
      },
      {
        title: 'Gleichung aufstellen & nach der Unbekannten umstellen',
        text: `Setze deine bekannten Zahlenwerte in die Pythagoras-Gleichung ein.\n\n- Ist die Hypotenuse $c$ gesucht, rechnest du: $$c = \\sqrt{a^2 + b^2}$$\n- Ist eine Kathete (z. B. $b$) gesucht, stelle zuerst um:\n$$b^2 = c^2 - a^2 \\quad \\Longrightarrow \\quad b = \\sqrt{c^2 - a^2}$$\nRechne die Quadrate schrittweise aus, bevor du die Wurzel ziehst.`,
      },
      {
        title: 'Plausibilitäts-Check & Einheitenkontrolle',
        text: `Überprüfe dein Ergebnis:\n1. Ist die Hypotenuse tatsächlich die längste Seite des Dreiecks?\n2. Hast du die richtige Maßeinheit (z. B. $\\text{m}$ oder $\\text{cm}$) notiert?\n3. Erscheint der Wert im Sachzusammenhang realistisch?`,
      },
    ];
  }

  // 2. TRIGONOMETRIE (SINUS, KOSINUS, TANGENS)
  if (
    text.includes('sinus') ||
    text.includes('kosinus') ||
    text.includes('cosinus') ||
    text.includes('tangens') ||
    text.includes('trigonometrie') ||
    text.includes('steigungswinkel') ||
    text.includes('höhenwinkel') ||
    text.includes('tiefenwinkel')
  ) {
    return [
      {
        title: 'Rechtwinkliges Dreieck & Seiten bezüglich des Winkels benennen',
        text: `Skizziere das rechtwinklige Dreieck und markiere den gegebenen oder gesuchten Winkel $\\alpha$.\n\nBestimme nun die drei Seiten aus der Sicht von $\\alpha$:\n- **Hypotenuse**: Längste Seite gegenüber dem rechten Winkel ($90^\\circ$).\n- **Gegenkathete**: Die Kathete, die $\\alpha$ genau gegenüberliegt.\n- **Ankathete**: Die Kathete, die an $\\alpha$ anliegt.`,
      },
      {
        title: 'Passende Winkelfunktion auswählen (Merkregel)',
        text: `Erinnere dich an die Definitionen der Winkelfunktionen:\n$$\\sin(\\alpha) = \\frac{\\text{Gegenkathete}}{\\text{Hypotenuse}}$$\n$$\\cos(\\alpha) = \\frac{\\text{Ankathete}}{\\text{Hypotenuse}}$$\n$$\\tan(\\alpha) = \\frac{\\text{Gegenkathete}}{\\text{Ankathete}}$$\n\nÜberlege: Welche zwei Größen kennst du und welche suchst du? Wähle genau die Formel, die diese Größen verknüpft!`,
      },
      {
        title: 'Gleichung umstellen & Taschenrechner bedienen',
        text: `Setze die Werte ein und stelle nach der gesuchten Größe um:\n- Ist eine Seite gesucht, multipliziere mit dem Nenner.\n- Ist der Winkel $\\alpha$ gesucht, wende die Umkehrfunktion an (z. B. $\\sin^{-1}$ bzw. $\\arcsin$).\n\nWichtig: Dein Taschenrechner muss auf Gradmaß (**DEG**, nicht RAD) eingestellt sein!`,
      },
      {
        title: 'Ergebnis überprüfen & Antwort formulieren',
        text: `Prüfe das Resultat auf Plausibilität:\n- Ein spitzer Winkel im rechtwinkligen Dreieck muss zwischen $0^\\circ$ und $90^\\circ$ liegen.\n- Die Kathete muss stets kürzer sein als die Hypotenuse.\n- Notiere einen kurzen Antwortsatz mit Einheit.`,
      },
    ];
  }

  // 3. QUADRATISCHE GLEICHUNGEN & PQ-FORMEL / MITTERNACHTSFORMEL
  if (
    text.includes('pq-formel') ||
    text.includes('quadratische gleichung') ||
    text.includes('nullstelle') ||
    text.includes('mitternachtsformel') ||
    text.includes('abc-formel') ||
    text.includes('parabel') ||
    text.includes('scheitelpunkt') ||
    text.includes('x^2') ||
    text.includes('x²')
  ) {
    return [
      {
        title: 'Gleichung auf Normalform bringen',
        text: `Bringe die Gleichung zunächst auf die quadratische Normalform:\n$$x^2 + px + q = 0$$\n\nSchritte:\n1. Bringe alle Terme auf die linke Seite, sodass rechts eine $0$ steht.\n2. Falls vor $x^2$ noch ein Faktor $a$ steht (z. B. $2x^2$), teile die gesamte Gleichung durch $a$!`,
      },
      {
        title: 'Koeffizienten p und q mit Vorzeichen ablesen',
        text: `Lies die Werte für $p$ und $q$ exakt ab – achte streng auf Minuszeichen:\n- $p$ ist die Zahl vor dem einfachen $x$.\n- $q$ ist das reine Zahlenglied ohne $x$.\n\nHalbiere $p$ und wechsle das Vorzeichen für $-\\frac{p}{2}$.`,
      },
      {
        title: 'pq-Formel anwenden & Diskriminante berechnen',
        text: `Wende die $pq$-Formel an:\n$$x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}$$\n\nBerechne zuerst den Ausdruck unter der Wurzel (die Diskriminante $D$):\n- Ist $D > 0$, gibt es zwei Lösungen ($x_1, x_2$).\n- Ist $D = 0$, gibt es genau eine doppelte Lösung.\n- Ist $D < 0$, gibt es keine reelle Lösung.`,
      },
      {
        title: 'Probe durchführen & Lösungsmenge notieren',
        text: `Führe die Probe durch: Setze deine berechneten $x$-Werte in die Ausgangsgleichung ein und prüfe, ob wirklich $0 = 0$ herauskommt.\n\nNotiere die Lösungsmenge sauber: $L = \\{x_1; x_2\\}$.`,
      },
    ];
  }

  // 4. LINEARE FUNKTIONEN & GERADENGLEICHUNGEN
  if (
    text.includes('lineare funktion') ||
    text.includes('gerade') ||
    text.includes('steigung') ||
    text.includes('y-achsenabschnitt') ||
    text.includes('steigungsdreieck') ||
    (text.includes('funktion') && text.includes('schnittpunkt'))
  ) {
    return [
      {
        title: 'Allgemeine Geradengleichung aufschreiben',
        text: `Erinnere dich an die allgemeine Geradengleichung (Hauptform):\n$$f(x) = m \\cdot x + b \\quad \\text{oder} \\quad y = m \\cdot x + b$$\n\nBedeutung der Parameter:\n- $m$ ist die Steigung der Geraden (Änderungsrate).\n- $b$ ist der $y$-Achsenabschnitt (Schnittpunkt mit der $y$-Achse bei $(0 | b)$).`,
      },
      {
        title: 'Steigung m bestimmen oder ablesen',
        text: `Sind zwei Punkte $P_1(x_1 | y_1)$ und $P_2(x_2 | y_2)$ gegeben, berechnest du die Steigung mit dem Differenzenquotienten:\n$$m = \\frac{\\Delta y}{\\Delta x} = \\frac{y_2 - y_1}{x_2 - x_1}$$\n\nAchte auf das Vorzeichen: Ist $m > 0$, steigt die Gerade; ist $m < 0$, fällt sie.`,
      },
      {
        title: 'y-Achsenabschnitt b berechnen',
        text: `Sobald du die Steigung $m$ kennst, setze die Koordinaten eines bekannten Punktes $(x | y)$ in die Gleichung ein:\n$$y = m \\cdot x + b$$\n\nLöse die lineare Gleichung nach dem verbleibenden $b$ auf.`,
      },
      {
        title: 'Funktionsgleichung formulieren & Plausibilität prüfen',
        text: `Setze $m$ und $b$ in die Geradengleichung ein (z. B. $y = 2{,}5x - 3$).\n\nPrüfe grafisch oder rechnerisch: Geht die Gerade durch den zweiten Punkt? Passt die Steigung zur Anschauung?`,
      },
    ];
  }

  // 5. LINEARE GLEICHUNGSSYSTEME (LGS)
  if (
    text.includes('gleichungssystem') ||
    text.includes('lgs') ||
    text.includes('additionsverfahren') ||
    text.includes('einsetzungsverfahren') ||
    text.includes('gleichsetzungsverfahren')
  ) {
    return [
      {
        title: 'Gleichungssystem ordnen & Unbekannte klären',
        text: `Schreibe beide Gleichungen untereinander und ordne sie so, dass $x$, $y$ und die reinen Zahlen untereinander stehen:\n$$\\begin{array}{lrcrl} \\text{I:} & a_1 x & + & b_1 y & = c_1 \\\\ \\text{II:} & a_2 x & + & b_2 y & = c_2 \\end{array}$$\n\nÜberlege: Gibt es einen Sachkontext, in dem $x$ und $y$ konkrete Größen darstellen?`,
      },
      {
        title: 'Effizientes Lösungsverfahren wählen',
        text: `Wähle das am besten geeignete Verfahren:\n- **Einsetzungsverfahren**: Ideal, wenn eine Gleichung bereits nach $x$ oder $y$ aufgelöst ist.\n- **Gleichsetzungsverfahren**: Ideal, wenn beide Gleichungen nach derselben Variablen aufgelöst sind (z. B. $y = ...$ und $y = ...$).\n- **Additionsverfahren**: Multipliziere eine oder beide Gleichungen so, dass sich ein Koeffizient beim Addieren zu $0$ aufhebt.`,
      },
      {
        title: 'Erste Variable berechnen & in zweite einsetzen',
        text: `Führe den Rechenschritt aus. Du erhältst eine Gleichung mit nur noch einer Unbekannten.\n\nLöse nach dieser Variablen auf. Setze diesen Wert anschließend in eine der ursprünglichen Gleichungen ein, um die zweite Variable zu ermitteln.`,
      },
      {
        title: 'Probe in beiden Gleichungen & Lösungsmenge',
        text: `Mache die Probe, indem du dein Wertepaar $(x | y)$ in **beide** Ausgangsgleichungen einsetzt. Stimmen beide Gleichungen?\n\nNotiere die Lösungsmenge: $L = \\{(x | y)\\}$.`,
      },
    ];
  }

  // 6. PROZENT-, ZINS- & BRUCHRECHNUNG / DREISATZ
  if (
    text.includes('prozent') ||
    text.includes('zins') ||
    text.includes('rabatt') ||
    text.includes('dreisatz') ||
    text.includes('anteil') ||
    text.includes('mehrwertsteuer') ||
    text.includes('%')
  ) {
    return [
      {
        title: 'Grundbegriffe der Prozentrechnung zuordnen',
        text: `Identifiziere die drei Kern-Größen der Prozentrechnung:\n- **Grundwert $G$**: Das Ganze, entspricht $100\\,\\%$.\n- **Prozentwert $W$**: Der absolute Anteil in der Einheit des Grundwerts.\n- **Prozentsatz $p\\,\\%$**: Die relative Angabe in Prozent.\n\nWelche zwei Größen sind im Text gegeben ${numbersDisplay ? `(${numbersDisplay})` : ''} und welche wird gesucht?`,
      },
      {
        title: 'Formel oder Dreisatz aufstellen',
        text: `Nutze die universelle Grundformel:\n$$W = \\frac{G \\cdot p}{100} \\quad \\Longleftrightarrow \\quad W = G \\cdot \\frac{p}{100}$$\n\nOder erstelle eine Dreisatz-Tabelle:\n$$\\begin{array}{rcl} 100\\,\\% & \\longleftrightarrow & G \\\\ 1\\,\\% & \\longleftrightarrow & \\frac{G}{100} \\\\ p\\,\\% & \\longleftrightarrow & \\frac{G}{100} \\cdot p \\end{array}$$`,
      },
      {
        title: 'Nach der gesuchten Größe umstellen & berechnen',
        text: `Forme die Gleichung nach der gesuchten Größe um:\n- Ist $G$ gesucht: $$G = \\frac{W \\cdot 100}{p}$$\n- Ist $p$ gesucht: $$p = \\frac{W \\cdot 100}{G}$$\n\nAchtung bei Preiserhöhung oder Rabatt: Bei einem Rabatt von $15\\,\\%$ beträgt der verbleibende Preis $85\\,\\%$ des Grundwerts ($100\\,\\% - 15\\,\\%$).`,
      },
      {
        title: 'Plausibilitäts-Check & Antwortsatz',
        text: `Prüfe das Resultat:\n- Bei einem Rabatt muss der neue Preis kleiner sein als der alte Grundwert.\n- Bei Zinsen oder Preiserhöhungen muss der Wert größer sein.\n- Formuliere einen kurzen Antwortsatz mit Euro- oder Prozentzeichen.`,
      },
    ];
  }

  // 7. BRUCHRECHNUNG & TERMUMFORMUNGEN
  if (
    text.includes('bruch') ||
    text.includes('brüche') ||
    text.includes('hauptnenner') ||
    text.includes('kürzen') ||
    text.includes('erweitern') ||
    text.includes('binomische formel')
  ) {
    return [
      {
        title: 'Rechenarten & Regeln für Brüche identifizieren',
        text: `Bestimme die geforderten Rechenoperationen:\n- **Addition / Subtraktion**: Brüche müssen zuerst auf denselben Hauptnenner erweitert werden!\n- **Multiplikation**: Zähler mal Zähler, Nenner mal Nenner (vorher kürzen!).\n- **Division**: Multipliziere mit dem Kehrwert des zweiten Bruchs.`,
      },
      {
        title: 'Hauptnenner finden & Brüche erweitern',
        text: `Um Brüche zu addieren oder zu subtrahieren:\n1. Finde das kleinste gemeinsame Vielfache (kgV) der Nenner.\n2. Erweitere jeden Bruch entsprechend:\n$$\\frac{a}{b} \\pm \\frac{c}{d} = \\frac{a \\cdot d \\pm c \\cdot b}{b \\cdot d}$$\n\nBei Termen mit Variablen wende ggf. die binomischen Formeln an: $$(a \\pm b)^2 = a^2 \\pm 2ab + b^2 \\quad \\text{und} \\quad (a+b)(a-b) = a^2 - b^2$$`,
      },
      {
        title: 'Zähler zusammenfassen & Rechenschritt ausführen',
        text: `Fasse die Terme im Zähler zusammen. Behalte den gemeinsamen Nenner unverändert bei!\n\nAchte bei Minuszeichen vor einem Bruch darauf, dass sich das Minus auf den gesamten Zähler bezieht: $$-(a + b) = -a - b$.`,
      },
      {
        title: 'Vollständig kürzen & echte/gemischte Form angeben',
        text: `Prüfe, ob Zähler und Nenner noch gemeinsame Teiler besitzen und kürze so weit wie möglich.\n\nGib das Ergebnis als vollständig gekürzten Bruch oder als gemischte Zahl an.`,
      },
    ];
  }

  // 8. DIFFERENTIALRECHNUNG & KURVENDISKUSSION (OBERSTUFE)
  if (
    text.includes('ableitung') ||
    text.includes('extrempunkt') ||
    text.includes('hochpunkt') ||
    text.includes('tiefpunkt') ||
    text.includes('wendepunkt') ||
    text.includes('kurvendiskussion') ||
    text.includes('tangente') ||
    text.includes('steigungswinkel') ||
    text.includes("f'(x)")
  ) {
    return [
      {
        title: 'Ableitungen bilden (Potenzregel & Summenregel)',
        text: `Bilde die ersten beiden Ableitungen der Funktion $f(x)$:\n- **Erste Ableitung $f'(x)$**: Beschreibt die Steigung des Graphen in jedem Punkt.\n- **Zweite Ableitung $f''(x)$**: Beschreibt das Krümmungsverhalten des Graphen.\n\nErinnere dich an die Potenzregel: $$\\left(x^n\\right)' = n \\cdot x^{n-1}$$`,
      },
      {
        title: 'Notwendige Bedingung für Extremstellen ansetzen',
        text: `An Hoch- und Tiefpunkten ist die Tangente waagerecht (Steigung $= 0$):\n$$\\text{Notwendige Bedingung:} \\quad f'(x) = 0$$\n\nSetze die erste Ableitung gleich Null und löse die Gleichung nach $x$ auf (mögliche Extremstellen $x_E$).`,
      },
      {
        title: 'Hinreichende Bedingung & Art des Extremums prüfen',
        text: `Prüfe die Art des Extremums mit der zweiten Ableitung:\n- Ist $f''(x_E) < 0$, liegt ein **Hochpunkt (Maximum)** vor.\n- Ist $f''(x_E) > 0$, liegt ein **Tiefpunkt (Minimum)** vor.\n- Ist $f''(x_E) = 0$, ist weitere Untersuchung erforderlich (Vorzeichenwechselkriterium).`,
      },
      {
        title: 'y-Koordinaten der Punkte berechnen & Ergebnis notieren',
        text: `Wichtig: Um die $y$-Koordinate des Punktes zu bestimmen, musst du $x_E$ immer in die **Ausgangsfunktion $f(x)$** einsetzen, nicht in die Ableitung!\n\nGib die Punkte vollständig an: $H(x_H | y_H)$ bzw. $T(x_T | y_T)$.`,
      },
    ];
  }

  // 9. WAHRSCHEINLICHKEITSRECHNUNG & KOMBINATORIK
  if (
    text.includes('wahrscheinlichkeit') ||
    text.includes('baumdiagramm') ||
    text.includes('pfadregel') ||
    text.includes('urne') ||
    text.includes('ohne zurücklegen') ||
    text.includes('mit zurücklegen') ||
    text.includes('laplace') ||
    text.includes('würfel')
  ) {
    return [
      {
        title: 'Zufallsexperiment & Ereignisse definieren',
        text: `Analysiere das Zufallsexperiment genau:\n- Handelt es sich um ein einstufiges oder mehrstufiges Zufallsexperiment?\n- Findet der Vorgang **mit Zurücklegen** (Wahrscheinlichkeiten bleiben gleich) oder **ohne Zurücklegen** (Gesamtzahl und Einzelwahrscheinlichkeiten ändern sich) statt?\n\nDefiniere das gesuchte Ereignis $E$.`,
      },
      {
        title: 'Baumdiagramm skizzieren & Pfadwahrscheinlichkeiten eintragen',
        text: `Skizziere ein Baumdiagramm für die relevanten Pfade.\n\nTrage an jeden Ast die Wahrscheinlichkeit als Bruch oder Dezimalzahl ein. Achte darauf, dass die Summe der Wahrscheinlichkeiten aller Äste, die von einem Knoten ausgehen, immer $1$ ($100\\,\\%$) ergibt.`,
      },
      {
        title: 'Pfadregeln anwenden (Multiplikation & Addition)',
        text: `Wende die beiden fundamentalen Pfadregeln an:\n1. **1. Pfadregel (Multiplikationsregel)**: Die Wahrscheinlichkeit eines Pfades ist das Produkt der Wahrscheinlichkeiten längs dieses Pfades.\n2. **2. Pfadregel (Additionsregel)**: Gehören mehrere Pfade zum Ereignis $E$, addierst du die Wahrscheinlichkeiten dieser Pfade:\n$$P(E) = P(\\text{Pfad}_1) + P(\\text{Pfad}_2) + \\dots$$`,
      },
      {
        title: 'Gegenereignis prüfen & Plausibilitäts-Check',
        text: `Tipp: Frage dich, ob das Rechnen mit dem Gegenereignis $\\bar{E}$ ('mindestens einmal' $\\rightarrow$ 'gar kein Mal') schneller ist:\n$$P(E) = 1 - P(\\bar{E})$$\n\nÜberprüfe: Eine Wahrscheinlichkeit muss immer zwischen $0$ und $1$ (bzw. $0\\,\\%$ und $100\\,\\%$) liegen!`,
      },
    ];
  }

  // 10. PHYSIK & NATURWISSENSCHAFTEN (BEWEGUNG, KRAFT, ENERGIE, FREIER FALL)
  if (
    text.includes('physik') ||
    text.includes('geschwindigkeit') ||
    text.includes('beschleunigung') ||
    text.includes('freier fall') ||
    text.includes('kraft') ||
    text.includes('masse') ||
    text.includes('energie') ||
    text.includes('m/s') ||
    text.includes('km/h')
  ) {
    return [
      {
        title: 'Gegebene & gesuchte Größen mit Einheiten notieren',
        text: `Kläre die Rahmenbedingungen des physikalischen Vorgangs:\n- Liegt eine konstante Geschwindigkeit vor ($v = \\text{konstant}$)?\n- Oder eine gleichmäßig beschleunigte Bewegung (z. B. Bremsen oder freier Fall mit $a = g \\approx 9{,}81\\,\\text{m/s}^2$)?\n\nSchreibe alle gegebenen Werte mit ihren Einheiten auf.`,
      },
      {
        title: 'Passendes physikalisches Gesetz wählen',
        text: `Wähle die passende physikalische Formel:\n- Für den zurückgelegten Weg: $$s(t) = \\frac{1}{2} \\cdot a \\cdot t^2 + v_0 \\cdot t$$\n- Für die Geschwindigkeit: $$v(t) = a \\cdot t + v_0$$\n- Für Kräfte (Newtonsches Grundgesetz): $$F = m \\cdot a$$\n- Für kinetische/potentielle Energie: $$E_{\\text{kin}} = \\frac{1}{2} m v^2 \\quad \\text{und} \\quad E_{\\text{pot}} = m g h$$`,
      },
      {
        title: 'Einheiten in SI-Basiseinheiten umrechnen & Formel umstellen',
        text: `Achte stets auf SI-Basiseinheiten!\n- Rechne Geschwindigkeiten von $\\text{km/h}$ in $\\text{m/s}$ um (Teilen durch $3{,}6$).\n- Stelle die Formel nach der gesuchten Variable um, bevor du Zahlen einsetzt.`,
      },
      {
        title: 'Ergebnis & Einheitenkontrolle (Plausibilität)',
        text: `Führe eine Einheitenprobe durch: Stimmt die resultierende Einheit (z. B. $\\text{s}$, $\\text{m}$ oder $\\text{N}$)? Erscheint die Größenordnung physikalisch sinnvoll?`,
      },
    ];
  }

  // 11. UNIVERSAL-DIDAKTISCHES SCAFFOLDING FÜR ALLE SCHULAUFGABEN
  return [
    {
      title: 'Aufgabenstellung analysieren & Teilschritte erfassen',
      text: `Lies die Aufgabe gründlich durch und strukturiere dein Vorgehen:\n\n1. **Was ist gegeben?** ${numbersDisplay ? `(Werte im Text: ${numbersDisplay})` : 'Markiere alle Zahlen und Einheiten.'}\n2. **Was ist gesucht?** Notiere die genaue Zielfrage.\n3. Fertige, wenn möglich, eine Skizze oder Tabelle an.`,
    },
    {
      title: 'Strategie, mathematische Regeln & Formeln aktivieren',
      text: `Überlege, welche Gesetzmäßigkeiten, Rechenregeln oder Formeln den Zusammenhang zwischen den gegebenen und gesuchten Größen herstellen.\n\nNotiere die allgemeine mathematische Formel zunächst mit Variablen (Buchstaben), noch ohne Zahlen einzusetzen.`,
    },
    {
      title: 'Werte einsetzen & ersten Rechenschritt ausführen',
      text: `Setze deine bekannten Größen in die Formel ein.\n\nForme die Gleichung Schritt für Schritt äquivalent um, um die gesuchte Variable freizustellen. Berechne Zwischenschritte sorgfältig und achte auf Punkt-vor-Strich sowie Vorzeichen.`,
    },
    {
      title: 'Antwortsatz & Plausibilitäts-Check',
      text: `Überprüfe dein Ergebnis:\n- Beantwortet deine Zahl die ursprüngliche Fragestellung sinnvoll?\n- Hast du die richtige Maßeinheit angegeben?\n- Formuliere einen kurzen, vollständigen Antwortsatz.`,
    },
  ];
}
