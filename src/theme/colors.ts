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
  bg: '#141210',
  surface: '#1E1B18',
  cardBg: '#1A1816',
  elevated: '#262320',
  text: '#E8E4DE',
  textMuted: '#8A857F', // Bumped from #6B6560 for WCAG AA (4.84:1 on cardBg, 5.11:1 on bg)
  border: '#2A2724',
  borderLight: '#222222',
  ...accents,
};

export const light = {
  bg: '#FAF8F4',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  elevated: '#F5F1EB',
  text: '#1A1A1A',
  textMuted: '#6B6560', // Darkened from #8A857F for WCAG AA (5.42:1 on bg, 5.74:1 on white)
  border: '#E5E2DE',
  borderLight: '#EDEAE6',
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

/** Card shadow for light mode */
export const cardShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.08,
  },
  android: { elevation: 3 },
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
