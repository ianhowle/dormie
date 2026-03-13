import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../src/theme/ThemeContext';

// TODO: Discover (380 lines)
// 8 destinations, 3 courses each, dream board

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.greenDark }]}>Discover</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});
