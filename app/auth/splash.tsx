import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function SplashScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>DORMIE</Text>
      <Text style={styles.tagline}>Your golf, elevated.</Text>
      <View style={styles.buttons}>
        <Pressable style={styles.primary} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryText}>Log In</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/auth/signup')}>
          <Text style={styles.secondaryText}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  logo: { fontSize: 48, fontWeight: 'bold', color: colors.white, letterSpacing: 8 },
  tagline: { fontSize: 16, color: colors.white, opacity: 0.8, marginTop: 8 },
  buttons: { position: 'absolute', bottom: 80, width: '100%', paddingHorizontal: 32, gap: 12 },
  primary: { backgroundColor: colors.white, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: colors.white, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
