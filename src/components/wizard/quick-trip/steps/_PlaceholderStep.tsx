// =============================================================
// Shared placeholder step — used by Phase 2.0 to skeleton out the
// 8 step screens without their real content. Each step file imports
// this and passes its own title + subtitle.
//
// Removed (or each step rewritten in place) as 2.1–2.8 land their
// real content phase by phase.
// =============================================================

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';

interface PlaceholderStepProps {
  title: string;
  subtitle: string;
}

export function PlaceholderStep({ title, subtitle }: PlaceholderStepProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: c.text, fontFamily: GEO }]}>{title}</Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
