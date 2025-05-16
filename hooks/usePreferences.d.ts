export function usePreference<T>(key: string, defaultValue: T): {
  preference: T;
  setPreference: (value: T) => void;
};
