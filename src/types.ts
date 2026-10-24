export type MediaType = 'none' | 'image' | 'audio' | 'youtube' | 'geogebra' | 'h5p';

export type DisclosureMode = 'stepped' | 'all_visible'; // 'stepped' (nach und nach freischalten) or 'all_visible' (alle Tipps von Anfang an sichtbar, eingeklappt)

export interface Hint {
  id: string;
  title: string;
  text: string;
  pin?: string; // Optional 4-digit numeric code
  mediaType: MediaType;
  mediaData?: string; // Image dataUrl/URL, audio dataUrl/URL, YouTube embed URL, GeoGebra/H5P embed URL
}

export type QrBorderDecoration =
  | 'none'
  | 'corner_accents'
  | 'school_grid'
  | 'math_symbols'
  | 'double_vintage'
  | 'stamp_dots'
  | 'sketch_doodle'
  | 'modern_tech';

export type QrCenterLogoType = 'none' | 'preset_icon' | 'sketch_drawing' | 'custom_image';

export type QrPresetId =
  | 'classic'
  | 'indigo_modern'
  | 'emerald_nature'
  | 'violet_creative'
  | 'dark_slate'
  | 'crimson_study'
  | 'custom_colors';

export interface QrDesignSettings {
  preset: QrPresetId;
  name: string;
  darkColor: string;
  lightColor: string;
  borderDecoration: QrBorderDecoration;
  centerLogoType: QrCenterLogoType;
  presetIcon?: 'book' | 'math' | 'graduation';
  rawUploadedImage?: string;
  customLogoDataUrl?: string;
  sketchStyle?: 'pencil' | 'ink' | 'outline' | 'charcoal';
  sketchStrokeColor?: string;
  sketchIntensity?: number;
  badgeShape: 'circle' | 'rounded';
  logoFit?: 'contain' | 'cover';
  logoZoom?: number;
  logoOffsetX?: number;
  logoOffsetY?: number;
}

export interface Lernhilfe {
  id: string;
  title: string;
  subject?: string;
  grade_level?: string; // Jahrgangsstufe (z. B. "Klasse 7", "Klasse 9", "EF", "Q1")
  group_name?: string; // Optionale Gruppierung / Arbeitsblatt-Name (z. B. "Arbeitsblatt zum Satz des Pythagoras")
  task_context: string;
  task_image?: string;
  disclosure_mode?: DisclosureMode; // Gestufte Freischaltung ('stepped') oder alle Tipps direkt sichtbar ('all_visible')
  qr_design?: QrDesignSettings; // Individuelles QR-Code Design für diese spezifische Lernhilfe
  glossary?: Record<string, string>; // Mini-Definitionen für [[Fachbegriffe]], z.B. { "Scheitelpunkt": "..." }
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

export interface PupilSuggestion {
  id: string;
  lernhilfeId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface LernhilfeStats {
  lernhilfeId: string;
  totalViews: number;
  hintStats: Record<string, HintStat>;
  suggestions?: PupilSuggestion[];
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
