import { useEffect, useState } from 'react';

import {
  DEFAULT_PUBLIC_COMPLIANCE_SETTINGS,
  fetchPublicComplianceSettings,
  type PublicComplianceSettings,
} from '../lib/publicComplianceSettings';

const COMPLIANCE_SETTINGS_POLL_INTERVAL_MS = 30_000;

function areSettingsEqual(left: PublicComplianceSettings, right: PublicComplianceSettings): boolean {
  const keys = Object.keys(DEFAULT_PUBLIC_COMPLIANCE_SETTINGS) as Array<keyof PublicComplianceSettings>;

  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }

  return true;
}

export function usePublicComplianceSettings(initialSettings?: Partial<PublicComplianceSettings> | null) {
  const [settings, setSettings] = useState<PublicComplianceSettings>({
    ...DEFAULT_PUBLIC_COMPLIANCE_SETTINGS,
    ...(initialSettings ?? {}),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let isRequestInFlight = false;
    let activeController: AbortController | null = null;

    const refreshSettings = async () => {
      if (cancelled || isRequestInFlight) return;

      isRequestInFlight = true;
      const controller = new AbortController();
      activeController = controller;

      try {
        const next = await fetchPublicComplianceSettings({
          signal: controller.signal,
          cacheBust: true,
        });

        if (cancelled || controller.signal.aborted) return;

        setSettings((current) => (areSettingsEqual(current, next) ? current : next));
      } finally {
        isRequestInFlight = false;
        if (activeController === controller) {
          activeController = null;
        }
      }
    };

    void refreshSettings();
    const intervalId = window.setInterval(() => {
      void refreshSettings();
    }, COMPLIANCE_SETTINGS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      activeController?.abort();
    };
  }, []);

  return { settings } as const;
}