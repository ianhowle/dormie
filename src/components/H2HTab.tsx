import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: H2H Tab (103 lines) — H2H matchups

export function H2HTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Head to Head</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
