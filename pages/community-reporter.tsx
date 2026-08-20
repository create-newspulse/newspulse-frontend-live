import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import React from 'react';
import SubmissionExperience from '../components/community-reporter/SubmissionExperience';
import { getReporterPortalPageServerProps } from '../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../types/community-reporter';

const contactEmail = 'community@newspulse.co.in';
const suggestedSubject = 'Community Report - [City] - [Topic]';

export default function CommunityReporterPage(props: FeatureToggleProps) {
  return (
    <>
      <SubmissionExperience {...props} variant="public" />

      <section className="bg-white px-4 pb-12 text-black dark:bg-dark-primary dark:text-dark-text" aria-label="Community Reporter email fallback">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-semibold">Having trouble submitting online?</h2>
          <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
            The online form is the primary way to send a Community Reporter submission. If it is not working for you, email your report as an alternate method.
          </p>
          <div className="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-100">Email fallback</div>
          <a href={`mailto:${contactEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
            {contactEmail}
          </a>
          <div className="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-100">Suggested subject line</div>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            {suggestedSubject}
          </div>
          <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
            News Pulse will use your submitted details only for verification, editorial communication, and contributor management.
          </p>
          <Link href="/community-reporter/guidelines" className="mt-5 inline-flex text-sm font-semibold text-blue-700 underline">
            Read the full Community Reporter Guide
          </Link>
        </div>
      </section>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;