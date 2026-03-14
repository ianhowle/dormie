import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-url-polyfill/auto';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { ThemeProvider } from '../src/theme/ThemeContext';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'auth' && segments[1] === 'onboarding';

    if (!session && !inAuthGroup) {
      // Not signed in and not on auth screen → go to splash
      router.replace('/auth/splash');
    } else if (session && inAuthGroup && !inOnboarding) {
      // Signed in but on auth screen (not onboarding) → go to tabs
      router.replace('/(tabs)');
    }
    // If in onboarding, let the user complete it before redirecting
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/splash" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="scoring" options={{ gestureEnabled: false }} />
        <Stack.Screen name="trip-detail" />
        <Stack.Screen name="create-trip" options={{ presentation: 'modal' }} />
        <Stack.Screen name="course-detail" />
        <Stack.Screen name="discover" />
        <Stack.Screen name="h2h-detail" />
        <Stack.Screen name="player-detail" />
        <Stack.Screen name="season-detail" />
        <Stack.Screen name="seasons" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
