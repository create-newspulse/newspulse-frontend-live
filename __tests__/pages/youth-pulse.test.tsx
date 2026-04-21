import React from 'react';
import { render, screen } from '@testing-library/react';
import YouthPulsePage from '../../pages/youth-pulse';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}));

jest.mock('../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: (initial: any) => ({
    toggles: initial,
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../features/youthPulse/useYouthPulse', () => ({
  useYouthPulse: () => ({
    topics: [
      { slug: 'youth-pulse', title: 'Youth Pulse', emoji: '🎓', description: 'Youth stories', fromHex: '#000', toHex: '#111' },
    ],
    trending: [
      { id: 1, title: 'Published Youth Story', summary: 'Visible story summary', category: 'youth-pulse', categoryLabel: 'Youth Pulse', image: '/test.jpg', date: 'Today' },
    ],
    error: null,
  }),
}));

jest.mock('../../components/youth/YouthHero', () => ({
  __esModule: true,
  default: ({ submissionsClosed }: { submissionsClosed?: boolean }) => (
    <button type="button" disabled={Boolean(submissionsClosed)}>Submit to Youth Pulse</button>
  ),
}));

jest.mock('../../components/youth/CategoryGrid', () => ({
  __esModule: true,
  default: () => <div>Track browsing</div>,
}));

jest.mock('../../components/youth/FeaturedStories', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <section>{title}</section>,
}));

jest.mock('../../components/youth/SubmitStoryModal', () => ({
  __esModule: true,
  default: () => null,
}));

describe('pages/youth-pulse', () => {
  it('keeps published stories visible while disabling submissions when the Youth Pulse toggle is closed', () => {
    render(
      <YouthPulsePage
        initialFounderToggles={{
          communityReporterClosed: false,
          reporterPortalClosed: false,
          youthPulseSubmissionsClosed: true,
          updatedAt: null,
        }}
      />
    );

    expect(screen.getAllByText('Track browsing').length).toBeGreaterThan(0);
    expect(screen.getByText('Latest from Youth Pulse')).not.toBeNull();
    expect(screen.getByText('Curated Youth Pulse story grid')).not.toBeNull();
    expect(screen.getByText('Youth Pulse submissions are temporarily closed.')).not.toBeNull();

    const buttons = screen.getAllByRole('button', { name: 'Submit to Youth Pulse' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => expect(button.hasAttribute('disabled')).toBe(true));
  });
});