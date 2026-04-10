import React from 'react';
import Link from 'next/link';
import type { ReporterProfileSummary } from '../../hooks/useCommunityStories';
import { getReporterDisplayName } from '../../lib/reporterPortal';

type Props = {
  title?: string;
  reporterEmail?: string | null;
  reporterProfile?: ReporterProfileSummary | null;
  profileWarning?: string | null;
};

const MyStoriesHeader: React.FC<Props> = ({ title = 'My Community Stories', reporterEmail, reporterProfile, profileWarning }) => {
  const email = String((reporterEmail || reporterProfile?.email || '')).trim();
  const displayName = getReporterDisplayName({
    fullName: reporterProfile?.fullName,
    name: reporterProfile?.name,
    firstName: reporterProfile?.firstName,
    email,
  }, 'Not provided');
  const phone = String((reporterProfile?.phone || '')).trim();
  const whatsapp = String((reporterProfile?.whatsapp || '')).trim();
  const location = [reporterProfile?.city, reporterProfile?.district, reporterProfile?.state, reporterProfile?.country]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(', ');
  const contactIncomplete = Boolean(email) && !phone && !whatsapp;

  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-3xl font-black mb-1">{title}</h1>
        {email ? (
          <p className="text-xs text-gray-500">
            Using Email: <span className="font-medium">{email}</span>
          </p>
        ) : null}

        {profileWarning === 'REPORTER_PROFILE_UNAVAILABLE' ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Reporter profile unavailable right now. You can still view your submission records.
          </div>
        ) : null}

        {contactIncomplete ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Contact details incomplete. Add a phone number or WhatsApp on the submission form for editor follow-up.
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
          <div className="font-semibold text-gray-900 dark:text-gray-100">Reporter details</div>
          <div className="mt-1 grid gap-1">
            <div><span className="font-medium">Name:</span> {displayName}</div>
            <div><span className="font-medium">Email:</span> {email || 'Not provided'}</div>
            <div><span className="font-medium">Phone:</span> {phone || 'Not provided'}</div>
            <div><span className="font-medium">WhatsApp:</span> {whatsapp || 'Not provided'}</div>
            <div><span className="font-medium">Location:</span> {location || 'Not provided'}</div>
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          This page shows your community submission records.
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          You can withdraw a submission only while it is under review.
          Published NewsPulse articles are managed separately by the editorial team.
          Withdrawing a submission record does not automatically remove a live article already published on NewsPulse.
        </p>
      </div>
      <Link href="/community-reporter" className="text-sm px-4 py-2 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800">+ Submit new story</Link>
    </div>
  );
};

export default MyStoriesHeader;
