export type PublicVersionState = {
  ok: boolean;
  version: string | null;
  updatedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickFirstNonEmpty(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return null;
}

export function normalizePublicVersion(raw: unknown): PublicVersionState {
  const root = isRecord(raw) ? raw : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const payload = data || root;

  const version = pickFirstNonEmpty([
    payload?.version,
    payload?.etag,
    payload?.hash,
    payload?.revision,
    payload?.updatedAt,
    payload?.publishedAt,
    root?.version,
    root?.updatedAt,
    root?.publishedAt,
  ]);

  const updatedAt = pickFirstNonEmpty([
    payload?.updatedAt,
    payload?.publishedAt,
    root?.updatedAt,
    root?.publishedAt,
  ]);

  const ok = typeof root?.ok === 'boolean' ? root.ok : typeof root?.success === 'boolean' ? root.success : Boolean(version || updatedAt);

  return {
    ok,
    version,
    updatedAt,
  };
}

export async function fetchPublicVersion(options?: { signal?: AbortSignal }): Promise<PublicVersionState> {
  const endpoint = '/api/public/version';
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal: options?.signal,
  });

  const body = await res.json().catch(() => null);
  const normalized = normalizePublicVersion(body);

  if (!res.ok || !normalized.version) {
    throw new Error(`PUBLIC_VERSION_FETCH_FAILED_${res.status || 0}`);
  }

  return normalized;
}