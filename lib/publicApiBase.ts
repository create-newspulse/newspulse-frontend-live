export function getPublicApiBaseUrl(): string {
  const raw = (
    // Vite-style envs (some deployments reuse them)
    process.env.VITE_API_BASE_URL ||
    process.env.VITE_API_URL ||
    process.env.VITE_BACKEND_URL ||

    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  )
    .toString()
    .trim();
  return raw.replace(/\/+$/, '');
}
