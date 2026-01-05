export function getPublicApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').toString().trim();
  return raw.replace(/\/+$/, '');
}
