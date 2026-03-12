import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Trip Countdown Ring (71 lines) — SVG countdown

type TripCountdownRingProps = {
  daysUntil: number;
  size?: number;
};

export function TripCountdownRing({ daysUntil, size = 80 }: TripCountdownRingProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.days}>{daysUntil}</Text>
      <Text style={styles.label}>days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  days: { color: colors.white, fontSize: 24, fontWeight: 'bold' },
  label: { color: colors.white, fontSize: 10, opacity: 0.8 },
});
