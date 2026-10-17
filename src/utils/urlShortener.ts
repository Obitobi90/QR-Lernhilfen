const STORAGE_KEY = 'tippkarten_short_urls_cache_v1';

// In-memory cache synced with localStorage
let localCache: Record<string, string> | null = null;

function getCache(): Record<string, string> {
  if (localCache) return localCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      localCache = JSON.parse(raw);
      return localCache!;
    }
  } catch (e) {
    console.warn('Failed to parse short url cache from localStorage:', e);
  }
  localCache = {};
  return localCache;
}

function setCache(newEntries: Record<string, string>) {
  const current = getCache();
  const merged = { ...current, ...newEntries };
  localCache = merged;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Failed to save short url cache to localStorage:', e);
  }
}

/**
 * Returns a cached shortened URL synchronously if previously generated, or null.
 */
export function getCachedShortUrl(longUrl: string): string | null {
  const cache = getCache();
  return cache[longUrl] || null;
}

/**
 * Formats a short URL for human typing on a smartphone (e.g. "tinyurl.com/xyz" without "https://")
 */
export function formatDisplayShortUrl(url: string): string {
  if (!url) return '';
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Shortens a single URL via server-side proxy (TinyURL/da.gd) with local caching.
 */
export async function shortenUrl(longUrl: string): Promise<string> {
  const trimmed = longUrl.trim();
  if (!trimmed) return '';

  const cached = getCachedShortUrl(trimmed);
  if (cached) return cached;

  try {
    const resp = await fetch('/api/shorten-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.shortUrl) {
        setCache({ [trimmed]: data.shortUrl });
        return data.shortUrl;
      }
    }
  } catch (err) {
    console.warn('Server URL shortener failed:', err);
  }

  // Fallback: Return original long URL
  return trimmed;
}

/**
 * Shortens multiple URLs in batch for efficient network usage, utilizing cache whenever available.
 */
export async function shortenUrlsBatch(urls: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const cache = getCache();
  const missing: string[] = [];

  for (const u of urls) {
    const trimmed = u.trim();
    if (!trimmed) continue;
    if (cache[trimmed]) {
      result[trimmed] = cache[trimmed];
    } else {
      missing.push(trimmed);
    }
  }

  if (missing.length === 0) {
    return result;
  }

  try {
    const resp = await fetch('/api/shorten-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: missing }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.results) {
        setCache(data.results);
        Object.assign(result, data.results);
        return result;
      }
    }
  } catch (err) {
    console.warn('Batch URL shortening error:', err);
  }

  // Fallback for any missing items
  for (const u of missing) {
    if (!result[u]) {
      result[u] = u;
    }
  }

  return result;
}
