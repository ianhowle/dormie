import { useState, useRef, useCallback } from 'react';
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
import { authService } from '../../src/services/auth.service';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const TOP_ZONE = SCREEN_H * 0.3;

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

// ─── Gold Flash Overlay ───────────────────────────────────────────────
function GoldFlash({
  visible,
  firstName,
  onComplete,
}: {
  visible: boolean;
  firstName: string;
  onComplete: () => void;
}) {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const run = useCallback(() => {
    flashOpacity.setValue(0);
    textOpacity.setValue(0);

    Animated.sequence([
      // Gold flash fades in
      Animated.timing(flashOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Flash fades out, text fades in
      Animated.parallel([
        Animated.timing(flashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(1200),
      // Fade out
      Animated.timing(textOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onComplete());
  }, [flashOpacity, textOpacity, onComplete]);

  if (!visible) return null;

  return (
    <View style={styles.flashOverlay} onLayout={run}>
      <Animated.View
        style={[styles.flashGold, { opacity: flashOpacity }]}
        pointerEvents="none"
      />
      <Animated.Text style={[styles.flashText, { opacity: textOpacity }]}>
        Welcome to Dormie, {firstName}.
      </Animated.Text>
    </View>
  );
}

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const errorAnim = useRef(new Animated.Value(0)).current;

  const showErrorMsg = (msg: string) => {
    setError(msg);
    errorAnim.setValue(0);
    Animated.timing(errorAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const firstName = fullName.trim().split(' ')[0] || 'Golfer';

  const handleSignUp = async () => {
    if (!fullName.trim() || !email || !password) {
      showErrorMsg('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      showErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.signUp(email, password, fullName.trim());

      // Parse city/state if provided
      const parts = city.split(',').map((s) => s.trim());
      const cityVal = parts[0] || null;
      const stateVal = parts[1] || null;

      // Note: profile will be created by Supabase trigger or in onboarding
      setShowFlash(true);
    } catch (err: unknown) {
      showErrorMsg(err instanceof Error ? err.message : 'Sign up failed.');
      setLoading(false);
    }
  };

  const handleFlashComplete = () => {
    setShowFlash(false);
    router.replace('/auth/onboarding');
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
        {/* Top 30% — Masters green gradient */}
        <LinearGradient
          colors={['#1E4D2B', '#2D6A3F']}
          style={[styles.topZone, { height: TOP_ZONE }]}
        >
          <Pinstripes />
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.branding}>
            <Text style={styles.brandName}>DORMIE</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTagline}>Join the competition.</Text>
          </View>
        </LinearGradient>

        {/* Bottom — Dark form area */}
        <View style={[styles.bottomZone, { backgroundColor: '#141210' }]}>
          <Text style={[styles.title, { color: c.text }]}>Create Account</Text>

          {/* Error */}
          {error !== '' && (
            <Animated.View style={[styles.errorBanner, { opacity: errorAnim }]}>
              <View style={styles.errorStripe} />
              <Ionicons name="alert-circle" size={16} color="#C44B4F" style={{ marginLeft: 10 }} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Full name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ian McGowan"
              placeholderTextColor="#6B6560"
              style={styles.input}
              autoCorrect={false}
            />
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#6B6560"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="6+ characters"
                placeholderTextColor="#6B6560"
                style={[styles.input, { flex: 1, paddingRight: 44 }]}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={12}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6B6560"
                />
              </Pressable>
            </View>
          </View>

          {/* City/State */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>City, State</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Nashville, TN"
              placeholderTextColor="#6B6560"
              style={styles.input}
            />
          </View>

          {/* Create button */}
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            style={[styles.createBtn, loading && { opacity: 0.6 }]}
          >
            <Text style={styles.createBtnText}>
              {loading ? 'Creating...' : 'Create Account'}
            </Text>
          </Pressable>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginLabel}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Gold flash overlay */}
      <GoldFlash
        visible={showFlash}
        firstName={firstName}
        onComplete={handleFlashComplete}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topZone: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
  },
  branding: { alignItems: 'center' },
  brandName: {
    fontSize: 9,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#D4AF37',
    letterSpacing: 4,
    fontWeight: '600',
  },
  brandDivider: { width: 60, height: 1, backgroundColor: '#D4AF37', marginVertical: 12 },
  brandTagline: {
    fontSize: 13,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  bottomZone: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 20,
    fontFamily: GEO,
    fontWeight: '700',
    marginBottom: 20,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C44B4F14',
    paddingVertical: 10,
    paddingRight: 14,
    marginBottom: 16,
  },
  errorStripe: {
    width: 3,
    height: '100%',
    backgroundColor: '#C44B4F',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  errorText: { color: '#C44B4F', fontSize: 13, marginLeft: 8, flex: 1 },

  // Inputs
  inputContainer: { marginBottom: 14 },
  inputLabel: { color: '#6B6560', fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: '#262320',
    borderWidth: 1,
    borderColor: '#2A2724',
    color: '#E8E4DE',
    fontSize: 16,
    paddingHorizontal: 14,
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

  // Create button
  createBtn: {
    backgroundColor: '#1E4D2B',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    height: 48,
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: GEO,
  },

  // Login link
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
    paddingBottom: 32,
  },
  loginLabel: { color: '#6B6560', fontSize: 14 },
  loginLink: { color: '#2A9D8F', fontSize: 14, fontWeight: '600' },

  // Gold flash overlay
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    zIndex: 100,
  },
  flashGold: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D4AF37',
  },
  flashText: {
    fontSize: 22,
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#D4AF37',
    textAlign: 'center',
  },
});
