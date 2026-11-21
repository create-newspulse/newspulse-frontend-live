import { createContext, useCallback, useContext, useMemo, useState, useLayoutEffect, ReactNode } from 'react';
import { hasStoredConsentForCategory } from '../src/consent/cookieConsent';

export type ThemeMode = 'light' | 'dark';

export const PUBLIC_STYLES = [
  { id: 'aurora', mode: 'light', name: 'Aurora', accent: '#2563eb' },
  { id: 'midnight', mode: 'dark', name: 'Midnight', accent: '#38bdf8' },
] as const;

export const publicPalette = {
  bg: 'var(--np-theme-bg)', surface: 'var(--np-theme-surface)', surface2: 'var(--np-theme-surface2)',
  border: 'var(--np-theme-border)', text: 'var(--np-theme-text)', sub: 'var(--np-theme-sub)',
  muted: 'var(--np-theme-muted)', chip: 'var(--np-theme-chip)', chipHover: 'var(--np-theme-chip-hover)',
  accent: 'var(--np-theme-accent)', accent2: 'var(--np-theme-accent2)',
  live: 'var(--np-theme-live)', breaking: 'var(--np-theme-breaking)',
};

export function PublicStyleName() {
  return <><span className="np-aurora-name">Aurora</span><span className="np-midnight-name">Midnight</span></>;
}

interface ThemeContextType {
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  useLayoutEffect(() => {
    setModeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    setModeState(next);
    if (!hasStoredConsentForCategory('preferences')) return;
    try {
      localStorage.setItem('np_style', next === 'dark' ? 'midnight' : 'aurora');
      localStorage.setItem('theme', next);
    } catch {
      console.warn('[theme] Preference storage unavailable; the selection applies to this visit.');
    }
  }, []);

  const value = useMemo(() => ({
    isDark: mode === 'dark', mode, setMode, toggleTheme: () => setMode(mode === 'dark' ? 'light' : 'dark'),
  }), [mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Dark mode toggle component
export const DarkModeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-200"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};