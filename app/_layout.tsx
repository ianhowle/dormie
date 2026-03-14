import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-url-polyfill/auto';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ToastProvider } from '../src/components/Toast';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Log env var availability on app start
    console.log('[Dormie] EXPO_PUBLIC_GOLF_API_KEY:', process.env.EXPO_PUBLIC_GOLF_API_KEY ? 'set' : 'NOT SET');
    console.log('[Dormie] EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'set' : 'NOT SET');
  }, []);

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

  // Status bar: light-content for dark mode (most screens), dark-content for light mode
  // Individual screens with green headers will override via StatusBar component
  const statusBarStyle = theme.isDark ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/splash" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/signup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/onboarding" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scoring" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="trip-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="create-trip" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="course-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="discover" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="h2h-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="player-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="season-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="seasons" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RootLayoutNav />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
