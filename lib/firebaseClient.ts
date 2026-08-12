import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getApps, initializeApp } from 'firebase/app';

type FirebaseEnvName =
  | 'NEXT_PUBLIC_FIREBASE_API_KEY'
  | 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  | 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'NEXT_PUBLIC_FIREBASE_APP_ID'
  | 'NEXT_PUBLIC_FIREBASE_VAPID_KEY';

type ResolvedFirebaseEnvValue = {
  name: FirebaseEnvName;
  value: string;
};

export type FirebaseClientConfigStatus = {
  isConfigured: boolean;
  config: FirebaseOptions;
  vapidKey: string;
  missingEnv: string[];
};

export type FirebaseClientAppResult =
  | { ok: true; app: FirebaseApp; configStatus: FirebaseClientConfigStatus }
  | {
      ok: false;
      reason: 'not-browser' | 'not-configured' | 'initialization-failed';
      configStatus: FirebaseClientConfigStatus;
      error?: unknown;
    };

function cleanEnvValue(value: string | undefined): string {
  const withoutTrailingCommas = String(value || '').trim().replace(/,+$/g, '').trim();
  if (
    (withoutTrailingCommas.startsWith('"') && withoutTrailingCommas.endsWith('"')) ||
    (withoutTrailingCommas.startsWith("'") && withoutTrailingCommas.endsWith("'"))
  ) {
    return withoutTrailingCommas.slice(1, -1).trim();
  }
  return withoutTrailingCommas.replace(/^["']/, '').replace(/["']$/, '').trim();
}

function getResolvedFirebaseEnvValues(): ResolvedFirebaseEnvValue[] {
  return [
    {
      name: 'NEXT_PUBLIC_FIREBASE_API_KEY',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_APP_ID',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
      value: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
    },
  ];
}

function getResolvedFirebaseEnvValue(values: ResolvedFirebaseEnvValue[], name: FirebaseEnvName): string {
  return values.find((entry) => entry.name === name)?.value || '';
}

export function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined';
}

export function getFirebaseClientConfig(): FirebaseClientConfigStatus {
  const envValues = getResolvedFirebaseEnvValues();
  const config: FirebaseOptions = {
    apiKey: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') || undefined,
    messagingSenderId: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
  };

  const vapidKey = getResolvedFirebaseEnvValue(envValues, 'NEXT_PUBLIC_FIREBASE_VAPID_KEY');
  const missingEnv = envValues.filter((entry) => !entry.value).map((entry) => entry.name);

  return {
    isConfigured: missingEnv.length === 0,
    config,
    vapidKey,
    missingEnv: [...missingEnv],
  };
}

export function getFirebaseClientApp(): FirebaseClientAppResult {
  const configStatus = getFirebaseClientConfig();

  if (!isBrowserRuntime()) {
    return { ok: false, reason: 'not-browser', configStatus };
  }

  if (!configStatus.isConfigured) {
    return { ok: false, reason: 'not-configured', configStatus };
  }

  try {
    const existingApp = getApps()[0];
    const app = existingApp || initializeApp(configStatus.config);
    return { ok: true, app, configStatus };
  } catch (error) {
    return { ok: false, reason: 'initialization-failed', configStatus, error };
  }
}