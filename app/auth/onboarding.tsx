import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';

// TODO: 7-step onboarding wizard (1,103 lines)
// Steps: name, handicap, avatar, home course, preferences, groups, complete

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>Welcome to Dormie</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>Let's set up your profile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 8 },
});
