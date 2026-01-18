import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';

const LOCALES = ['en', 'hi', 'gu'] as const;

type Locale = (typeof LOCALES)[number];

function stripLocalePrefix(path: string): string {
  // Remove leading /en, /hi, /gu if present.
  return path.replace(/^\/(en|hi|gu)(?=\/|\?|#|$)/, '');
}

function withLocalePrefix(path: string, locale: Locale, defaultLocale: Locale): string {
  const base = stripLocalePrefix(path) || '/';
  if (locale === defaultLocale) return base;
  if (base === '/') return `/${locale}`;
  return `/${locale}${base.startsWith('/') ? '' : '/'}${base}`;
}

function stripTrackingParams(asPath: string): string {
  const [rawPath, rawHash] = asPath.split('#');
  const [rawBase, rawQuery] = rawPath.split('?');
  if (!rawQuery) return asPath;

  const params = new URLSearchParams(rawQuery);
  const removeKeys: string[] = [];
  params.forEach((_, key) => {
    const k = key.toLowerCase();
    if (k === 'gclid' || k === 'fbclid' || k.startsWith('utm_')) removeKeys.push(key);
  });
  removeKeys.forEach((k) => params.delete(k));

  const query = params.toString();
  const rebuilt = query ? `${rawBase}?${query}` : rawBase;
  return rawHash ? `${rebuilt}#${rawHash}` : rebuilt;
}

export default function SeoAlternates() {
  const router = useRouter();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const defaultLocale = (router.defaultLocale || 'en') as Locale;
  const currentAsPath = stripTrackingParams(router.asPath || '/');

  // For SEO, prefer SSR-rendered absolute URLs.
  if (!siteUrl) return null;

  const canonicalPath = withLocalePrefix(currentAsPath, (router.locale || defaultLocale) as Locale, defaultLocale);
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  return (
    <Head>
      <link rel="canonical" href={canonicalUrl} />
      {LOCALES.map((loc) => {
        const href = `${siteUrl}${withLocalePrefix(currentAsPath, loc, defaultLocale)}`;
        return <link key={loc} rel="alternate" hrefLang={loc} href={href} />;
      })}
      <link rel="alternate" hrefLang="x-default" href={`${siteUrl}${withLocalePrefix(currentAsPath, defaultLocale, defaultLocale)}`} />
    </Head>
  );
}
