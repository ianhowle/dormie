import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../src/theme/ThemeContext';

// TODO: Create Trip (1,753 lines)
// Multi-step wizard, Ryder Cup toggle

export default function CreateTripScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Create Trip</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
