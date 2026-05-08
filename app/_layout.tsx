import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import 'react-native-url-polyfill/auto';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ToastProvider } from '../src/components/Toast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { DemoModeProvider } from '../src/contexts/DemoModeContext';
import { initSentry, setSentryUser, clearSentryUser, Sentry } from '../src/lib/sentry';
import { initPushForUser } from '../src/services/pushNotification.service';
import { parseInviteUrl } from '../src/lib/inviteLinks';

initSentry();

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

  // Tie Sentry crash reports to the authenticated user
  useEffect(() => {
    if (session?.user) {
      setSentryUser({ id: session.user.id, email: session.user.email });
    } else {
      clearSentryUser();
    }
  }, [session]);

  // Register for push notifications once authenticated
  useEffect(() => {
    if (session?.user?.id) {
      initPushForUser(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  // Listen for trip invite deep links (dormie://trip-invite/CODE)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = parseInviteUrl(url);
      if (!parsed) return;
      if (parsed.type === 'trip-invite') {
        router.push({ pathname: '/trip-invite', params: { code: parsed.code } });
      }
    };

    // Cold start: check if app was opened via a link
    Linking.getInitialURL().then((url) => url && handleUrl(url));

    // Warm state: listen for incoming links while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'auth' && segments[1] === 'onboarding';
    const onboardingComplete = session?.user?.user_metadata?.onboarding_complete === true;

    if (!session && !inAuthGroup) {
      // Not signed in and not on auth screen → go to splash
      router.replace('/auth/splash');
    } else if (session && !onboardingComplete && !inOnboarding) {
      // Signed in but onboarding not complete → go to onboarding
      router.replace('/auth/onboarding');
    } else if (session && onboardingComplete && inAuthGroup && !inOnboarding) {
      // Signed in, onboarding done, but on auth screen → go to tabs
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
        {/* Phase 2 wizard — gestureEnabled:false so swipe-back doesn't
            accidentally lose mid-flow state. In-wizard Back button +
            Android hardware back handle step-back; X close = dismiss.
            presentation:'fullScreenModal' (vs 'modal') gives edge-to-
            edge coverage on iOS so the screen beneath doesn't bleed
            above the wizard header. Paired with <StatusBar hidden />
            in WizardLayout to suppress the system clock/signal/battery
            during the flow — same fix pattern as Phase 1.9b's
            DormieMomentTripLaunched modal. */}
        <Stack.Screen name="create-trip-quick" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="course-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="discover" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="h2h-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="player-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="season-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="season-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="week-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="season-create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="round-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="stats-drill-in" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="explore-dream-trip" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="avatar-picker" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="add-friends" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="groups" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="group-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="course-search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="trip-invite" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <DemoModeProvider>
              <RootLayoutNav />
            </DemoModeProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
