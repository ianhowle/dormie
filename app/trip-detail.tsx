import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Trip Detail (2,134 lines)
// 6 tabs, countdown ring, invite codes, real-time chat

export default function TripDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
