export type MediaType = 'none' | 'image' | 'audio' | 'youtube' | 'geogebra' | 'h5p';

export interface Hint {
  id: string;
  title: string;
  text: string;
  pin?: string; // Optional 4-digit numeric code
  mediaType: MediaType;
  mediaData?: string; // Image dataUrl/URL, audio dataUrl/URL, YouTube embed URL, GeoGebra/H5P embed URL
}

export interface Lernhilfe {
  id: string;
  title: string;
  subject?: string;
  grade_level?: string; // Jahrgangsstufe (z. B. "Klasse 7", "Klasse 9", "EF", "Q1")
  task_context: string;
  task_image?: string;
  hints: Hint[];
  created_at: string;
  updated_at: string;
}

export type FeedbackRating = 'up' | 'down';

export interface HintStat {
  hintId: string;
  views: number;
  helpfulCount: number;
  unhelpfulCount: number;
}

export interface LernhilfeStats {
  lernhilfeId: string;
  totalViews: number;
  hintStats: Record<string, HintStat>;
  lastViewedAt?: string;
  updatedAt: string;
}

export interface SupabaseSettings {
  url: string;
  anonKey: string;
  enabled: boolean;
}

export interface TeacherUser {
  id: string;
  email: string;
}
