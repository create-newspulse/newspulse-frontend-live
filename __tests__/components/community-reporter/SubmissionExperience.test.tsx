import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubmissionExperience from '../../../components/community-reporter/SubmissionExperience';

const push = jest.fn();
let reporterSession: { email: string } | null = null;

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/community-reporter', push, replace: jest.fn() }),
}));

jest.mock('../../../src/hooks/useCommunityReporterConfig', () => ({
  useCommunityReporterConfig: () => ({ config: { communityMyStoriesEnabled: true }, isLoading: false, error: null }),
}));

jest.mock('../../../utils/PublicModeProvider', () => ({
  usePublicMode: () => ({
    mode: 'NORMAL',
    readOnly: false,
    externalFetch: true,
    isLockdown: false,
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({
    toggles: {
      communityReporterClosed: false,
      reporterPortalClosed: false,
      youthPulseSubmissionsClosed: false,
      viralVideosFrontendEnabled: true,
      updatedAt: null,
    },
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useReporterPortalSession', () => ({
  useReporterPortalSession: () => ({
    session: reporterSession,
    reporter: reporterSession,
    authenticated: Boolean(reporterSession),
    isReady: true,
    loading: false,
    status: reporterSession ? 'authenticated' : 'anonymous',
    reason: null,
    logout: jest.fn(),
  }),
}));

describe('SubmissionExperience', () => {
  let submissionResponse: any;

  beforeEach(() => {
    push.mockClear();
    reporterSession = null;
    window.localStorage.clear();
    submissionResponse = {
      ok: false,
      status: 400,
      json: async () => ({ ok: false, message: 'Please choose a valid category.', code: 'VALIDATION_ERROR' }),
    };
    (global as any).fetch = jest.fn((url: string) => {
      if (String(url).includes('/api/public/community/settings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            settings: {
              communityReporterEnabled: true,
              allowNewSubmissions: true,
              allowMyStoriesPortal: true,
              allowJournalistApplications: true,
            },
          }),
        });
      }

      if (url === '/api/community/submissions') {
        return Promise.resolve(submissionResponse);
      }

      if (url === '/api/reporter-auth/session') {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    });
  });

  async function openStoryStep() {
    render(<SubmissionExperience communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Full name *'), { target: { value: 'Kiran Parmar' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'kiran@example.com' } });
    fireEvent.click(screen.getByLabelText(/I agree not to submit fake or unlawful stories/i));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByLabelText('Category *');
  }

  function fillValidStory(ageGroup = '41_plus') {
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'regional' } });
    fireEvent.click(screen.getByLabelText('Regional'));
    fireEvent.change(screen.getByLabelText('Headline *'), { target: { value: 'Local civic issue needs review' } });
    fireEvent.change(screen.getByLabelText('Story *'), {
      target: { value: 'This is a sufficiently detailed local public interest story for the editorial review workflow.' },
    });
    fireEvent.change(screen.getByLabelText('Age group *'), { target: { value: ageGroup } });
  }

  async function submitValidStory(ageGroup = '41_plus') {
    await openStoryStep();
    fillValidStory(ageGroup);
    fireEvent.submit(screen.getByRole('button', { name: 'Submit Story' }).closest('form') as HTMLFormElement);
  }

  function communitySubmissionPosts() {
    return (global as any).fetch.mock.calls.filter(
      ([url, init]: [string, RequestInit | undefined]) => url === '/api/community/submissions' && init?.method === 'POST',
    );
  }

  it('renders deterministic age group values without mojibake text', async () => {
    await openStoryStep();

    const options = Array.from((screen.getByLabelText('Age group *') as HTMLSelectElement).options).map((option) => ({
      value: option.value,
      label: option.textContent,
    }));

    expect(options).toEqual([
      { value: '', label: 'Select age group' },
      { value: 'under_18', label: 'Under 18' },
      { value: '18_24', label: '18–24' },
      { value: '25_40', label: '25–40' },
      { value: '41_plus', label: '41+' },
    ]);
    expect(document.body.textContent).not.toMatch(/[âÃÂ]/);
  });

  it('links to the full guide and clarifies professional journalist submissions', async () => {
    render(<SubmissionExperience communityReporterClosed={false} reporterPortalClosed={false} />);

    expect((await screen.findByRole('link', { name: 'Read the full Community Reporter Guide' })).getAttribute('href')).toBe('/community-reporter/guidelines');

    fireEvent.click(screen.getByLabelText('I am a Professional Journalist / Media Person'));

    expect(screen.getByText(/Professional journalists may submit information here/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Visit Journalist Desk' }).getAttribute('href')).toBe('/journalist-desk');
  });

  it('keeps the public form usable after SESSION_EXPIRED and does not get stuck after a 400 response', async () => {
    await submitValidStory('41_plus');

    expect(await screen.findByText('Please choose a valid category.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Story' })).toBeTruthy());
    expect(screen.queryByText(/Submitting/i)).toBeNull();

    expect(communitySubmissionPosts()).toHaveLength(1);
    const body = JSON.parse(communitySubmissionPosts()[0][1].body as string);
    expect(body.ageGroup).toBe('41_plus');
    expect(body.category).toBe('regional');
    expect(body.coverageScope).toBe('regional');

    const sessionCalls = (global as any).fetch.mock.calls.filter(([url]: [string]) => url === '/api/reporter-auth/session');
    expect(sessionCalls).toHaveLength(0);
  });

  it('resets submitting state after a 500 response with a public-safe error', async () => {
    submissionResponse = {
      ok: false,
      status: 500,
      json: async () => ({ ok: false, message: 'AxiosError: upstream stack', stack: 'trace' }),
    };

    await submitValidStory('25_40');

    expect(await screen.findByText("We couldn't submit your story right now. Please try again.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Story' })).toBeTruthy());
    expect(screen.queryByText(/Submitting/i)).toBeNull();
    expect(communitySubmissionPosts()).toHaveLength(1);
  });

  it('shows success after a valid response and resets the button label', async () => {
    submissionResponse = {
      ok: true,
      status: 201,
      json: async () => ({ ok: true, referenceId: 'story-123', status: 'Under review', reporterType: 'community' }),
    };

    await submitValidStory('under_18');

    expect(await screen.findByText('Thank you. Your story has been submitted to News Pulse for review.')).toBeTruthy();
    expect(screen.getByText('Your reference ID: story-123')).toBeTruthy();
    expect(screen.getByText('Want to track future submissions? Sign in to the Reporter Portal.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Track your submissions' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Story' })).toBeTruthy());
    expect(screen.queryByText(/Submitting/i)).toBeNull();
    expect(communitySubmissionPosts()).toHaveLength(1);
  });

  it('shows Track your submissions after an authenticated community submission', async () => {
    reporterSession = { email: 'reporter@example.com' };
    submissionResponse = {
      ok: true,
      status: 201,
      json: async () => ({ ok: true, referenceId: 'story-456', status: 'Under review', reporterType: 'community' }),
    };

    await submitValidStory('18_24');

    expect(await screen.findByText('Thank you. Your story has been submitted to News Pulse for review.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Track your submissions' })).toBeTruthy();
    expect(screen.queryByText('Want to track future submissions? Sign in to the Reporter Portal.')).toBeNull();

    const body = JSON.parse(communitySubmissionPosts()[0][1].body as string);
    expect(body.reporterAccountId).toBe('reporter@example.com');
  });
});
