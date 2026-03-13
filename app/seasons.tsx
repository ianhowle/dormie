import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../src/theme/ThemeContext';

// TODO: Seasons (1,137 lines)
// Season creation wizard, presets, schedule generation

export default function SeasonsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Seasons</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
