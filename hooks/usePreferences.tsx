// hooks/usePreferences.tsx
import { useState, useCallback } from 'react';
import { hasStoredConsentForCategory } from '../src/consent/cookieConsent';

export function usePreference<T>(key: string, defaultValue: T) {
  const [preference, setPreferenceState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    if (!hasStoredConsentForCategory('preferences')) return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  const setPreference = useCallback((value: T) => {
    setPreferenceState(value);
    if (typeof window !== 'undefined' && hasStoredConsentForCategory('preferences')) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key]);

  return { preference, setPreference };
}
