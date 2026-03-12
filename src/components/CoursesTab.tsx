import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Courses Tab (258 lines) — Course list

export function CoursesTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Courses</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
