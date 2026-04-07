import { Platform } from 'react-native';

// Shared accent colors — identical in both themes
const accents = {
  teal: '#006747',
  gold: '#C9A227',
  /** Brighter gold for small text on green headers — passes WCAG AA 4.5:1 on #1E4D2B */
  goldAccessible: '#D4AF37',
  urgent: '#C41E3A',
  green: '#2D6A3F',
  greenDark: '#1E4D2B',
  greenDeep: '#0D2818',
};

export const dark = {
  bg: '#0D0A06',           // True dark page background
  surface: '#151312',      // Subtle surface (barely lighter)
  cardBg: '#151312',       // Card surface — subtle depth via bg difference
  elevated: '#1A1816',     // Interactive/featured cards
  text: '#E8E4DE',
  textMuted: '#8A857F', // Bumped from #6B6560 for WCAG AA (4.84:1 on cardBg, 5.11:1 on bg)
  textTertiary: '#6B6560', // Tertiary text (dark mode)
  border: 'rgba(255,255,255,0.06)', // Barely visible edge definition
  borderLight: 'rgba(255,255,255,0.04)',
  /** Score color coding — PGA Tour broadcast convention */
  scoreUnder: '#1D9E75',   // Under par green
  scoreEven: '#E8E4DE',    // Even par neutral
  scoreOver: '#E24B4A',    // Over par red
  ...accents,
};

export const light = {
  bg: '#F8F7F5',           // Warm off-white page background
  surface: '#FFFFFF',      // True white cards float above warm bg
  cardBg: '#FFFFFF',       // Card surface
  elevated: '#F2F0ED',     // Inactive toggle / secondary surface
  text: '#1A1A1A',         // Near-black primary text
  textMuted: '#6B6966',    // Warm gray secondary text
  textTertiary: '#9C9894', // Muted/tertiary text
  border: 'rgba(0,0,0,0.06)',      // Barely visible edge definition
  borderLight: 'rgba(0,0,0,0.04)', // Row separator
  /** Score color coding — adjusted saturation for white backgrounds */
  scoreUnder: '#0E7A5B',   // Deeper green for readability on white
  scoreEven: '#6B6966',    // Warm gray even par
  scoreOver: '#D43D3D',    // Deeper red for white background contrast
  ...accents,
};

export type ThemeColors = typeof dark;

/** Card shadow for dark mode */
export const cardShadowDark = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  android: { elevation: 4 },
  default: {},
}) as Record<string, any>;

/** Card shadow for light mode — dual-shadow depth */
export const cardShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.10,
  },
  android: { elevation: 4 },
  default: {},
}) as Record<string, any>;

/** Elevated shadow for light mode — Welcome banner, toggle containers */
export const elevatedShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.08,
  },
  android: { elevation: 3 },
  default: {},
}) as Record<string, any>;

/** Table container shadow for light mode */
export const tableShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 6,
    shadowOpacity: 0.05,
  },
  android: { elevation: 2 },
  default: {},
}) as Record<string, any>;

/** Stronger shadow for tickers/floating elements */
export const tickerShadowDark = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.5,
  },
  android: { elevation: 8 },
  default: {},
}) as Record<string, any>;

export const tickerShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.12,
  },
  android: { elevation: 6 },
  default: {},
}) as Record<string, any>;

/** Green header gradient stops (Masters green → deep) */
export const greenHeaderGradient = ['#1E4D2B', '#0D2818'] as const;
