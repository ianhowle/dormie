// Shared accent colors — identical in both themes
const accents = {
  teal: '#2A9D8F',
  gold: '#D4AF37',
  urgent: '#C44B4F',
  green: '#2D6A3F',
  greenDark: '#1E4D2B',
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
