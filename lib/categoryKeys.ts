function normalizeCategoryToken(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ');
}

function sanitizeRouteKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

const ROUTE_ALIASES: Record<string, string> = {
  'science and technology': 'science-technology',
  'science technology': 'science-technology',
  'science-tech': 'science-technology',
  'science tech': 'science-technology',
  tech: 'science-technology',
  technology: 'science-technology',
};

export function getCategoryRouteKey(raw: unknown): string {
  const normalized = normalizeCategoryToken(raw);
  if (!normalized) return '';
  return ROUTE_ALIASES[normalized] || sanitizeRouteKey(normalized);
}

export function getCategoryIdentity(raw: unknown): string {
  if (typeof raw === 'string') return getCategoryRouteKey(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';

  const identity = [
    'slug' in raw ? raw.slug : undefined,
    'title' in raw ? raw.title : undefined,
    'name' in raw ? raw.name : undefined,
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));

  return getCategoryRouteKey(identity);
}

export function getCategoryQueryKey(raw: unknown): string {
  const routeKey = getCategoryRouteKey(raw);
  if (!routeKey) return '';
  if (routeKey === 'science-technology') return 'tech';
  return routeKey;
}
