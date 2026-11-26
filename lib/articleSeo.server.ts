import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import { getArticleEditionLocale, isArticleId } from './articleSlugs';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';
import { getPublicApiBaseUrl } from './publicApiBase';
import { anonymousArticleGet } from './publicArticleRequest';
import { parsePublicNewsArticle, type Article } from './publicNewsApi';
import { withPublicReadDeadline } from './publicReadDeadline';
import { getArticleAlternates, NEWS_PULSE_SITE_URL, type SeoAlternate } from './seo';

const LOCALES: RouteLocale[] = ['en', 'hi', 'gu'];

// Self-fetches go to this deployment, not to an authority supplied by the reader.
export function getArticleReaderOrigin(req: IncomingMessage): string {
  const deployment = process.env.VERCEL_ENV;
  const production = deployment === 'production' ||
    /^(production|prod)$/i.test(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '');
  if (deployment === 'preview' || production) {
    const raw = deployment === 'preview'
      ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      : process.env.NEXT_PUBLIC_SITE_URL || NEWS_PULSE_SITE_URL;
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Invalid article reader origin');
    }
    return url.origin;
  }
  const socket = req.socket;
  const port = socket?.localPort;
  const addr = socket?.localAddress;
  if (!port || !addr || !isIP(addr)) throw new Error('Missing local article reader origin');
  return `${'encrypted' in socket && socket.encrypted ? 'https' : 'http'}://${isIP(addr) === 6 ? `[${addr}]` : addr}:${port}`;
}

export function conflictingStoryIdentity(left: Article, right: Article): boolean {
  return Boolean((left.translationGroupId && right.translationGroupId && left.translationGroupId !== right.translationGroupId)
    || (left.translationKey && right.translationKey && left.translationKey !== right.translationKey));
}

export function sameStory(left: Article, right: Article): boolean {
  if (conflictingStoryIdentity(left, right)) return false;
  return left._id === right._id
    || Boolean(left.translationGroupId && left.translationGroupId === right.translationGroupId)
    || Boolean(left.translationKey && left.translationKey === right.translationKey);
}

export async function fetchArticleAlternates(article: Article, siteUrl: string, timeoutMs: number): Promise<SeoAlternate[]> {
  const current = getArticleAlternates(article, siteUrl);
  const pending = LOCALES.filter(lang => !current.some(link => link.hrefLang === lang) && (
    article.translations?.[lang] === true || article.availableLocales?.includes(lang) || article.publishedLocales?.includes(lang)
  ));
  if (!pending.length || !isArticleId(article._id)) return current;
  const base = getPublicApiBaseUrl().replace(/\/+$/, '');
  const editions = await Promise.all(pending.map(async lang => {
    try {
      if (!base) throw new Error('Public backend is not configured');
      return await withPublicReadDeadline(timeoutMs, async signal => {
        const query = new URLSearchParams({ lang, language: lang });
        const response = await fetch(`${base}/api/public/news/${encodeURIComponent(article._id)}?${query}`, anonymousArticleGet(signal));
        if (response.status === 404 || response.status === 410) return null;
        if (!response.ok) throw new Error('Public edition unavailable');
        const edition = parsePublicNewsArticle(await response.json());
        signal.throwIfAborted();
        if (!edition || !sameStory(article, edition) || edition.isFallback === true
          || getArticleEditionLocale(edition) !== lang
          || !getLocalizedArticleFields(edition, lang, STRICT_LOCALE_POLICY).isVisible) {
          throw new Error('Invalid public edition');
        }
        return edition;
      });
    } catch {
      console.error('[seo] Article alternate unavailable', { locale: lang });
      return null;
    }
  }));
  return getArticleAlternates(article, siteUrl, editions.filter((edition): edition is Article => edition !== null));
}
