import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Ryder Cup Hub (1,790 lines) — Full RC dashboard

export function RyderCupHub() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.text }]}>Ryder Cup Hub</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16 },
});
