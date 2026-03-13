import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../src/theme/ThemeContext';

// TODO: Live Scoring (3,401 lines)
// All formats, all side games, pinned scoreboard, live feed,
// dormie moments, hole transitions, scorecard confirmation, post-round summary

export default function ScoringScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Live Scoring</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
