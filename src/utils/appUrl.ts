/**
 * Utilities for URL resolution, custom base URLs (for LAN / Smartphone access),
 * and detecting localhost environments.
 */

const STORAGE_CUSTOM_BASE_URL = 'lernhilfen_custom_base_url';

/**
 * Returns true if the app is currently running on localhost or 127.0.0.1
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Retrieves the configured custom base URL (e.g. "http://192.168.1.45:3000" or a custom domain),
 * or empty string if not explicitly set.
 */
export function getCustomBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(STORAGE_CUSTOM_BASE_URL) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Saves a custom base URL to localStorage.
 */
export function saveCustomBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = url.trim().replace(/\/+$/, ''); // remove trailing slashes
    if (cleaned) {
      localStorage.setItem(STORAGE_CUSTOM_BASE_URL, cleaned);
    } else {
      localStorage.removeItem(STORAGE_CUSTOM_BASE_URL);
    }
  } catch (e) {
    console.warn('Failed to save custom base URL:', e);
  }
}

/**
 * Gets the effective base URL for QR codes and student links.
 * Priority:
 * 1. Explicitly configured custom base URL
 * 2. window.location.origin
 */
export function getEffectiveBaseUrl(): string {
  const custom = getCustomBaseUrl();
  if (custom) return custom;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/**
 * Builds the complete URL to open a specific Lernhilfe in student view (?id=...)
 */
export function buildStudentUrl(lernhilfeId: string): string {
  const base = getEffectiveBaseUrl();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${base}${path}?id=${encodeURIComponent(lernhilfeId)}`;
}

/**
 * Builds the complete URL to open the Master Worksheet Portal for a group of tasks (?sheet=...)
 */
export function buildWorksheetStudentUrl(groupName: string): string {
  const base = getEffectiveBaseUrl();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${base}${path}?sheet=${encodeURIComponent(groupName)}`;
}

/**
 * Builds a student URL that remembers which worksheet portal the student came from
 */
export function buildStudentUrlWithSheet(lernhilfeId: string, groupName?: string): string {
  const base = getEffectiveBaseUrl();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const sheetParam = groupName ? `&sheet=${encodeURIComponent(groupName)}` : '';
  return `${base}${path}?id=${encodeURIComponent(lernhilfeId)}${sheetParam}`;
}

/**
 * Fetches server local network IP information if available (from backend server.ts)
 */
export async function fetchServerNetworkInfo(): Promise<{
  port: number;
  ipAddresses: string[];
  suggestedUrls: string[];
} | null> {
  try {
    const res = await fetch('/api/network-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
