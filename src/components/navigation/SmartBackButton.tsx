import React from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';

function stripQueryHash(path: string): string {
  const raw = String(path || '/');
  const noHash = raw.split('#')[0] || '/';
  const noQuery = noHash.split('?')[0] || '/';
  return noQuery || '/';
}

function normalizePath(path: string): string {
  const p = stripQueryHash(path);
  const withSlash = p.startsWith('/') ? p : `/${p}`;
  const trimmed = withSlash.replace(/\/+$/, '') || '/';
  return trimmed;
}

function detectLocalePrefix(pathname: string): '' | '/en' | '/hi' | '/gu' {
  const p = normalizePath(pathname).toLowerCase();
  if (p === '/hi' || p.startsWith('/hi/')) return '/hi';
  if (p === '/gu' || p.startsWith('/gu/')) return '/gu';
  if (p === '/en' || p.startsWith('/en/')) return '/en';
  return '';
}

function stripLocalePrefix(pathname: string): string {
  const p = normalizePath(pathname);
  const lower = p.toLowerCase();
  if (lower === '/hi' || lower.startsWith('/hi/')) return `/${p.slice('/hi'.length).replace(/^\//, '')}`.replace(/\/+$/, '') || '/';
  if (lower === '/gu' || lower.startsWith('/gu/')) return `/${p.slice('/gu'.length).replace(/^\//, '')}`.replace(/\/+$/, '') || '/';
  if (lower === '/en' || lower.startsWith('/en/')) return `/${p.slice('/en'.length).replace(/^\//, '')}`.replace(/\/+$/, '') || '/';
  return p;
}

function needsSmartBack(pathnameNoLocale: string): boolean {
  const p = normalizePath(pathnameNoLocale).toLowerCase();
  if (!p || p === '/') return false;

  if (p.startsWith('/news/')) return true;
  if (p === '/breaking') return true;
  if (p.startsWith('/regional/')) return true;
  if (p.startsWith('/national/states')) return true;
  if (p === '/search' || p.startsWith('/search/')) return true;

  return false;
}

function fallbackFor(pathnameNoLocale: string): string {
  const p = normalizePath(pathnameNoLocale).toLowerCase();

  if (p === '/breaking') return '/';
  if (p.startsWith('/news/')) return '/';
  if (p.startsWith('/regional/')) return '/regional/gujarat';
  if (p.startsWith('/national/states')) return '/national';
  if (p === '/search' || p.startsWith('/search/')) return '/';

  return '/';
}

function withLocalePrefix(prefix: '' | '/en' | '/hi' | '/gu', fallback: string): string {
  const dest = normalizePath(fallback);
  if (!prefix) return dest;

  if (dest === '/') return prefix;
  return `${prefix}${dest}`;
}

export default function SmartBackButton() {
  const router = useRouter();

  const asPath = String(router.asPath || '/');
  const prefix = detectLocalePrefix(asPath);
  const pathNoLocale = stripLocalePrefix(asPath);

  const show = needsSmartBack(pathNoLocale);
  if (!show) return null;

  const onBack = () => {
    const fallback = withLocalePrefix(prefix, fallbackFor(pathNoLocale));

    try {
      if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
        router.back();
        return;
      }
    } catch {
      // ignore
    }

    router.push(fallback).catch(() => {});
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-6xl px-4 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>
    </div>
  );
}
