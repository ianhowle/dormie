import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: H2H Detail (224 lines)
// Head-to-head comparison

export default function H2HDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Head to Head</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
