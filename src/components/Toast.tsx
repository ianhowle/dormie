import React, { useEffect, useRef, createContext, useContext, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'info' | 'gold' | 'error';

type ToastConfig = {
  message: string;
  type?: ToastType;
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number;
};

type ToastContextValue = {
  showToast: (config: ToastConfig) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: '#1E4D2B', text: '#FFFFFF', icon: '#006747' },
  info: { bg: '#1A1816', text: '#E8E4DE', icon: '#006747' },
  gold: { bg: '#2A2318', text: '#C9A227', icon: '#C9A227' },
  error: { bg: '#3A1A1A', text: '#FFFFFF', icon: '#C41E3A' },
};

const DEFAULT_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  gold: 'trophy',
  error: 'alert-circle',
};

function ToastView({ config, onDone }: { config: ToastConfig; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const type = config.type ?? 'success';
  const colors = TOAST_COLORS[type];
  const icon = config.icon ?? DEFAULT_ICONS[type];
  const duration = config.duration ?? 2000;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDone());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg,
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.icon} />
      <Text style={[styles.toastText, { color: colors.text }]}>{config.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastConfig | null>(null);

  const showToast = useCallback((config: ToastConfig) => {
    setToast(null);
    // Small delay to reset animation if showing back-to-back
    setTimeout(() => setToast(config), 50);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <ToastView config={toast} onDone={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 9999,
    // Dark card shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        shadowOpacity: 0.4,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
