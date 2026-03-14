import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { GEO } from '../../src/theme/fonts';

export default function SplashScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Pressable style={styles.container} onPress={() => router.push('/auth/login')}>
      <Animated.View style={[styles.center, { opacity: pulseAnim }]}>
        <Text style={styles.logo}>DORMIE</Text>
        <View style={styles.divider} />
      </Animated.View>
      <View style={styles.buttons}>
        <Pressable style={styles.primary} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryText}>Log In</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/auth/signup')}>
          <Text style={styles.secondaryText}>Sign Up</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logo: { fontSize: 28, fontFamily: GEO, fontStyle: 'italic', color: '#D4AF37', letterSpacing: 5 },
  divider: { width: 60, height: 1, backgroundColor: '#D4AF37', marginTop: 16 },
  buttons: { position: 'absolute', bottom: 80, width: '100%', paddingHorizontal: 32, gap: 12 },
  primary: { backgroundColor: '#D4AF37', paddingVertical: 16, alignItems: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#000000', fontFamily: GEO },
  secondary: { borderWidth: 1, borderColor: '#D4AF3744', paddingVertical: 16, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600', color: '#D4AF37', fontFamily: GEO },
});
