import type { GetStaticProps } from 'next';

import PulseDialogueLanding, { type PulseLandingProps } from '../../components/PulseDialogueLanding';
import { getMessages } from '../../lib/getMessages';
import { resolvePublicSiteUrl } from '../../lib/seo';
import { normalizeRouteLocale } from '../../lib/localizedArticleFields';
import { readPulse, pulseArticleQuery, EMPTY_PULSE_FILTERS, type PulsePage, type PulseCard, type PulseDiscovery } from '../../lib/pulseDialogueDiscovery';

export const getStaticProps: GetStaticProps = async (ctx) => {
  const locale = normalizeRouteLocale(ctx.locale);
  const [articles, discovery] = await Promise.allSettled([
    readPulse<PulsePage<PulseCard>>('articles', locale, pulseArticleQuery(EMPTY_PULSE_FILTERS)),
    readPulse<PulseDiscovery>('discovery', locale),
  ]);
  const initialPage = articles.status === 'fulfilled' ? articles.value : null;
  const initialItems = initialPage?.items || [];
  const origin = resolvePublicSiteUrl();
  const path = (lang: string) => `${origin}${lang === 'en' ? '' : `/${lang}`}/pulse-dialogue`;
  return { props: { locale, messages: await getMessages(locale), initialItems, initialPage,
    initialDiscovery: discovery.status === 'fulfilled' ? discovery.value : null,
    initialErrors: { articles: articles.status === 'rejected', discovery: discovery.status === 'rejected' },
    seo: { canonicalUrl: path(locale), alternates: [...['en', 'hi', 'gu'].map((lang) => ({ hrefLang: lang, href: path(lang) })), { hrefLang: 'x-default', href: path('en') }] },
  }, revalidate: 60 };
};

export default function PulseDialoguePage(props: PulseLandingProps) {
  return <PulseDialogueLanding {...props} />;
}