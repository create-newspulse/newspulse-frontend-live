import React from 'react';
import type { CommunitySubmissionCounts } from '../../types/community-reporter';

type Props = {
  counts: CommunitySubmissionCounts;
};

const StatsRow: React.FC<Props> = ({ counts }) => {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800">Total: {counts.total}</span>
      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">Pending: {counts.pending}</span>
      <span className="px-3 py-1 rounded-full bg-green-100 text-green-800">Approved: {counts.approved}</span>
      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">Published: {counts.published}</span>
      <span className="px-3 py-1 rounded-full bg-red-100 text-red-800">Rejected: {counts.rejected}</span>
      <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800">Withdrawn: {counts.withdrawn}</span>
    </div>
  );
};

export default StatsRow;
