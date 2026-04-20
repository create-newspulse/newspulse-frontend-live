import React, { useEffect, useRef, useState } from 'react';

import {
  submitYouthPulseStory,
  YOUTH_PULSE_TRACK_OPTIONS,
  type YouthPulseStorySource,
  type YouthPulseSubmissionType,
  type YouthPulseTrackSlug,
} from '../../src/lib/communityReporterApi';

type Props = {
  open: boolean;
  onClose: () => void;
};

type SubmissionTypeChoice =
  | 'campus-story'
  | 'exam-update'
  | 'career-tip'
  | 'achievement-story'
  | 'student-opinion'
  | 'other';

type StorySourceChoice = 'experienced-directly' | 'witnessed' | 'reported-or-collected';

const SUBMISSION_TYPE_CHOICES: Array<{ value: SubmissionTypeChoice; label: string; payload: YouthPulseSubmissionType }> = [
  { value: 'campus-story', label: 'Campus Story', payload: 'campus-event' },
  { value: 'exam-update', label: 'Exam Update', payload: 'exam-career-update' },
  { value: 'career-tip', label: 'Career Tip', payload: 'exam-career-update' },
  { value: 'achievement-story', label: 'Achievement Story', payload: 'achievement-spotlight' },
  { value: 'student-opinion', label: 'Student Opinion', payload: 'student-voice' },
  { value: 'other', label: 'Other', payload: 'reported-story' },
];

const STORY_SOURCE_CHOICES: Array<{ value: StorySourceChoice; label: string; payload: YouthPulseStorySource }> = [
  { value: 'experienced-directly', label: 'I experienced this directly', payload: 'first-hand' },
  { value: 'witnessed', label: 'I witnessed this', payload: 'first-hand' },
  { value: 'reported-or-collected', label: 'I am sharing a reported or collected story', payload: 'reported' },
];

function toSubmissionTypeChoice(value?: string): SubmissionTypeChoice {
  switch (value) {
    case 'campus-story':
    case 'campus-event':
      return 'campus-story';
    case 'achievement-story':
    case 'achievement-spotlight':
      return 'achievement-story';
    case 'student-opinion':
    case 'student-voice':
      return 'student-opinion';
    case 'career-tip':
      return 'career-tip';
    case 'exam-update':
    case 'exam-career-update':
      return 'exam-update';
    case 'other':
    case 'reported-story':
      return 'other';
    default:
      return 'campus-story';
  }
}

function toStorySourceChoice(value?: string): StorySourceChoice {
  switch (value) {
    case 'reported-or-collected':
    case 'reported':
      return 'reported-or-collected';
    case 'witnessed':
      return 'witnessed';
    case 'experienced-directly':
      return 'experienced-directly';
    case 'first-hand':
    default:
      return 'experienced-directly';
  }
}

function toSubmissionTypePayload(value: SubmissionTypeChoice): YouthPulseSubmissionType {
  return SUBMISSION_TYPE_CHOICES.find((option) => option.value === value)?.payload || 'reported-story';
}

function toStorySourcePayload(value: StorySourceChoice): YouthPulseStorySource {
  return STORY_SOURCE_CHOICES.find((option) => option.value === value)?.payload || 'first-hand';
}

type FormState = {
  fullName: string;
  email: string;
  mobileNumber: string;
  college: string;
  city: string;
  state: string;
  track: YouthPulseTrackSlug;
  submissionType: SubmissionTypeChoice;
  headline: string;
  story: string;
  storySource: StorySourceChoice;
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
  submissionType: 'campus-story',
  headline: '',
  story: '',
  storySource: 'experienced-directly',
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
            submissionType: toSubmissionTypeChoice(parsed.submissionType),
            storySource: toStorySourceChoice(parsed.storySource),
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
        submissionType: toSubmissionTypePayload(form.submissionType),
        storySource: toStorySourcePayload(form.storySource),
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
              Share a story, update, opinion, or achievement with the News Pulse review desk.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Submissions are reviewed by News Pulse before publication. Public readers see only approved published stories.
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
            <p className="font-semibold">Thank you.</p>
            <p className="mt-1 text-sm">
              Thank you. Your Youth Pulse submission has been received for review.
            </p>
            <p className="mt-2 text-sm">
              The News Pulse team may contact you if more details are needed.
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
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Enter your real name so the News Pulse review desk can identify your submission.
                  </p>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email Address</label>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    We will use this only if we need to contact you about your story.
                  </p>
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
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Optional, but helpful if our team needs to verify details quickly.
                  </p>
                  <input
                    type="tel"
                    value={form.mobileNumber}
                    onChange={(e) => updateField('mobileNumber', e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">College / Institution</label>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Enter your school, college, coaching institute, or organization name.
                  </p>
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
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Enter the city connected to your story or where you study.
                  </p>
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
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Enter your state for regional context.
                  </p>
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
                  Explain your story clearly so the News Pulse team can review it properly.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Track</label>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Choose the Youth Pulse section that best matches your story.
                  </p>
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
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Choose what kind of story you are sending.
                  </p>
                  <select
                    value={form.submissionType}
                    onChange={(e) => updateField('submissionType', e.target.value as SubmissionTypeChoice)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {SUBMISSION_TYPE_CHOICES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Headline</label>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Write a short title for your story.
                </p>
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
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Explain what happened, why it matters, and any useful details we should know.
                </p>
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
                  <label className="block text-sm font-medium">How do you know about this?</label>
                  <select
                    value={form.storySource}
                    onChange={(e) => updateField('storySource', e.target.value as StorySourceChoice)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {STORY_SOURCE_CHOICES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
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
                <span>I confirm I have the right to share this content</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.reviewAcknowledged}
                  onChange={(e) => updateField('reviewAcknowledged', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I understand News Pulse may edit, review, reject, or not publish this submission</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.safetyConfirmed}
                  onChange={(e) => updateField('safetyConfirmed', e.target.checked)}
                  required
                  className="mt-1"
                />
                <span>I confirm this submission does not contain false, abusive, hateful, defamatory, or unsafe content</span>
              </label>
            </section>

            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Submissions are reviewed by News Pulse before publication. Public readers see only approved published stories.
            </p>

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
