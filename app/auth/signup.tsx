import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme/ThemeContext';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const handleSignUp = async () => {
    if (!email || !password) return;
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      router.replace('/auth/onboarding');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
      <TextInput
        style={[styles.input, { borderColor: c.border, color: c.text }]}
        placeholder="Email"
        placeholderTextColor={c.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, { borderColor: c.border, color: c.text }]}
        placeholder="Password"
        placeholderTextColor={c.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={[styles.input, { borderColor: c.border, color: c.text }]}
        placeholder="Confirm Password"
        placeholderTextColor={c.textMuted}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Pressable style={[styles.button, { backgroundColor: c.teal }]} onPress={handleSignUp} disabled={loading}>
        <Text style={[styles.buttonText, { color: c.bg }]}>{loading ? 'Creating...' : 'Sign Up'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/auth/login')}>
        <Text style={[styles.link, { color: c.teal }]}>Already have an account? Log In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, padding: 16, marginBottom: 16, fontSize: 16 },
  button: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
