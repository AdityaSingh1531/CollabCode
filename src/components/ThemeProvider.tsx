'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'collabcode-theme';
const SOUND_STORAGE_KEY = 'collabcode-sound-muted';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
  isMuted: false,
  toggleMute: () => {},
});

function applyThemeClass(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // On mount, restore saved preferences.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = stored === null ? true : stored === 'dark';
    setIsDark(prefersDark);
    applyThemeClass(prefersDark);

    const storedMuted = localStorage.getItem(SOUND_STORAGE_KEY);
    setIsMuted(storedMuted === 'true');
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyThemeClass(next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, next ? 'true' : 'false');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, isMuted, toggleMute }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
