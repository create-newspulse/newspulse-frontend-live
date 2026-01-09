export function getPublicApiBaseUrl(): string {
  const raw = (
    // Vite-style envs (some deployments reuse them)
    process.env.VITE_API_BASE_URL ||
    process.env.VITE_API_URL ||
    process.env.VITE_BACKEND_URL ||

    // Preferred Next.js env (explicit backend origin)
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||

    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  )
    .toString()
    .trim();

  // Production default: the real backend hosting published Public Site Settings.
  // Can be overridden by any of the env vars above.
  const fallback = 'https://newspulse-backend-real.onrender.com';
  const base = raw || fallback;
  return base.replace(/\/+$/, '');
}
