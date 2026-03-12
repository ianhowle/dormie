import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Live Scoring (3,401 lines)
// All formats, all side games, pinned scoreboard, live feed,
// dormie moments, hole transitions, scorecard confirmation, post-round summary

export default function ScoringScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Scoring</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
