export function getPublicApiBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  )
    .toString()
    .trim();
  return raw.replace(/\/+$/, '');
}
