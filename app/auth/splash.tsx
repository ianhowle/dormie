import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { GEO } from '../../src/theme/fonts';
import { cardShadowDark } from '../../src/theme/colors';
import { haptics } from '../../src/lib/haptics';

// ─── Pinstripe overlay ───────────────────────────────────────────────
function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(40)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fades in over 1 second
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      // Then buttons slide up from bottom
      Animated.parallel([
        Animated.timing(buttonsTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <LinearGradient
      colors={['#0D2818', '#000000']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <Pinstripes />
      <ExpoStatusBar style="light" />

      <Animated.View style={[styles.center, { opacity: logoOpacity }]}>
        <Text style={styles.logo}>DORMIE</Text>
        <View style={styles.divider} />
        <Text style={styles.tagline}>Your match. Your moment.</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.buttons,
          {
            opacity: buttonsOpacity,
            transform: [{ translateY: buttonsTranslateY }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressedState]}
          onPress={() => { haptics.light(); router.push('/auth/login'); }}
        >
          <Text style={styles.primaryText}>Log In</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressedState]}
          onPress={() => { haptics.light(); router.push('/auth/signup'); }}
        >
          <Text style={styles.secondaryText}>Sign Up</Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logo: { fontSize: 28, fontFamily: GEO, fontStyle: 'italic', color: '#C9A227', letterSpacing: 5, fontWeight: '700' },
  divider: { width: 60, height: 1, backgroundColor: '#C9A227', marginTop: 16 },
  tagline: {
    fontSize: 14,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: 'rgba(232,228,222,0.7)',
    marginTop: 12,
    letterSpacing: 1,
  },
  buttons: { position: 'absolute', bottom: 80, width: '100%', paddingHorizontal: 20, gap: 12 },
  primary: {
    backgroundColor: '#006747',
    paddingVertical: 16,
    alignItems: 'center',
    ...cardShadowDark,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: GEO },
  secondary: {
    borderWidth: 1,
    borderColor: '#C9A227',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryText: { fontSize: 16, fontWeight: '600', color: '#C9A227', fontFamily: GEO },
  pressedState: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
