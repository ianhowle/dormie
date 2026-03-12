import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Records Tab (359 lines) — Records

export function RecordsTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Records</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
