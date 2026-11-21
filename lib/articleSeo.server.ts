import { getArticleEditionLocale, isArticleId } from './articleSlugs';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';
import { getPublicApiBaseUrl } from './publicApiBase';
import { parsePublicNewsArticle, type Article } from './publicNewsApi';
import { withPublicReadDeadline } from './publicReadDeadline';
import { getArticleAlternates, type SeoAlternate } from './seo';

const LOCALES: RouteLocale[] = ['en', 'hi', 'gu'];

function sameStory(left: Article, right: Article): boolean {
  if (left.translationGroupId && right.translationGroupId && left.translationGroupId !== right.translationGroupId) return false;
  if (left.translationKey && right.translationKey && left.translationKey !== right.translationKey) return false;
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
        const response = await fetch(`${base}/api/public/news/${encodeURIComponent(article._id)}?${query}`, {
          method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
        });
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
