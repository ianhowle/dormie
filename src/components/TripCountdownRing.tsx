import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Trip Countdown Ring (71 lines) — SVG countdown

type TripCountdownRingProps = {
  daysUntil: number;
  size?: number;
};

export function TripCountdownRing({ daysUntil, size = 80 }: TripCountdownRingProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.greenDark }]}>
      <Text style={[styles.days, { color: c.text }]}>{daysUntil}</Text>
      <Text style={[styles.label, { color: c.text }]}>days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  days: { fontSize: 24, fontWeight: 'bold' },
  label: { fontSize: 10, opacity: 0.8 },
});
