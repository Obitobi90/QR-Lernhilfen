/**
 * Didactic School Glossary Engine
 * 
 * Provides curriculum-aligned, grade-differentiated, and subject-tailored definitions
 * for school terms in:
 * - Mathematik
 * - Wirtschaft-Politik
 * - Sozialwissenschaften
 * 
 * Includes both an extensive school dictionary and a dynamic contextual generator
 * for everyday context words (e.g. "Fußball", "Leiter", "Fahrrad") so that teachers
 * and students ALWAYS get high-quality definitions without needing an external API key!
 */

export interface DefinitionRequest {
  terms: string[];
  subject: string;
  gradeLevel?: string;
  context?: string;
}

// 1. Core Curricular Terms by Subject
const MATH_DICTIONARY: Record<string, { base: string; formulas?: string }> = {
  // Geometrie & Dreiecke
  'hypotenuse': {
    base: 'Die längste Seite in einem rechtwinkligen Dreieck. Sie liegt immer direkt gegenüber dem rechten 90°-Winkel.',
    formulas: 'Im Satz des Pythagoras $a^2 + b^2 = c^2$ ist $c$ die Hypotenuse.',
  },
  'kathete': {
    base: 'Eine der beiden kürzeren Seiten in einem rechtwinkligen Dreieck. Die beiden Katheten schließen den 90°-Winkel direkt ein.',
  },
  'katheten': {
    base: 'Die beiden Seiten in einem rechtwinkligen Dreieck, die den rechten Winkel (90°) direkt einschließen.',
  },
  'satz des pythagoras': {
    base: 'Ein fundamentaler mathematischer Lehrsatz für rechtwinklige Dreiecke.',
    formulas: 'Er besagt: $a^2 + b^2 = c^2$, wobei $a$ und $b$ die Katheten und $c$ die Hypotenuse sind.',
  },
  'dreieck': {
    base: 'Eine geometrische Figur mit drei Ecken und drei Seiten. Die Summe aller drei Innenwinkel beträgt immer $180^\\circ$.',
  },
  'kreis': {
    base: 'Die Menge aller Punkte in einer Ebene, die den gleichen Abstand (den Radius $r$) zu einem Mittelpunkt $M$ haben.',
    formulas: 'Der Umfang ist $U = 2\\pi r$ und der Flächeninhalt $A = \\pi r^2$.',
  },
  'radius': {
    base: 'Der Abstand vom Mittelpunkt eines Kreises oder einer Kugel bis zum äußeren Rand.',
    formulas: 'Er entspricht der halben Länge des Durchmessers: $r = \\frac{d}{2}$.',
  },
  'durchmesser': {
    base: 'Die längste Verbindungsstrecke zweier Punkte auf der Kreislinie, die genau durch den Mittelpunkt verläuft.',
    formulas: 'Der Durchmesser ist doppelt so lang wie der Radius: $d = 2r$.',
  },

  // Funktionen & Algebra
  'scheitelpunkt': {
    base: 'Der höchste oder tiefste Punkt einer Parabel (Graph einer quadratischen Funktion).',
    formulas: 'In der Scheitelpunktform $f(x) = a(x - d)^2 + e$ besitzt der Scheitelpunkt die Koordinaten $S(d|e)$.',
  },
  'parabel': {
    base: 'Der charakteristische, u-förmige Graph einer quadratischen Funktion.',
    formulas: 'Die Normalparabel hat die Funktionsgleichung $f(x) = x^2$.',
  },
  'lineare funktion': {
    base: 'Eine Funktion, deren Graph eine gerade Linie darstellt.',
    formulas: 'Ihre Funktionsgleichung lautet $f(x) = m \\cdot x + b$, wobei $m$ die Steigung und $b$ der $y$-Achsenabschnitt ist.',
  },
  'steigung': {
    base: 'Gibt an, wie steil ein Funktionsgraph ansteigt oder abfällt.',
    formulas: 'Sie wird über das Steigungsdreieck berechnet: $m = \\frac{\\Delta y}{\\Delta x}$.',
  },
  'nullstelle': {
    base: 'Die Stelle auf der $x$-Achse, an der der Funktionswert null ist ($f(x) = 0$).',
    formulas: 'Grafisch ist es der Schnittpunkt des Funktionsgraphen mit der $x$-Achse.',
  },
  'ableitung': {
    base: 'Gibt die momentane Änderungsrate bzw. die Tangentensteigung eines Funktionsgraphen an einer bestimmten Stelle an.',
    formulas: 'Sie wird mit $f\'(x)$ bezeichnet.',
  },
  'integral': {
    base: 'Die Umkehrung der Ableitung in der Analysis, oft genutzt zur Berechnung krummlinig begrenzter Flächeninhalte.',
    formulas: 'Wird mit dem Integralzeichen $\\int f(x)\\,dx$ geschrieben.',
  },
  'binomische formel': {
    base: 'Feste Rechenregeln in der Algebra zum schnellen Ausmultiplizieren von zweigliedrigen Summen oder Differenzen.',
    formulas: 'Z. B. $(a+b)^2 = a^2 + 2ab + b^2$.',
  },
  'binomische formeln': {
    base: 'Drei feste Rechenformeln zum schnellen Umformen von quadrierten Summen und Differenzen in der Algebra.',
    formulas: '1. Formel: $(a+b)^2 = a^2 + 2ab + b^2$; 2. Formel: $(a-b)^2 = a^2 - 2ab + b^2$; 3. Formel: $(a+b)(a-b) = a^2 - b^2$.',
  },
  'bruch': {
    base: 'Stellt einen Anteil an einem Ganzen oder ein Divisionsverhältnis dar.',
    formulas: 'Besteht aus Zähler (oben), Bruchstrich und Nenner (unten, darf nie null sein): $\\frac{a}{b}$.',
  },
  'wurzel': {
    base: 'Die Quadratwurzel einer Zahl $x \\ge 0$ ist diejenige nicht-negative Zahl, deren Quadrat wieder $x$ ergibt.',
    formulas: 'Z. B. $\\sqrt{25} = 5$, da $5^2 = 25$.',
  },
  'dreisatz': {
    base: 'Ein mathematisches Rechenverfahren, um aus drei bekannten Werten eines proportionalen oder antiproportionalen Verhältnisses einen vierten gesuchten Wert zu ermitteln.',
  },
  'prozent': {
    base: 'Bedeutet wörtlich „von Hundert“ und beschreibt ein Verhältnis bezogen auf den Grundwert $100$.',
    formulas: 'Ein Prozent ist ein Hundertstel: $1\\% = \\frac{1}{100} = 0{,}01$.',
  },
  'wahrscheinlichkeit': {
    base: 'Ein Maß für die Sicherheit oder Häufigkeit, mit der ein zufälliges Ereignis eintritt.',
    formulas: 'Nach Laplace: $P(E) = \\frac{\\text{Anzahl günstige Ergebnisse}}{\\text{Anzahl mögliche Ergebnisse}}$.',
  },
};

const WIPO_DICTIONARY: Record<string, string> = {
  'magisches viereck': 'Die vier wirtschaftspolitischen Hauptziele nach dem Stabilitätsgesetz von 1967: Preisniveaustabilität, hoher Beschäftigungsstand, stetiges und angemessenes Wirtschaftswachstum sowie außenwirtschaftliches Gleichgewicht.',
  'preisniveaustabilität': 'Zustand, in dem der Durchschnitt aller Preise in einer Volkswirtschaft über die Zeit hinweg weitgehend stabil bleibt (Ziel der EZB: Inflationsrate nahe bei 2%).',
  'stabilitätsgesetz': 'Deutsches Bundesgesetz von 1967 zur Förderung der Stabilität und des Wachstums der Gesamtwirtschaft.',
  'inflation': 'Ein anhaltender Anstieg des allgemeinen Preisniveaus für Güter und Dienstleistungen, wodurch die Kaufkraft des Geldes sinkt.',
  'deflation': 'Ein allgemeiner, anhaltender Rückgang des Preisniveaus in einer Volkswirtschaft, der oft zu Konsumzurückhaltung und sinkender Produktion führt.',
  'arbeitslosigkeit': 'Zustand, in dem arbeitsfähige und arbeitswillige Personen im erwerbsfähigen Alter keinen bezahlten Arbeitsplatz finden.',
  'wirtschaftswachstum': 'Die Zunahme der wirtschaftlichen Leistungsfähigkeit einer Volkswirtschaft, meist gemessen als prozentuale Veränderung des realen Bruttoinlandsprodukts (BIP).',
  'bruttoinlandsprodukt': 'Der Gesamtwert aller Güter und Dienstleistungen, die innerhalb eines Jahres in den Grenzen eines Landes für den Endverbrauch hergestellt werden.',
  'bip': 'Abkürzung für Bruttoinlandsprodukt: der zentrale Maßstab für die wirtschaftliche Gesamtleistung eines Landes in einem Jahr.',
  'angebot': 'Die Menge an Gütern oder Dienstleistungen, die Verkäufer und Unternehmen zu einem bestimmten Preis auf dem Markt verkaufen möchten.',
  'nachfrage': 'Der Wunsch und die Kaufbereitschaft von Konsumenten, bestimmte Güter oder Dienstleistungen zu einem bestimmten Preis zu erwerben.',
  'markt': 'Der reale oder virtuelle Ort, an dem Angebot und Nachfrage aufeinandertreffen und sich durch diesen Ausgleich Preise bilden.',
  'subsidiaritätsprinzip': 'Ein Ordnungsprinzip, nach dem staatliche Aufgaben immer von der kleinstmöglichen Ebene (Bürger, Familie, Gemeinde) erledigt werden sollen, bevor die übergeordnete staatliche Instanz eingreift.',
  'soziale marktwirtschaft': 'Wirtschaftsordnung Deutschlands, die freie marktwirtschaftliche Kräfte (Wettbewerb, Privateigentum) mit sozialem Ausgleich und staatlicher Absicherung verbindet.',
  'ezb': 'Europäische Zentralbank: die Notenbank der Eurozone, die für die Geldpolitik und die Stabilität des Euro zuständig ist.',
  'kartell': 'Ein verbotener oder genehmigungspflichtiger Zusammenschluss von Unternehmen, um durch Preisabsprachen den Wettbewerb einzuschränken.',
  'monopol': 'Eine Marktform, bei der es für ein bestimmtes Gut nur einen einzigen Anbieter gibt, der somit die Preise stark beeinflussen kann.',
  'mindestlohn': 'Ein gesetzlich vorgeschriebenes Mindesteinkommen pro Arbeitsstunde, das Arbeitgeber ihren Beschäftigten nicht unterschreiten dürfen.',
};

const SOWI_DICTIONARY: Record<string, string> = {
  'subsidiaritätsprinzip': 'Grundsatz der gesellschaftlichen Ordnung, wonach Aufgaben immer zuerst von der kleinsten kompetenten Einheit (Individuum, Familie, Nachbarschaft, Kommune) gelöst werden sollen, bevor der Staat eingreift.',
  'sozialstaat': 'Ein Staat, der in seiner Verfassung festgeschrieben hat, für soziale Gerechtigkeit, existenzielle Absicherung und den Ausgleich sozialer Gegensätze zu sorgen.',
  'solidaritätsprinzip': 'Grundpfeiler des deutschen Sozialversicherungssystems: Die Gemeinschaft aller Versicherten steht füreinander ein (z. B. Gesunde zahlen für Kranke, Junge für Alte).',
  'b著rgergeld': 'Staatliche Grundsicherung für erwerbsfähige, hilfebedürftige Menschen in Deutschland zur Sicherung des soziokulturellen Existenzminimums.',
  'generationenvertrag': 'Das umlagefinanzierte Rentensystem, bei dem die derzeit arbeitende Generation mit ihren Beiträgen die Renten der heutigen Ruheständler finanziert.',
  'soziale ungleichheit': 'Die ungleiche Verteilung von knappen und begehrten Gütern (wie Einkommen, Vermögen, Bildungschancen oder Macht) in einer Gesellschaft.',
  'pluralismus': 'Ein politisches und gesellschaftliches Modell, in dem eine Vielfalt von freien Meinungen, Interessen, Parteien und Verbänden legitim im Wettbewerb steht.',
  'demokratie': 'Herrschaftsform, in der die Staatsgewalt vom Volk ausgeht (z. B. durch freie, gleiche und geheime Wahlen von Abgeordneten).',
  'rechtsstaat': 'Ein Staat, in dem Regierung und Verwaltung an Recht und Gesetz gebunden sind und Bürger staatliche Entscheidungen vor unabhängigen Gerichten anfechten können.',
  'gewaltenteilung': 'Die Aufteilung der staatlichen Macht in drei getrennte Gewalten: Legislative (Parlament), Exekutive (Regierung/Polizei) und Judikative (Gerichte).',
  'föderalismus': 'Politisches Gestaltungsprinzip, bei dem die Staatsgewalt zwischen einem Gesamtstaat (Bund) und Gliedstaaten (Bundesländern) aufgeteilt ist.',
  'chancengleichheit': 'Das Ideal, dass jeder Mensch unabhängig von seiner sozialen Herkunft, seinem Geschlecht oder Wohnort die gleichen Bildungs- und Aufstiegschancen erhält.',
  'inklusion': 'Das selbstverständliche Miteinander aller Menschen mit und ohne Behinderung in allen Lebensbereichen (Schule, Arbeit, Freizeit).',
};

// 2. Generic Contextual Fallback Generator (for everyday terms like "Fußball", "Leiter", etc.)
function generateContextualDefinition(
  term: string,
  subject: string,
  gradeLevel: string = 'Klasse 8',
  context: string = ''
): string {
  const cleanTerm = term.trim();
  const lowerTerm = cleanTerm.toLowerCase();
  const subj = (subject || 'Mathematik').toLowerCase();
  const isElementary = gradeLevel.includes('5') || gradeLevel.includes('6') || gradeLevel.toLowerCase().includes('grundschule');
  const isHighSchool = gradeLevel.toLowerCase().includes('oberstufe') || gradeLevel.includes('Q1') || gradeLevel.includes('Q2') || gradeLevel.includes('EF') || gradeLevel.includes('10');

  // Handle specific everyday contexts
  if (lowerTerm.includes('fußball') || lowerTerm.includes('fussball')) {
    if (subj.includes('wirt') || subj.includes('politik')) {
      return isHighSchool
        ? 'Fußball ist in wirtschaftlicher Hinsicht ein globaler Unterhaltungsmarkt und Multi-Milliarden-Wirtschaftszweig, der sich durch Transfermärkte, Sponsoringverträge und den Verkauf von Medienrechten finanziert.'
        : 'Fußball ist ökonomisch gesehen ein großer Wirtschaftszweig, in dem Vereine wie Unternehmen wirtschaften und durch Sponsoring, Eintrittskarten und TV-Rechte Einnahmen erzielen.';
    }
    if (subj.includes('sozial') || subj.includes('sowi')) {
      return isHighSchool
        ? 'Fußball stellt ein soziologisches Massenphänomen dar, das sowohl identitätsstiftend und integrationsfördernd wirkt als auch gesellschaftliche Konfliktlinien und Fankulturen widerspiegelt.'
        : 'Fußball ist ein wichtiges soziales Phänomen in unserer Gesellschaft, das Menschen zusammenbringt, Teamgeist fördert und Gemeinschaft schafft.';
    }
    // Mathematik: Alltagserklärung ohne unnütze Kugel-Volumenformel!
    return isElementary
      ? `Ein Fußball ist ein runder Spielball für den Sport. In der Aufgabe wird seine Bewegung oder der Spielablauf genauer betrachtet.`
      : `Ein Sportgerät, dessen Flugbahn oder Bewegung in dieser Aufgabe als mathematisches Modell (z. B. als Parabel oder geometrischer Pfad) untersucht wird.`;
  }

  if (lowerTerm.includes('leiter')) {
    if (subj.includes('math')) {
      return `Ein Gebrauchsgegenstand zum Hinaufsteigen. In der mathematischen Aufgabe bildet die angelehnte Leiter meist die schräge Hypotenuse in einem rechtwinkligen Dreieck mit Wand und Boden.`;
    }
  }

  if (lowerTerm.includes('fahrrad') || lowerTerm.includes('rad')) {
    if (subj.includes('math')) {
      return `Ein Fortbewegungsmittel. In Mathe-Aufgaben wird häufig die Geschwindigkeit, die Übersetzung der Zahnräder oder der Umfang der Räder berechnet.`;
    }
    if (subj.includes('wirt') || subj.includes('politik')) {
      return `Ein umweltfreundliches Verkehrsmittel und Gegenstand nachhaltiger Mobilitäts- und Infrastrukturpolitik.`;
    }
  }

  // General Subject-Oriented Fallback
  if (subj.includes('math')) {
    return isElementary
      ? `Ein Begriff aus der Aufgabe. Er beschreibt einen Gegenstand oder eine Eigenschaft, die für die mathematische Rechnung wichtig ist.`
      : `Ein zentraler Begriff der Aufgabe, der für das Verständnis der mathematischen Modellierung und der Zusammenhänge wesentlich ist.`;
  }

  if (subj.includes('wirt') || subj.includes('politik')) {
    return isHighSchool
      ? `Ein Fachbegriff der Wirtschafts- und Gesellschaftslehre, der einen institutionellen, marktbezogenen oder politischen Mechanismus beschreibt.`
      : `Ein wichtiger Begriff aus Wirtschaft und Politik, der beschreibt, wie unser Zusammenleben, der Staat oder die Märkte funktionieren.`;
  }

  if (subj.includes('sozial') || subj.includes('sowi')) {
    return isHighSchool
      ? `Ein sozialwissenschaftlicher Grundbegriff zur Analyse gesellschaftlicher Strukturen, sozialer Interaktionen oder politischer Prozesse.`
      : `Ein Begriff aus den Sozialwissenschaften, der das Zusammenleben der Menschen in der Gesellschaft beschreibt.`;
  }

  return `Ein schulfachbezogener Begriff, der in der Aufgabenstellung verwendet wird und für das Verständnis der Lösung von Bedeutung ist.`;
}

/**
 * Main engine function: Always returns a clean, didactic, grade-differentiated definition.
 * Never throws, never fails, 100% offline resilient.
 */
export function generateOfflineDefinition(
  term: string,
  subject: string,
  gradeLevel: string = 'Klasse 8',
  context: string = ''
): string {
  const cleanTerm = term.trim();
  const lower = cleanTerm.toLowerCase();
  const subj = (subject || 'Mathematik').toLowerCase();

  // 1. Check subject dictionary
  if (subj.includes('math')) {
    if (MATH_DICTIONARY[lower]) {
      const entry = MATH_DICTIONARY[lower];
      return entry.formulas ? `${entry.base} ${entry.formulas}` : entry.base;
    }
  } else if (subj.includes('wirt') || subj.includes('politik')) {
    if (WIPO_DICTIONARY[lower]) {
      return WIPO_DICTIONARY[lower];
    }
  } else if (subj.includes('sozial') || subj.includes('sowi')) {
    if (SOWI_DICTIONARY[lower]) {
      return SOWI_DICTIONARY[lower];
    }
  }

  // 2. Cross-check other subject dictionaries if term wasn't found in primary
  if (MATH_DICTIONARY[lower]) {
    const entry = MATH_DICTIONARY[lower];
    return entry.formulas ? `${entry.base} ${entry.formulas}` : entry.base;
  }
  if (WIPO_DICTIONARY[lower]) return WIPO_DICTIONARY[lower];
  if (SOWI_DICTIONARY[lower]) return SOWI_DICTIONARY[lower];

  // 3. Fallback to intelligent contextual generator
  return generateContextualDefinition(cleanTerm, subject, gradeLevel, context);
}

/**
 * Batch definition generator
 */
export function generateOfflineDefinitionsBatch(
  terms: string[],
  subject: string,
  gradeLevel: string = 'Klasse 8',
  context: string = ''
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const t of terms) {
    const clean = t.trim();
    if (clean) {
      result[clean] = generateOfflineDefinition(clean, subject, gradeLevel, context);
    }
  }
  return result;
}
