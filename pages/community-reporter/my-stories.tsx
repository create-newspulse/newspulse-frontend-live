import Head from 'next/head';
import React, { useState } from 'react';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { useCommunityStories } from '../../hooks/useCommunityStories';
import type { CommunityStorySummary, FeatureToggleProps } from '../../types/community-reporter';
import MyStoriesHeader from '../../components/community-reporter/MyStoriesHeader';
import StatsRow from '../../components/community-reporter/StatsRow';
import Toast from '../../components/community-reporter/Toast';
import LoadingNote from '../../components/community-reporter/LoadingNote';
import EmptyState from '../../components/community-reporter/EmptyState';
import StoryTable from '../../components/community-reporter/StoryTable';
import ViewModal from '../../components/community-reporter/ViewModal';
import { useI18n } from '../../src/i18n/LanguageProvider';

// Types moved to types/community-reporter.ts

const statusColor = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k === 'draft') return 'bg-gray-100 text-gray-800';
  if (k === 'pending' || k === 'under_review' || k === 'under-review') return 'bg-blue-100 text-blue-800';
  if (k === 'approved') return 'bg-green-100 text-green-800';
  if (k === 'published') return 'bg-emerald-100 text-emerald-800';
  if (k === 'rejected') return 'bg-red-100 text-red-800';
  if (k === 'withdrawn') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-800';
};

// FeatureToggleProps imported from types

const CommunityReporterMyStoriesPage: React.FC<FeatureToggleProps> = ({ communityReporterClosed, reporterPortalClosed }) => {
  const { t } = useI18n();
  const {
    settings,
    settingsLoading,
    reporterEmail,
    stories,
    counts,
    isLoading,
    error,
    hasLoadedOnce,
    loadingId,
    withdraw,
  } = useCommunityStories();
  const [toast, setToast] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<CommunityStorySummary | null>(null);

  const canUsePortal = settings ? (settings.communityReporterEnabled && settings.allowMyStoriesPortal) : false;

  // Hard-close via feature toggle
  if (communityReporterClosed || reporterPortalClosed) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>My Community Stories | News Pulse</title>
        </Head>
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black mb-3">Community Reporter Portal is temporarily closed</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">Temporarily closed. Please check back soon.</p>
            <a href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Back to Community Reporter</a>
          </div>
        </section>
      </div>
    );
  }

  if (settingsLoading && !settings) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text grid place-items-center">
        <p className="text-sm text-gray-700 dark:text-gray-300">Loading settings…</p>
      </div>
    );
  }

  if (settings && (!settings.communityReporterEnabled || !settings.allowMyStoriesPortal)) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>My Community Stories | News Pulse</title>
        </Head>
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black mb-3">My Community Stories is temporarily unavailable</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">My Community Stories is currently unavailable. Please contact News Pulse if you have questions about your submissions.</p>
            <a href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Back to Community Reporter</a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>My Community Stories | News Pulse</title>
        <meta name="description" content="View your submitted community stories on News Pulse." />
      </Head>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <MyStoriesHeader reporterEmail={reporterEmail} />

          <Toast message={toast} />

          {isLoading && <LoadingNote text="Loading your stories…" />}

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          {!error && hasLoadedOnce && stories.length === 0 && (
            <EmptyState text={t('categoryPage.noStoriesYet')} />
          )}

          {stories.length > 0 && (
            <div className="space-y-4">
              <StatsRow counts={counts} />
              <StoryTable
                stories={stories}
                loadingId={loadingId}
                onView={(s) => setSelectedStory(s)}
                onWithdraw={async (s) => {
                  try {
                    if (typeof window !== 'undefined') {
                      const proceed = window.confirm('Are you sure you want to withdraw this story?');
                      if (!proceed) return;
                    }
                    const ok = await withdraw(s);
                    setToast(ok ? 'Story withdrawn successfully.' : 'Could not withdraw this story.');
                  } finally {
                    setTimeout(() => setToast(null), 2500);
                  }
                }}
              />
            </div>
          )}

          {/* View Modal */}
          <ViewModal story={selectedStory} onClose={() => setSelectedStory(null)} />

          <div className="mt-6 flex items-center gap-3">
            <a href="/community-reporter" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Back to Community Reporter</a>
            <Link href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Submit new story</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommunityReporterMyStoriesPage;

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = async ({ locale }) => {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  let communityReporterClosed = false;
  let reporterPortalClosed = false;
  if (base) {
    try {
      const resp = await fetch(`${base}/api/public/feature-toggles`, { headers: { Accept: 'application/json' } });
      const data = await resp.json().catch(() => null as any);
      if (resp.ok && data) {
        communityReporterClosed = Boolean(data.communityReporterClosed);
        reporterPortalClosed = Boolean(data.reporterPortalClosed);
      }
    } catch {}
  }
  const { getMessages } = await import('../../lib/getMessages');
  return { props: { communityReporterClosed, reporterPortalClosed, messages: await getMessages(locale as string) } };
};
