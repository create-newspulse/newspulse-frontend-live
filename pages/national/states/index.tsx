import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

import { INDIA_STATES_UT } from '../../../src/data/indiaStatesUT';

export default function NationalStatesDirectoryPage() {
  const router = useRouter();

  // With Next.js i18n + Pages Router, `router.locale` auto-prefixes links when using <Link />.
  // We keep hrefs locale-agnostic here.
  const states = React.useMemo(
    () => INDIA_STATES_UT.filter((x) => x.type === 'state'),
    []
  );
  const uts = React.useMemo(() => INDIA_STATES_UT.filter((x) => x.type === 'ut'), []);

  const title = 'National — States & UTs';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600 mt-1">
              Pick a State/UT to view national stories filtered by region.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/national')}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
          >
            Back to National
          </button>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">States</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {states.map((item) => (
              <Link
                key={item.slug}
                href={`/national/states/${item.slug}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <div className="text-gray-900 font-medium">{item.name}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Union Territories</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {uts.map((item) => (
              <Link
                key={item.slug}
                href={`/national/states/${item.slug}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <div className="text-gray-900 font-medium">{item.name}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
