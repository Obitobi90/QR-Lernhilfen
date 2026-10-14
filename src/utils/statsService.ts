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
  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(lernhilfeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.stats) {
        // Cache locally
        saveLocalStats(lernhilfeId, data.stats);
        return data.stats;
      }
    }
  } catch (err) {
    console.warn('Network error fetching stats, using local cache:', err);
  }

  // Fallback to local cache
  return getLocalStats(lernhilfeId);
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
 * Submits helpfulness feedback (👍 / 👎) for a specific hint.
 * The server tracks IP and voterId so a student can only vote once per hint.
 */
export async function voteHint(
  lernhilfeId: string,
  hintId: string,
  rating: FeedbackRating
): Promise<{ success: boolean; currentRating: FeedbackRating; alreadyVoted?: boolean }> {
  const voterId = getVoterId();

  // Optimistically store in local state
  setLocalVote(lernhilfeId, hintId, rating);

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
      return {
        success: true,
        currentRating: data?.currentRating || rating,
        alreadyVoted: data?.alreadyVoted,
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
  if (rating === 'up') {
    h.helpfulCount += 1;
  } else {
    h.unhelpfulCount += 1;
  }
  saveLocalStats(lernhilfeId, stat);

  return { success: true, currentRating: rating };
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
