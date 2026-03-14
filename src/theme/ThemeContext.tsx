import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, useColorScheme } from 'react-native';
import { dark, light, type ThemeColors } from './colors';

type ThemeMode = 'light' | 'dark';

type Theme = {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  /** Animated opacity for smooth crossfade transitions (0→1 during switch) */
  transitionOpacity: Animated.Value;
};

const darkTheme: Theme = { colors: dark, mode: 'dark', isDark: true };
const lightTheme: Theme = { colors: light, mode: 'light', isDark: false };

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  toggleTheme: () => {},
  transitionOpacity: new Animated.Value(1),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Detect system color scheme for initial default
  const systemScheme = useColorScheme();
  const [userOverride, setUserOverride] = useState<ThemeMode | null>(null);
  const transitionOpacity = useRef(new Animated.Value(1)).current;

  // Use user override if set, otherwise follow system
  const mode: ThemeMode = userOverride ?? (systemScheme === 'light' ? 'light' : 'dark');

  const toggleTheme = () => {
    // Fade out
    Animated.timing(transitionOpacity, {
      toValue: 0.7,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setUserOverride(mode === 'dark' ? 'light' : 'dark');
      // Fade back in
      Animated.timing(transitionOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const value = useMemo<ThemeContextValue>(() => ({
    theme: mode === 'dark' ? darkTheme : lightTheme,
    toggleTheme,
    transitionOpacity,
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={{ flex: 1, opacity: transitionOpacity }}>
        {children}
      </Animated.View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
