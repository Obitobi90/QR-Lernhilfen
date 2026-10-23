# Implementierungsplan: Master-QR-Code & Arbeitsblatt-Optimierung

## Status: Abgeschlossen & Verifiziert (2026-10-23)

### 1. Schüler-Portal für Master-QR-Code (`WorksheetStudentPortal`)
- **Keine künstlichen „Teilaufgabe 1/2“-Badges mehr:** Die Kacheln tragen als klare Hauptüberschrift den Titel der Lernhilfe (üblicherweise die Aufgabennummer wie z. B. „Aufgabe 1“, „Aufgabe 2b“).
- **Aufgabentext direkt unter der Überschrift:** Falls Aufgabentext (`task_context`) hinterlegt ist, wird dieser direkt lesbar und mit LaTeX-Formelunterstützung unter dem Titel dargestellt.
- **Extra-Info-Badges:**
  - Exakte Angabe der Tippkarten (z. B. `3 Tippkarten`).
  - Klarer Hinweis auf PIN-Schutz (z. B. `Tipps mit PIN geschützt`), wenn in der Aufgabe gesperrte Tipps enthalten sind.
  - Badges für Aufgabenfotos und interaktive Medien (Video / GeoGebra).

### 2. Einstellbare Reihenfolge der Lernhilfen (`worksheetOrder.ts` & `WorksheetQrModal`)
- **Interaktiver Reiter „Reihenfolge“ im Modal:**
  - Jede Aufgabe mit Position `1.`, `2.`, `3.`...
  - Buttons zum Verschieben nach oben (▲) und unten (▼).
  - 1-Klick-Button „Nach Nummern sortieren (1, 2, 3...)“ für natürliche Sortierung nach Aufgabennummern.
  - Sofortige Speicherung und Synchronisation (`worksheet-order-updated`).
- Sowohl im Schüler-Portal als auch in der Lehrkraft-Ansicht und im Druckbogen werden die Aufgaben in dieser Wunschreihenfolge angezeigt.

### 3. Platzoptimierung in der Arbeitsblatt-Leiste (`TeacherView`)
- Der Button wurde auf `Master-QR-Code` mit kompakter Zähler-Pille `(n)` gestrafft.
- Die Nebenbuttons wurden verkürzt (`Aufgabe +`, `Verwalten`), sodass kein Textumbruch mehr entsteht und alle Elemente auf Tablets und Desktops großzügig Platz haben.

### 4. Bereinigung der Reiter im Modal (`WorksheetQrModal`)
- Drei schlanke, moderne Reiter mit Icons und Badges:
  1. `Master-QR` (Badge: `1 Code`)
  2. `Einzel-Codes` (Badge: `n`)
  3. `Reihenfolge` (Icon: `ArrowUpDown`)
- Der seitliche Erklärungstext, der zuvor den Platz der Reiter verengt hatte, wurde entfernt.
