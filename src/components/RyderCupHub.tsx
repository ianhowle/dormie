import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Ryder Cup Hub (1,790 lines) — Full RC dashboard

export function RyderCupHub() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ryder Cup Hub</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
