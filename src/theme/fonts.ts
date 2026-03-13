import { Platform } from 'react-native';

export const GEO = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
})!;

export const SANS = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
})!;

export const sizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 48,
} as const;

export const weights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
