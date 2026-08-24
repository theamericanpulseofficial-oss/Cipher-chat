import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeConfig, ThemeMode } from '../types';
import { THEMES, DEFAULT_THEME } from '../theme/themes';

interface ThemeContextType {
  theme: ThemeConfig;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  availableThemes: ThemeConfig[];
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('cipherchat_theme_mode') as ThemeMode;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('cipherchat_sound') !== 'false';
  });

  const currentTheme = THEMES.find((t) => t.id === themeMode) || DEFAULT_THEME;
  const isDark = themeMode === 'dark';

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('cipherchat_theme_mode', mode);
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem('cipherchat_sound', String(enabled));
  };

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0b0f19';
      document.body.style.color = '#f1f5f9';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#0f172a';
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        themeMode,
        isDark,
        setThemeMode,
        toggleTheme,
        availableThemes: THEMES,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
