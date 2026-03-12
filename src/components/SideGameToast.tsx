import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Side Game Toast (407 lines) — Auto/semi-auto/manual detection

export function SideGameToast() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Side Game Toast</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
