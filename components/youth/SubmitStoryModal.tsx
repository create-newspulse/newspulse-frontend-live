import React, { useEffect, useRef, useState } from 'react';

import {
  submitYouthPulseStory,
  YOUTH_PULSE_TRACK_OPTIONS,
  YOUTH_PULSE_STORY_SOURCE_OPTIONS,
  YOUTH_PULSE_SUBMISSION_TYPE_OPTIONS,
  type YouthPulseStorySource,
  type YouthPulseSubmissionType,
  type YouthPulseTrackSlug,
} from '../../src/lib/communityReporterApi';

type Props = {
  open: boolean;
  onClose: () => void;
};

type FormState = {
  fullName: string;
  email: string;
  mobileNumber: string;
  college: string;
  city: string;
  state: string;
  track: YouthPulseTrackSlug;
  submissionType: YouthPulseSubmissionType;
  headline: string;
  story: string;
  storySource: YouthPulseStorySource;
  supportingLink: string;
  attachmentLink: string;
  truthfulnessConfirmed: boolean;
  rightsConfirmed: boolean;
  reviewAcknowledged: boolean;
  safetyConfirmed: boolean;
};

const INITIAL_FORM: FormState = {
  fullName: '',
  email: '',
  mobileNumber: '',
  college: '',
  city: '',
  state: '',
  track: 'youth-pulse',
  submissionType: 'reported-story',
  headline: '',
  story: '',
  storySource: 'first-hand',
  supportingLink: '',
  attachmentLink: '',
  truthfulnessConfirmed: false,
  rightsConfirmed: false,
  reviewAcknowledged: false,
  safetyConfirmed: false,
};

export default function SubmitStoryModal({ open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

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
      const draft = localStorage.getItem('youth-story-draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setForm({
            ...INITIAL_FORM,
            ...parsed,
            track: parsed.track || 'youth-pulse',
            submissionType: parsed.submissionType || 'reported-story',
            storySource: parsed.storySource || 'first-hand',
          });
        } catch {}
      } else {
        setForm(INITIAL_FORM);
      }
      setSaved(null);
      setSubmitError(null);
      setIsSubmitting(false);
      setTimeout(() => dialogRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || saved) return;
    localStorage.setItem('youth-story-draft', JSON.stringify(form));
  }, [form, open, saved]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitYouthPulseStory({
        reporterName: form.fullName.trim(),
        reporterEmail: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        college: form.college.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        headline: form.headline.trim(),
        story: form.story.trim(),
        track: form.track,
        submissionType: form.submissionType,
        storySource: form.storySource,
        supportingLink: form.supportingLink.trim(),
        attachmentLink: form.attachmentLink.trim(),
        truthfulnessConfirmed: form.truthfulnessConfirmed,
        rightsConfirmed: form.rightsConfirmed,
        reviewAcknowledged: form.reviewAcknowledged,
        safetyConfirmed: form.safetyConfirmed,
      });

      if (!result.ok) {
        setSubmitError('We could not send your submission for review right now. Please try again in a moment.');
        return;
      }

      localStorage.setItem(
        'youth-story-last',
        JSON.stringify({
          ...form,
          referenceId: result.referenceId,
          status: result.status,
          createdAt: new Date().toISOString(),
        })
      );
      localStorage.removeItem('youth-story-draft');
      setSaved(form.fullName.trim() || 'Friend');
      setForm(INITIAL_FORM);
    } catch {
      setSubmitError('We could not send your submission for review right now. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
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
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">Submit to Youth Pulse</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Send a story, tip, or first-person account to the News Pulse Youth Pulse desk.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Submissions are reviewed by News Pulse before publication.
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
            <p className="font-semibold">Thanks, {saved}.</p>
            <p className="mt-1 text-sm">
              Thanks. Your submission has been received for review.
            </p>
            <p className="mt-2 text-sm">
              The Youth Pulse desk reviews all submissions before publication. News Pulse may edit, reject, or decide not to publish a submission.
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
            <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h4 className="text-base font-semibold">Identity</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  This information is used for the News Pulse review process and is not shown publicly.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Mobile Number</label>
                  <input
                    type="tel"
                    value={form.mobileNumber}
                    onChange={(e) => updateField('mobileNumber', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">College / Institution</label>
                  <input
                    type="text"
                    value={form.college}
                    onChange={(e) => updateField('college', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h4 className="text-base font-semibold">Submission</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Share enough detail for the Youth Pulse desk to verify and review the story.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Track</label>
                  <select
                    value={form.track}
                    onChange={(e) => updateField('track', e.target.value as YouthPulseTrackSlug)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {YOUTH_PULSE_TRACK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Submission Type</label>
                  <select
                    value={form.submissionType}
                    onChange={(e) => updateField('submissionType', e.target.value as YouthPulseSubmissionType)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {YOUTH_PULSE_SUBMISSION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Headline</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => updateField('headline', e.target.value)}
                  required
                  maxLength={150}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Your Story</label>
                <textarea
                  value={form.story}
                  onChange={(e) => updateField('story', e.target.value)}
                  required
                  rows={6}
                  className="mt-1 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Is this first-hand or reported?</label>
                  <select
                    value={form.storySource}
                    onChange={(e) => updateField('storySource', e.target.value as YouthPulseStorySource)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {YOUTH_PULSE_STORY_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Optional supporting link</label>
                  <input
                    type="url"
                    value={form.supportingLink}
                    onChange={(e) => updateField('supportingLink', e.target.value)}
                    placeholder="https://"
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Optional attachment or document link</label>
                <input
                  type="url"
                  value={form.attachmentLink}
                  onChange={(e) => updateField('attachmentLink', e.target.value)}
                  placeholder="https://"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h4 className="text-base font-semibold">Required confirmations</h4>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.truthfulnessConfirmed}
                  onChange={(e) => updateField('truthfulnessConfirmed', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I confirm this submission is truthful to the best of my knowledge</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.rightsConfirmed}
                  onChange={(e) => updateField('rightsConfirmed', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I have the right to share this content</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.reviewAcknowledged}
                  onChange={(e) => updateField('reviewAcknowledged', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I understand News Pulse may edit, reject, or not publish this submission</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.safetyConfirmed}
                  onChange={(e) => updateField('safetyConfirmed', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I confirm this content is not false, abusive, hateful, defamatory, or unsafe</span>
              </label>
            </section>

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
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
