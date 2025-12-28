import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { useRegionalPulse } from '../../../features/regional/useRegionalPulse';
import { matchesDistrict } from '../../../features/regional/api';
import LanguageToggle from '../../../components/LanguageToggle';
import { GUJARAT_DISTRICTS } from '../../../utils/regions';
import { useLanguage } from '../../../utils/LanguageContext';
import { getGujaratDistrictName, getStateName, tHeading } from '../../../utils/localizedNames';
import type { GetStaticProps } from 'next';

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchDistrict(article: any, districtName: string) {
  const n = normalize(districtName);
  const text = normalize(`${article.title || ''} ${article.excerpt || ''} ${article.content || ''} ${article.location || ''} ${(article.tags || []).join(' ')}`);
  if (!n) return false;
  // match full word
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}

export default function GujaratDistrictPage() {
  const router = useRouter();
  const { district } = router.query as { district?: string };
  const { language } = useLanguage();
  const { feed, loading } = useRegionalPulse();

  const entry = GUJARAT_DISTRICTS.find((d) => d.slug === district);
  const displayName = entry ? getGujaratDistrictName(language as any, entry.slug, entry.name) : tHeading(language as any, 'district');
  const stateName = getStateName(language as any, 'gujarat', 'Gujarat');

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${displayName} News – ${stateName} | News Pulse`}</title>
        <meta name="description" content={`Latest news from ${displayName}, ${stateName}.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <LanguageToggle />
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">🗺️ {displayName} — {stateName}</h1>
          <p className="text-gray-600">Local updates curated from our {tHeading(language as any, 'regional')} feed. This page auto-filters stories mentioning this {tHeading(language as any, 'district').toLowerCase()}.</p>
        </div>

        {(() => {
          const filtered = entry ? feed.filter((a) => matchesDistrict(a as any, entry.name)) : feed;
          return (
            <div className="grid md:grid-cols-2 gap-6">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50" />
                ))
              ) : filtered.length ? (
                filtered.map((article: any, idx: number) => (
                  <a key={idx} href={article._id ? `/story/${article._id}` : '#'} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                    <div className="text-xs text-gray-500 mb-2">{article.publishedAt ? new Date(article.publishedAt).toLocaleString() : ''}</div>
                    <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{article.excerpt || (article.content ? (article.content as string).slice(0,160) + '...' : '')}</p>
                    <div className="mt-3 text-xs text-gray-400">Source: {article.source || 'News Pulse'}</div>
                  </a>
                ))
              ) : (
                <div className="col-span-2 text-gray-600">No local stories found for {displayName} yet. Try broader {tHeading(language as any, 'regional')} news or another {tHeading(language as any, 'district').toLowerCase()}.</div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../../../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
