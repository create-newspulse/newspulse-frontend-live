import React from 'react';
import Link from 'next/link';

type Props = {
  title?: string;
  reporterEmail?: string | null;
};

const MyStoriesHeader: React.FC<Props> = ({ title = 'My Community Stories', reporterEmail }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-3xl font-black mb-1">{title}</h1>
        {reporterEmail && (
          <p className="text-xs text-gray-500">
            Using Email: <span className="font-medium">{reporterEmail}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          You can withdraw a story only while it is under review. Once approved or published, withdrawal is handled by the editorial team.
        </p>
      </div>
      <Link href="/community-reporter" className="text-sm px-4 py-2 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800">+ Submit new story</Link>
    </div>
  );
};

export default MyStoriesHeader;
