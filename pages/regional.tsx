import Head from 'next/head';
import React from 'react';
import Link from 'next/link';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../utils/LanguageContext';
import { getGujaratCityName, getGujaratDistrictName, getStateName, tHeading } from '../utils/localizedNames';
import { GUJARAT_MAJOR_CITIES } from '../utils/gujaratCities';
import { GUJARAT_DISTRICTS } from '../utils/regions';

export default function RegionalPage() {
  const { language } = useLanguage();
  // De-duplicate districts by slug and keep stable order
  const districtsUnique = React.useMemo(() => {
    const seen = new Set<string>();
    return GUJARAT_DISTRICTS.filter((d) => {
      if (seen.has(d.slug)) return false;
      seen.add(d.slug);
      return true;
    });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Regional News - News Pulse</title>
        <meta name="description" content="Regional news and local updates from across states." />
      </Head>
  <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-4">
          <LanguageToggle />
        </div>
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold mb-2">🗺️ {tHeading(language as any, 'regional')}</h1>
          <p className="text-gray-600">Explore districts of {getStateName(language as any, 'gujarat', 'Gujarat')}.</p>
        </div>

        {/* Top Cities highlight */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold">🏙️ {tHeading(language as any, 'top-cities')}</h2>
            <span className="text-xs text-gray-500">Current + Newly Approved</span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {GUJARAT_MAJOR_CITIES.map((c) => {
              const href = c.linkType === 'district'
                ? `/regional/gujarat/${c.districtSlug}`
                : `/regional/gujarat/city/${c.slug}`;
              const display = getGujaratCityName(language as any, c.slug, c.name);
              return (
                <Link key={c.slug} href={href} className="group block bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-3xl">{c.status === 'current' ? '🏛️' : '🆕'}</div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${c.status==='current' ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                      {c.status === 'current' ? 'Current' : 'Approved'}
                    </span>
                  </div>
                  <div className="font-semibold text-lg group-hover:text-blue-600">{display}</div>
                  <div className="text-xs text-gray-500">{c.linkType === 'district' ? tHeading(language as any, 'district') : tHeading(language as any, 'city')} · {getStateName(language as any, 'gujarat', 'Gujarat')}</div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{getStateName(language as any, 'gujarat', 'Gujarat')} — {districtsUnique.length} {tHeading(language as any, 'districts')}</h2>
          <input
            type="text"
            placeholder="Search district..."
            className="border rounded-xl px-4 py-2 w-64"
            onChange={(e) => {
              const q = e.target.value.toLowerCase();
              document.querySelectorAll('[data-district]')?.forEach((el) => {
                const name = (el as HTMLElement).dataset.district || '';
                (el as HTMLElement).style.display = name.includes(q) ? '' : 'none';
              });
            }}
          />
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {districtsUnique.map((d) => {
            const label = getGujaratDistrictName(language as any, d.slug, d.name);
            return (
              <Link key={d.slug} href={`/regional/gujarat/${d.slug}`} className="group block bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition p-5" data-district={(d.name || '').toLowerCase()}>
                <div className="text-3xl mb-2">🗺️</div>
                <div className="font-semibold text-lg group-hover:text-blue-600">{label}</div>
                <div className="text-xs text-gray-500">{tHeading(language as any, 'district')} · {getStateName(language as any, 'gujarat', 'Gujarat')}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
