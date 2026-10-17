const STORAGE_KEY_TEACHER_PIN = 'lernhilfen_teacher_pin';
const STORAGE_KEY_TEACHER_AUTH = 'lernhilfen_teacher_authenticated';

export const DEFAULT_TEACHER_PIN = '4112023';

/**
 * Returns the currently set Teacher PIN (default: '4112023')
 */
export function getTeacherPin(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TEACHER_PIN);
    // If user previously had the old default '1234', migrate to '4112023'
    if (stored === '1234' || !stored) {
      localStorage.setItem(STORAGE_KEY_TEACHER_PIN, DEFAULT_TEACHER_PIN);
      return DEFAULT_TEACHER_PIN;
    }
    if (stored.trim().length > 0) {
      return stored.trim();
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_TEACHER_PIN;
}

/**
 * Saves a new Teacher PIN in localStorage
 */
export function setTeacherPin(newPin: string): void {
  try {
    if (newPin && newPin.trim().length > 0) {
      localStorage.setItem(STORAGE_KEY_TEACHER_PIN, newPin.trim());
    } else {
      localStorage.setItem(STORAGE_KEY_TEACHER_PIN, DEFAULT_TEACHER_PIN);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Validates an entered PIN against the configured Teacher PIN
 */
export function checkTeacherPin(enteredPin: string): boolean {
  const currentPin = getTeacherPin();
  return enteredPin.trim() === currentPin.trim();
}

/**
 * Checks whether the teacher is authenticated and stays logged in persistently across sessions
 */
export function isTeacherSessionActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_TEACHER_AUTH) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Sets the teacher authentication state in the browser (persisted in localStorage)
 */
export function setTeacherSessionActive(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(STORAGE_KEY_TEACHER_AUTH, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_TEACHER_AUTH);
    }
  } catch (e) {
    // ignore
  }
}
