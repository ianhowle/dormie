import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.logo, { color: c.text, fontFamily: GEO }]}>DORMIE</Text>
      <Text style={[styles.tagline, { color: c.textMuted }]}>Your golf, elevated.</Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.primary, { backgroundColor: c.teal }]} onPress={() => router.push('/auth/login')}>
          <Text style={[styles.primaryText, { color: c.bg }]}>Log In</Text>
        </Pressable>
        <Pressable style={[styles.secondary, { borderColor: c.border }]} onPress={() => router.push('/auth/signup')}>
          <Text style={[styles.secondaryText, { color: c.text }]}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 48, fontWeight: 'bold', letterSpacing: 8 },
  tagline: { fontSize: 16, marginTop: 8 },
  buttons: { position: 'absolute', bottom: 80, width: '100%', paddingHorizontal: 32, gap: 12 },
  primary: { paddingVertical: 16, alignItems: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, paddingVertical: 16, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600' },
});
