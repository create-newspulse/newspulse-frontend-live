import React from 'react';
import type { CommunityStorySummary } from '../../types/community-reporter';

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

type Props = {
  stories: CommunityStorySummary[];
  loadingId?: string | null;
  onView: (story: CommunityStorySummary) => void;
  onWithdraw: (story: CommunityStorySummary) => Promise<void> | void;
};

const StoryTable: React.FC<Props> = ({ stories, loadingId, onView, onWithdraw }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="py-3 pr-4">Headline</th>
              <th className="py-3 pr-4">Category</th>
              <th className="py-3 pr-4">Location</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Created At</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stories.map((s) => {
              const urgent = String((s as any).priority || (s as any).urgency || '').toLowerCase() === 'high';
              const dtRaw = s.createdAt || (s.submittedAt || '');
              const dt = dtRaw ? new Date(dtRaw) : null;
              const dateStr = (dt && !isNaN(dt.getTime()))
                ? dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Not provided';
              const refId: string = (s.id as any) || (s.referenceId as any) || '';
              const canWithdraw = ['under_review','pending'].includes((s.status || '').toLowerCase());
              return (
                <tr key={refId || s.headline} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 pr-4">
                    <div className="font-medium flex items-center gap-2">
                      <span>{s.headline}</span>
                      {urgent && (
                        <span className="inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-red-600 text-white">Urgent</span>
                      )}
                    </div>
                    {Boolean(refId) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">Ref ID: {refId}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">{s.category}</td>
                  <td className="py-3 pr-4">{[s.city, s.state].filter(Boolean).join(', ') || 'Not provided'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-1 rounded-md ${statusColor(s.status || '')}`}>{s.status}</span>
                  </td>
                  <td className="py-3 pr-4">{dateStr}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => onView(s)} className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white">View</button>
                      {canWithdraw && (
                        <button
                          onClick={() => onWithdraw(s)}
                          disabled={loadingId === refId}
                          className={`text-xs ${loadingId === refId ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:underline'}`}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StoryTable;
