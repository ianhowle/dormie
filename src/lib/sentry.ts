import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) {
    console.warn('[Dormie] Sentry DSN not set — crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn: DSN,
    debug: __DEV__,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

/**
 * Set user context on Sentry so crashes are tied to specific users.
 * Call after successful authentication.
 */
export function setSentryUser(user: { id: string; email?: string }) {
  Sentry.setUser({ id: user.id, email: user.email });
}

/**
 * Clear user context on sign-out.
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry };
