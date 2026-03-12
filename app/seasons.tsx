import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Seasons (1,137 lines)
// Season creation wizard, presets, schedule generation

export default function SeasonsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seasons</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
