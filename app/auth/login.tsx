import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import { haptics } from '../../src/lib/haptics';

const { height: SCREEN_H } = Dimensions.get('window');
const TOP_ZONE = SCREEN_H * 0.4;

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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const errorAnim = useRef(new Animated.Value(0)).current;

  const showError = (msg: string) => {
    setError(msg);
    errorAnim.setValue(0);
    Animated.timing(errorAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleLogin = async () => {
    haptics.light();
    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <ExpoStatusBar style="light" />
        {/* Top 40% — Masters green gradient with branding */}
        <LinearGradient
          colors={[...greenHeaderGradient]}
          style={[styles.topZone, { height: TOP_ZONE }]}
        >
          <Pinstripes />
          <View style={styles.branding}>
            <Text style={styles.brandName}>DORMIE</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTagline}>Your crew, always in play.</Text>
          </View>
        </LinearGradient>

        {/* Bottom 60% — Dark form area */}
        <View style={[styles.bottomZone, { backgroundColor: c.bg }]}>
          <Text style={[styles.welcomeTitle, { color: c.text }]}>Welcome back</Text>

          {/* Error banner */}
          {error !== '' && (
            <Animated.View style={[styles.errorBanner, { opacity: errorAnim, backgroundColor: c.urgent + '14', ...(theme.isDark ? cardShadowDark : cardShadowLight) }]}>
              <View style={styles.errorStripe} />
              <Ionicons name="alert-circle" size={16} color={c.urgent} style={{ marginLeft: 10 }} />
              <Text style={[styles.errorText, { color: c.urgent }]}>{error}</Text>
            </Animated.View>
          )}

          {/* Email input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: c.gold }]}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={c.textMuted}
              style={[
                styles.input,
                { backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: emailFocused ? c.teal : c.border, color: c.text },
              ]}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: c.gold }]}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  { flex: 1, paddingRight: 44, backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: passwordFocused ? c.teal : c.border, color: c.text },
                ]}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={12}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Sign in button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.signInBtn, loading && { opacity: 0.6 }, pressed && styles.pressedState]}
          >
            <Text style={styles.signInBtnText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </Pressable>

          {/* Sign up link */}
          <View style={styles.signupRow}>
            <Text style={[styles.signupLabel, { color: c.textMuted }]}>Don't have an account?</Text>
            <Pressable onPress={() => { haptics.light(); router.push('/auth/signup'); }}>
              <Text style={[styles.signupLink, { color: c.teal }]}>Create one</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topZone: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  branding: { alignItems: 'center' },
  brandName: {
    fontSize: 9,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#C9A227',
    letterSpacing: 4,
    fontWeight: '700',
  },
  brandDivider: { width: 60, height: 1, backgroundColor: '#C9A227', marginVertical: 12 },
  brandTagline: {
    fontSize: 13,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  bottomZone: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: GEO,
    fontWeight: '700',
    marginBottom: 24,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C41E3A33',
  },
  errorStripe: {
    width: 3,
    height: '100%',
    backgroundColor: '#C41E3A',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  errorText: { fontSize: 13, marginLeft: 8, flex: 1 },

  // Inputs
  inputContainer: { marginBottom: 16 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 2,
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordRow: { position: 'relative' },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  // Button
  signInBtn: {
    backgroundColor: '#006747',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'center',
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: GEO,
  },
  pressedState: { opacity: 0.7, transform: [{ scale: 0.98 }] },

  // Signup link
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
    paddingBottom: 32,
  },
  signupLabel: { fontSize: 13 },
  signupLink: { fontSize: 13, fontWeight: '600' },
});
