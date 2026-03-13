import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme/ThemeContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>Welcome Back</Text>
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
      <Pressable style={[styles.button, { backgroundColor: c.teal }]} onPress={handleLogin} disabled={loading}>
        <Text style={[styles.buttonText, { color: c.bg }]}>{loading ? 'Signing in...' : 'Log In'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/auth/signup')}>
        <Text style={[styles.link, { color: c.teal }]}>Don't have an account? Sign Up</Text>
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
