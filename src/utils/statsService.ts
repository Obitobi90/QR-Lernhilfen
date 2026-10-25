import { LernhilfeStats, FeedbackRating } from '../types';

const STORAGE_VOTER_ID = 'lernhilfen_voter_id';
const STORAGE_MY_VOTES = 'lernhilfen_my_votes'; // Record<string, 'up' | 'down'>
const STORAGE_LOCAL_STATS = 'lernhilfen_local_stats'; // Record<string, LernhilfeStats>

/**
 * Returns or generates an anonymous random voter ID for this browser.
 */
export function getVoterId(): string {
  try {
    let voterId = localStorage.getItem(STORAGE_VOTER_ID);
    if (!voterId) {
      voterId = 'voter_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
      localStorage.setItem(STORAGE_VOTER_ID, voterId);
    }
    return voterId;
  } catch (e) {
    return 'voter_' + Date.now();
  }
}

/**
 * Retrieves the local vote state for a specific hint if this user already voted.
 */
export function getLocalVote(lernhilfeId: string, hintId: string): FeedbackRating | null {
  try {
    const raw = localStorage.getItem(STORAGE_MY_VOTES);
    if (!raw) return null;
    const votes: Record<string, FeedbackRating> = JSON.parse(raw);
    return votes[`${lernhilfeId}:::${hintId}`] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Saves a local vote for immediate UI feedback.
 */
function setLocalVote(lernhilfeId: string, hintId: string, rating: FeedbackRating) {
  try {
    const raw = localStorage.getItem(STORAGE_MY_VOTES);
    const votes: Record<string, FeedbackRating> = raw ? JSON.parse(raw) : {};
    votes[`${lernhilfeId}:::${hintId}`] = rating;
    localStorage.setItem(STORAGE_MY_VOTES, JSON.stringify(votes));
  } catch (e) {
    // ignore
  }
}

/**
 * Fetches the statistics for a specific Lernhilfe.
 */
export async function fetchLernhilfeStats(lernhilfeId: string): Promise<LernhilfeStats> {
  const local = getLocalStats(lernhilfeId);

  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.stats) {
        const srvStats: LernhilfeStats = data.stats;
        srvStats.suggestions = srvStats.suggestions || [];

        // Seamlessly merge server suggestions and local suggestions
        const mergedMap = new Map<string, any>();
        srvStats.suggestions.forEach((s) => mergedMap.set(s.id || s.text, s));
        (local.suggestions || []).forEach((s) => {
          if (!mergedMap.has(s.id || s.text)) {
            mergedMap.set(s.id || s.text, s);
          }
        });
        srvStats.suggestions = Array.from(mergedMap.values());

        // Cache merged stats locally
        saveLocalStats(lernhilfeId, srvStats);
        return srvStats;
      }
    }
  } catch (err) {
    console.warn('Network error fetching stats, using local cache:', err);
  }

  // Fallback to local cache
  return local;
}

/**
 * Records that a task / QR-code was opened.
 */
export async function recordTaskView(lernhilfeId: string): Promise<void> {
  const voterId = getVoterId();

  try {
    await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }),
    });
  } catch (e) {
    // Offline / local increment fallback
    const stat = getLocalStats(lernhilfeId);
    stat.totalViews += 1;
    stat.lastViewedAt = new Date().toISOString();
    saveLocalStats(lernhilfeId, stat);
  }
}

/**
 * Records that a specific hint within a task was revealed / viewed.
 */
export async function recordHintView(lernhilfeId: string, hintId: string): Promise<void> {
  const voterId = getVoterId();

  try {
    await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hintId, voterId }),
    });
  } catch (e) {
    // Offline / local increment fallback
    const stat = getLocalStats(lernhilfeId);
    if (!stat.hintStats[hintId]) {
      stat.hintStats[hintId] = {
        hintId,
        views: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
      };
    }
    stat.hintStats[hintId].views += 1;
    saveLocalStats(lernhilfeId, stat);
  }
}

/**
 * Removes a local vote from storage.
 */
function removeLocalVote(lernhilfeId: string, hintId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_MY_VOTES);
    if (!raw) return;
    const votes: Record<string, FeedbackRating> = JSON.parse(raw);
    delete votes[`${lernhilfeId}:::${hintId}`];
    localStorage.setItem(STORAGE_MY_VOTES, JSON.stringify(votes));
  } catch (e) {}
}

/**
 * Submits helpfulness feedback (👍 / 👎) for a specific hint.
 * If the user clicks the same rating again, the vote is removed (toggle off).
 * The server tracks IP and voterId.
 */
export async function voteHint(
  lernhilfeId: string,
  hintId: string,
  rating: FeedbackRating
): Promise<{ success: boolean; currentRating: FeedbackRating | null; removed?: boolean }> {
  const voterId = getVoterId();
  const previousVote = getLocalVote(lernhilfeId, hintId);

  // If clicking same rating locally, optimistically remove
  if (previousVote === rating) {
    removeLocalVote(lernhilfeId, hintId);
  } else {
    setLocalVote(lernhilfeId, hintId, rating);
  }

  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hintId, rating, voterId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.stats) {
        saveLocalStats(lernhilfeId, data.stats);
      }
      if (data?.removed || data?.currentRating === null) {
        removeLocalVote(lernhilfeId, hintId);
        return { success: true, currentRating: null, removed: true };
      }
      return {
        success: true,
        currentRating: data?.currentRating || rating,
      };
    }
  } catch (err) {
    console.warn('Network error voting, updating locally:', err);
  }

  // Local fallback
  const stat = getLocalStats(lernhilfeId);
  if (!stat.hintStats[hintId]) {
    stat.hintStats[hintId] = {
      hintId,
      views: 1,
      helpfulCount: 0,
      unhelpfulCount: 0,
    };
  }

  const h = stat.hintStats[hintId];
  if (previousVote === rating) {
    // Local toggle off
    if (rating === 'up') {
      h.helpfulCount = Math.max(0, h.helpfulCount - 1);
    } else {
      h.unhelpfulCount = Math.max(0, h.unhelpfulCount - 1);
    }
    saveLocalStats(lernhilfeId, stat);
    removeLocalVote(lernhilfeId, hintId);
    return { success: true, currentRating: null, removed: true };
  } else {
    if (previousVote === 'up') h.helpfulCount = Math.max(0, h.helpfulCount - 1);
    if (previousVote === 'down') h.unhelpfulCount = Math.max(0, h.unhelpfulCount - 1);

    if (rating === 'up') h.helpfulCount += 1;
    if (rating === 'down') h.unhelpfulCount += 1;

    saveLocalStats(lernhilfeId, stat);
    return { success: true, currentRating: rating };
  }
}

/**
 * Storage key for pupil's own suggestion per Lernhilfe
 */
const getPupilSuggestionStorageKey = (lernhilfeId: string) => `lernhilfen_my_sug_${lernhilfeId}`;

/**
 * Fetches the pupil's own suggestion for this task if previously submitted.
 */
export async function fetchPupilSuggestion(
  lernhilfeId: string
): Promise<{ id: string; text: string; createdAt: string; updatedAt: string } | null> {
  const voterId = getVoterId();

  // 1. Try server first
  try {
    const res = await fetch(
      `/api/stats/${encodeURIComponent(lernhilfeId)}/suggestion?voterId=${encodeURIComponent(voterId)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.suggestion) {
        try {
          localStorage.setItem(getPupilSuggestionStorageKey(lernhilfeId), JSON.stringify(data.suggestion));
        } catch {}
        return data.suggestion;
      }
    }
  } catch (e) {
    console.warn('Could not fetch pupil suggestion from server, checking local:', e);
  }

  // 2. Check local pupil suggestion storage fallback
  try {
    const raw = localStorage.getItem(getPupilSuggestionStorageKey(lernhilfeId));
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  // 3. Check local stats collection
  const localStats = getLocalStats(lernhilfeId);
  if (Array.isArray(localStats.suggestions)) {
    const found = localStats.suggestions.find((s) => (s as any).voterId === voterId);
    if (found) return found;
  }

  return null;
}

/**
 * Submits or edits a pupil suggestion for additional / better hints.
 */
export async function submitPupilSuggestion(
  lernhilfeId: string,
  text: string
): Promise<{ success: boolean; isEdit?: boolean; suggestion?: any; error?: string }> {
  const voterId = getVoterId();
  const cleanText = text.trim();
  const now = new Date().toISOString();

  // 1. Instantly record locally in both individual key and local stats
  let localSug: any = null;
  const localStats = getLocalStats(lernhilfeId);
  localStats.suggestions = localStats.suggestions || [];
  const existingIdx = localStats.suggestions.findIndex((s: any) => s.voterId === voterId);

  if (existingIdx >= 0) {
    localSug = {
      ...localStats.suggestions[existingIdx],
      text: cleanText,
      updatedAt: now,
    };
    localStats.suggestions[existingIdx] = localSug;
  } else {
    localSug = {
      id: 'sug_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      lernhilfeId,
      text: cleanText,
      voterId,
      createdAt: now,
      updatedAt: now,
    };
    localStats.suggestions.unshift(localSug);
  }

  saveLocalStats(lernhilfeId, localStats);
  try {
    localStorage.setItem(getPupilSuggestionStorageKey(lernhilfeId), JSON.stringify(localSug));
  } catch {}

  // 2. Transmit to server
  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}/suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voterId }),
    });

    if (res.ok) {
      const data = await res.json();
      const serverSug = data?.suggestion || localSug;

      try {
        localStorage.setItem(getPupilSuggestionStorageKey(lernhilfeId), JSON.stringify(serverSug));
      } catch {}

      // Refresh local cache with latest server stats
      try {
        const statsRes = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData?.stats) {
            saveLocalStats(lernhilfeId, statsData.stats);
          }
        }
      } catch {}

      // Dispatch real-time update event so open statistics modal refreshes immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lernhilfe-stats-updated', { detail: { lernhilfeId } }));
      }

      return {
        success: true,
        isEdit: data?.isEdit || existingIdx >= 0,
        suggestion: serverSug,
      };
    }
  } catch (e: any) {
    console.warn('Network error transmitting suggestion to server, saved locally:', e);
  }

  // Dispatch event even on local save
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lernhilfe-stats-updated', { detail: { lernhilfeId } }));
  }

  return {
    success: true,
    isEdit: existingIdx >= 0,
    suggestion: localSug,
  };
}

/**
 * Resets the statistics for a specific Lernhilfe (Teacher action).
 */
export async function resetLernhilfeStats(lernhilfeId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
    if (res.ok) {
      const emptyStat: LernhilfeStats = {
        lernhilfeId,
        totalViews: 0,
        hintStats: {},
        updatedAt: new Date().toISOString(),
      };
      saveLocalStats(lernhilfeId, emptyStat);
      return true;
    }
  } catch (e) {
    console.warn('Error resetting stats:', e);
  }

  const emptyStat: LernhilfeStats = {
    lernhilfeId,
    totalViews: 0,
    hintStats: {},
    updatedAt: new Date().toISOString(),
  };
  saveLocalStats(lernhilfeId, emptyStat);
  return true;
}

// Internal localStorage helpers for offline fallback
function getLocalStats(lernhilfeId: string): LernhilfeStats {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_STATS);
    if (raw) {
      const all = JSON.parse(raw);
      if (all[lernhilfeId]) return all[lernhilfeId];
    }
  } catch (e) {}

  return {
    lernhilfeId,
    totalViews: 0,
    hintStats: {},
    updatedAt: new Date().toISOString(),
  };
}

function saveLocalStats(lernhilfeId: string, stat: LernhilfeStats) {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_STATS);
    const all = raw ? JSON.parse(raw) : {};
    all[lernhilfeId] = stat;
    localStorage.setItem(STORAGE_LOCAL_STATS, JSON.stringify(all));
  } catch (e) {}
}
