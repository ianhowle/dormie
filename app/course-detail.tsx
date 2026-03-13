import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../src/theme/ThemeContext';

// TODO: Course Detail (478 lines)
// Course stats, leaderboard, group/field scope

export default function CourseDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Course Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
