import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// TODO: Post Round Summary (1,302 lines)
// Full stats, share card (story 9:16 + feed 1:1), settlement

export function PostRoundSummary() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.text }]}>Post Round Summary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16 },
});
