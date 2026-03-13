import React, { createContext, useContext, useMemo, useState } from 'react';
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
};

const darkTheme: Theme = { colors: dark, mode: 'dark', isDark: true };
const lightTheme: Theme = { colors: light, mode: 'light', isDark: false };

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const value = useMemo<ThemeContextValue>(() => ({
    theme: mode === 'dark' ? darkTheme : lightTheme,
    toggleTheme: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
