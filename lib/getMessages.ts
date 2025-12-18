export async function getMessages(locale?: string) {
  const safeLocale = (locale || 'en').toLowerCase();
  try {
    const en = (await import('../messages/en.json')).default as Record<string, any>;
    if (safeLocale === 'en') {
      return en;
    }
    try {
      const specific = (await import(`../messages/${safeLocale}.json`)).default as Record<string, any>;
      return { ...en, ...specific };
    } catch {
      return en;
    }
  } catch {
    // As an extreme fallback, return empty to avoid crashing
    return {} as Record<string, any>;
  }
}
