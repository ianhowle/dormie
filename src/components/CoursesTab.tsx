import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Courses Tab (258 lines) — Course list

export function CoursesTab() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.text }]}>Courses</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16 },
});
