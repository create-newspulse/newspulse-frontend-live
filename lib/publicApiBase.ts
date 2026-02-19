let warnedUnsafeDevBase = false;

function normalizeBase(raw: string): string {
  // Normalize to an origin-ish base (no trailing slash, and strip trailing /api).
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
}

function isProdDeployment(): boolean {
  // IMPORTANT:
  // - Don't treat local `next start` (NODE_ENV=production) as “production deployment”.
  // - Prefer a real deployment signal (Vercel production) or an explicit override.
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return true;
  const explicit = String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase();
  return explicit === 'production' || explicit === 'prod';
}

function isLikelyProdDomain(base: string): boolean {
  const b = base.toLowerCase();
  return b.includes('newspulse.co.in') || b.includes('admin.newspulse.co.in');
}

function envBool(name: string): boolean {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function resolveConfiguredBase(): string {
  // Highest priority: explicit single-base override.
  const explicit = normalizeBase(String(process.env.NEXT_PUBLIC_API_BASE || ''));
  if (explicit) return explicit;

  // New: split config for environment separation.
  const split = normalizeBase(
    String((isProdDeployment() ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV) || '')
  );
  if (split) return split;

  // Back-compat aliases (older deployments / docs).
  const legacy = normalizeBase(
    String(
      process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ||
        process.env.BACKEND_API_BASE_URL ||
        process.env.NEWS_PULSE_BACKEND_URL ||
        process.env.API_BASE_URL ||
        ''
    )
  );
  return legacy;
}

export function getPublicApiBaseUrl(): string {
  // In the browser, prefer same-origin requests to Next API routes.
  // Those routes proxy to the backend using a server-side base and can fall back
  // to safe defaults when the backend is unreachable.
  if (typeof window !== 'undefined') return '';

  const base = resolveConfiguredBase();

  // Safety: local dev should not silently hit production.
  // This prevents accidental cross-environment writes (admin) and reads (public).
  if (!isProdDeployment() && base && isLikelyProdDomain(base) && !envBool('NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV')) {
    if (!warnedUnsafeDevBase) {
      warnedUnsafeDevBase = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[newspulse] Refusing to use production backend in dev: NEXT_PUBLIC_API_BASE resolved to '${base}'. ` +
          `Set NEXT_PUBLIC_API_BASE_DEV to your DEV backend, or set NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV=true to override.`
      );
    }
    return '';
  }

  return base;
}
