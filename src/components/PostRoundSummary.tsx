import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Post Round Summary (1,302 lines)
// Full stats, share card (story 9:16 + feed 1:1), settlement

export function PostRoundSummary() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Post Round Summary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
