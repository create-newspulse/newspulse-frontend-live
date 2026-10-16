const HTTP_DATE_PATTERNS = [
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/,
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2} \d{2}:\d{2}:\d{2} GMT$/,
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/,
];

export function getSafeRetryAfter(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return undefined;
  const header = value.trim();
  if (/^\d+$/.test(header)) {
    return Number.isSafeInteger(Number(header)) ? header : undefined;
  }
  if (HTTP_DATE_PATTERNS.some(pattern => pattern.test(header)) && Number.isFinite(Date.parse(header))) {
    return header;
  }
  return undefined;
}
