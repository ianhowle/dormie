import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Course Detail (478 lines)
// Course stats, leaderboard, group/field scope

export default function CourseDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Course Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
