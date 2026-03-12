import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';

// TODO: 7-step onboarding wizard (1,103 lines)
// Steps: name, handicap, avatar, home course, preferences, groups, complete

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Dormie</Text>
      <Text style={styles.subtitle}>Let's set up your profile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.primary },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
});
