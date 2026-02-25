export function isSafeMode(): boolean {
  const raw = String(process.env.NEXT_PUBLIC_SAFE_MODE || '').toLowerCase().trim();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
