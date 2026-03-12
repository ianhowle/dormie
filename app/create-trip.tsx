import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Create Trip (1,753 lines)
// Multi-step wizard, Ryder Cup toggle

export default function CreateTripScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Trip</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
