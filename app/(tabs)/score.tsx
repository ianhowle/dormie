import { View, Text, StyleSheet } from 'react-native';

export default function ScoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Score Setup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a472a',
  },
});
