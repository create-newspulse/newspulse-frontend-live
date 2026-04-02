import React, { useEffect, useRef, useState } from 'react';

import {
  submitYouthPulseStory,
  YOUTH_PULSE_TRACK_OPTIONS,
  type YouthPulseTrackSlug,
} from '../../src/lib/communityReporterApi';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SubmitStoryModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [headline, setHeadline] = useState('');
  const [track, setTrack] = useState<YouthPulseTrackSlug>('youth-pulse');
  const [story, setStory] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      // Pull last saved draft
      const draft = localStorage.getItem('youth-story-draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setName(parsed.name || '');
          setCollege(parsed.college || '');
          setHeadline(parsed.headline || '');
          setTrack(parsed.track || 'youth-pulse');
          setStory(parsed.story || '');
        } catch {}
      }
      setSaved(null);
      setSubmitError(null);
      setIsSubmitting(false);
      setTimeout(() => dialogRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitYouthPulseStory({
        reporterName: name.trim(),
        college: college.trim(),
        headline: headline.trim(),
        story: story.trim(),
        track,
      });

      if (!result.ok) {
        setSubmitError('We could not send your story to the Youth Pulse Desk right now. Please try again in a moment.');
        return;
      }

      localStorage.setItem(
        'youth-story-last',
        JSON.stringify({
          name: name.trim(),
          college: college.trim(),
          headline: headline.trim(),
          track,
          story: story.trim(),
          referenceId: result.referenceId,
          status: result.status,
          createdAt: new Date().toISOString(),
        })
      );
      localStorage.removeItem('youth-story-draft');
      setSaved(name.trim() || 'Friend');
      setName('');
      setCollege('');
      setHeadline('');
      setTrack('youth-pulse');
      setStory('');
    } catch {
      setSubmitError('We could not send your story to the Youth Pulse Desk right now. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDraft = () => {
    localStorage.setItem('youth-story-draft', JSON.stringify({ name, college, headline, track, story }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">📝 Submit Your Story</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Share your campus achievement, club project, or exam hack.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✖
          </button>
        </div>

        {saved ? (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-200">
            <p className="font-semibold">Thanks, {saved}! 🎉</p>
            <p className="mt-1 text-sm">
              Your story has been sent to the Youth Pulse Desk for review. It will not be published automatically.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md bg-indigo-600 text-white px-4 py-2">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {submitError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                {submitError}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={onDraft}
                required
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">College</label>
              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                onBlur={onDraft}
                required
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Track</label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as YouthPulseTrackSlug)}
                onBlur={onDraft}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {YOUTH_PULSE_TRACK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onBlur={onDraft}
                required
                maxLength={150}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Your Story</label>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onBlur={onDraft}
                required
                rows={5}
                className="mt-1 w-full resize-y rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
