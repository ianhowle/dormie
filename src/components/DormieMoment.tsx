import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Dormie Moment (427 lines) — 6 cinematic moment types

export function DormieMoment() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dormie Moment</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
