/**
 * Generates a purely numeric 6-digit Lernhilfe code (e.g. "482105").
 * Numeric codes are vastly faster to type for students on mobile devices and worksheets.
 */
export function generateNumericLernhilfeId(existingIds: string[] = []): string {
  const existingSet = new Set(existingIds.map((id) => id.trim()));
  let attempts = 0;
  while (attempts < 1000) {
    // Generate a random 6-digit number between 100000 and 999999
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    if (!existingSet.has(code)) {
      return code;
    }
    attempts++;
  }
  // Fallback with timestamp-based digits
  return (Date.now() % 900000 + 100000).toString();
}

/**
 * Validates if a string is a clean numeric code
 */
export function isNumericCode(code: string): boolean {
  return /^\d{4,8}$/.test(code.trim());
}
