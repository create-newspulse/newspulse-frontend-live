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
  story: CommunityStorySummary | null;
  onClose: () => void;
};

const ViewModal: React.FC<Props> = ({ story, onClose }) => {
  if (!story) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">{story.headline}</h2>
          <span className={`ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(story.status || '')}`}>
            {story.status}
          </span>
        </div>
        <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="mr-2">Category: <span className="font-medium">{story.category}</span></span>
          <span className="mr-2">Location: <span className="font-medium">{[story.city, story.state].filter(Boolean).join(', ') || 'Not provided'}</span></span>
          <span>
            Date: <span className="font-medium">{
              (() => {
                const dtRaw = story.createdAt || story.submittedAt || '';
                const dt = dtRaw ? new Date(dtRaw) : null;
                return (dt && !isNaN(dt.getTime()))
                  ? dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Not provided';
              })()
            }</span>
          </span>
        </div>
        <div className="whitespace-pre-wrap rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-800 dark:text-gray-100">
          {(() => {
            const s: any = story || {};
            const body = s.body || s.text || s.story || s.content || s.details || s.description || s.bodyText || s.fullText;
            return body ? String(body) : story.headline;
          })()}
        </div>
        <div className="mt-4 text-right">
          <button type="button" className="text-sm px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ViewModal;
