import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Dormie</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>Welcome to Dormie</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
});
