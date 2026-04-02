import { Platform } from 'react-native';

// Shared accent colors — identical in both themes
const accents = {
  teal: '#006747',
  gold: '#C9A227',
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
  textMuted: '#6B6560',
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
  textMuted: '#8A857F',
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
