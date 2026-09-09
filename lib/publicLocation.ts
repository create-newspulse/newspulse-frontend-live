const NON_LOCATION_METADATA_TOKENS = new Set([
  'archived',
  'deleted',
  'draft',
  'pending',
  'published',
  'rejected',
  'scheduled',
  'unpublished',
]);

function cleanLocationPart(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  if (NON_LOCATION_METADATA_TOKENS.has(normalized)) return '';

  const asciiSafe = /^[a-z0-9\s_-]+$/i.test(raw);
  if (!asciiSafe) return raw;

  const spaced = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return '';

  return spaced.replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

export function formatPublicLocationParts(parts: unknown[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const part of parts) {
    const label = cleanLocationPart(part);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }

  return labels.join(', ');
}

export function formatPublicArticleLocation(article: any): string {
  const loc = article?.location;

  if (typeof loc === 'string') {
    return formatPublicLocationParts(loc.split(/[,;|]/g));
  }

  if (loc && typeof loc === 'object') {
    const fromObject = formatPublicLocationParts([
      loc.city,
      loc.district,
      loc.state,
      loc.region,
      loc.country,
    ]);
    if (fromObject) return fromObject;
  }

  return formatPublicLocationParts([
    article?.locationLabel,
    article?.locationText,
    article?.city,
    article?.district,
    article?.state,
    article?.region,
    article?.country,
  ]);
}