import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Discover (380 lines)
// 8 destinations, 3 courses each, dream board

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
