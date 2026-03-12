import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Hole Transition Banner (204 lines) — Animated hole recap

export function HoleTransitionBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hole Transition</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
