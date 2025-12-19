import path from 'path';
import { promises as fs } from 'fs';

export type PublicSettingsKey = 'comments.enabled' | 'voice.enabled' | 'askAnchor.enabled';

const ALLOWED_KEYS: ReadonlyArray<PublicSettingsKey> = [
  'comments.enabled',
  'voice.enabled',
  'askAnchor.enabled',
];

const DEFAULT_PUBLIC_SETTINGS: Record<PublicSettingsKey, boolean> = {
  'comments.enabled': true,
  'voice.enabled': true,
  'askAnchor.enabled': true,
};

const publicSettingsPath = path.join(process.cwd(), 'data', 'public-settings.json');

type JsonRecord = Record<string, any>;

function resolveDottedKey(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

export function parsePublicSettingsKeys(input: unknown): PublicSettingsKey[] {
  if (!input) return [...ALLOWED_KEYS];
  const raw = Array.isArray(input) ? input.join(',') : String(input);
  const requested = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = requested.filter((k): k is PublicSettingsKey => (ALLOWED_KEYS as ReadonlyArray<string>).includes(k));
  return filtered.length ? filtered : [...ALLOWED_KEYS];
}

export async function readPublicSettingsFile(): Promise<JsonRecord> {
  try {
    const raw = await fs.readFile(publicSettingsPath, 'utf8');
    return JSON.parse(raw) as JsonRecord;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      await fs.mkdir(path.dirname(publicSettingsPath), { recursive: true });
      await fs.writeFile(publicSettingsPath, JSON.stringify({
        comments: { enabled: DEFAULT_PUBLIC_SETTINGS['comments.enabled'] },
        voice: { enabled: DEFAULT_PUBLIC_SETTINGS['voice.enabled'] },
        askAnchor: { enabled: DEFAULT_PUBLIC_SETTINGS['askAnchor.enabled'] },
      }, null, 2), 'utf8');
      return {
        comments: { enabled: DEFAULT_PUBLIC_SETTINGS['comments.enabled'] },
        voice: { enabled: DEFAULT_PUBLIC_SETTINGS['voice.enabled'] },
        askAnchor: { enabled: DEFAULT_PUBLIC_SETTINGS['askAnchor.enabled'] },
      };
    }
    throw err;
  }
}

export async function getPublicSettings(keys: PublicSettingsKey[]): Promise<Record<PublicSettingsKey, boolean>> {
  const file = await readPublicSettingsFile();
  const out: Record<PublicSettingsKey, boolean> = { ...DEFAULT_PUBLIC_SETTINGS };

  for (const key of keys) {
    const value = resolveDottedKey(file, key);
    if (typeof value === 'boolean') out[key] = value;
  }

  // Ensure we never return keys outside the allowed set.
  return Object.fromEntries(keys.map((k) => [k, out[k]])) as Record<PublicSettingsKey, boolean>;
}
