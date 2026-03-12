import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Ryder Cup Wizard (1,489 lines) — 8-step RC wizard

export function RyderCupWizard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ryder Cup Wizard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
