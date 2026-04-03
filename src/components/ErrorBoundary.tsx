import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentry } from '../lib/sentry';

type Props = {
  children: ReactNode;
  /** Optional fallback to render instead of the default error UI */
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Catches render errors and shows a branded Dormie fallback UI
 * instead of the raw red error screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Dormie] ErrorBoundary caught:', error, info.componentStack);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    // Use expo-router to navigate home — dynamic import to avoid issues
    // when ErrorBoundary is mounted above the router
    try {
      const { router } = require('expo-router');
      router.replace('/(tabs)');
    } catch {
      // If router isn't available, just reset
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = __DEV__;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="alert-circle-outline" size={48} color="#C9A227" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            Don't worry — your data is safe. Try again or head back to the home screen.
          </Text>

          {isDev && this.state.error && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEV ERROR</Text>
              <Text style={styles.devMessage}>{this.state.error.message}</Text>
            </View>
          )}

          <Pressable style={styles.primaryButton} onPress={this.handleReset}>
            <Ionicons name="refresh" size={18} color="#141210" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={this.handleGoHome}>
            <Ionicons name="home-outline" size={18} color="#E8E4DE" />
            <Text style={styles.secondaryButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141210',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1816',
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 22,
    fontWeight: '700',
    color: '#E8E4DE',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6560',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  devBox: {
    backgroundColor: '#262320',
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C41E3A',
    letterSpacing: 1,
    marginBottom: 4,
  },
  devMessage: {
    fontSize: 13,
    color: '#E8E4DE',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A227',
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 24,
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141210',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#262320',
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 10,
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8E4DE',
  },
});
