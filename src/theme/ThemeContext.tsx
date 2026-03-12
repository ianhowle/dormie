import React, { createContext, useContext, useState } from 'react';
import { colors } from './colors';
import { fonts } from './fonts';

type ThemeMode = 'light' | 'dark';

type Theme = {
  colors: typeof colors;
  fonts: typeof fonts;
  mode: ThemeMode;
};

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const lightTheme: Theme = {
  colors,
  fonts,
  mode: 'light',
};

const darkTheme: Theme = {
  colors: {
    ...colors,
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    textLight: '#808080',
    border: '#333333',
  },
  fonts,
  mode: 'dark',
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = mode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
