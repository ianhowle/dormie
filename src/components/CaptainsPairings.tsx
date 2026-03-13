import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Captains Pairings (402 lines) — RC captain picks

export function CaptainsPairings() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.text }]}>Captains Pairings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16 },
});
