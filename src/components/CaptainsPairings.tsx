import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Captains Pairings (402 lines) — RC captain picks

export function CaptainsPairings() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Captains Pairings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
