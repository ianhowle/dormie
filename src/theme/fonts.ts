import { Platform } from 'react-native';

// Georgia serif for headings, numbers, and hero text
// System sans-serif for body and labels
export const fonts = {
  families: {
    serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    hero: 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
