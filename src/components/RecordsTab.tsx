import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Records Tab (359 lines) — Records

export function RecordsTab() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.text }]}>Records</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16 },
});
