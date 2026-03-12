import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Player Detail (352 lines)
// Player stats, round history

export default function PlayerDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Player Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
