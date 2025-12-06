// hooks/usePreferences.tsx
import { useState, useCallback } from 'react';

export function usePreference<T>(key: string, defaultValue: T) {
  const [preference, setPreferenceState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  const setPreference = useCallback((value: T) => {
    setPreferenceState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key]);

  return { preference, setPreference };
}
