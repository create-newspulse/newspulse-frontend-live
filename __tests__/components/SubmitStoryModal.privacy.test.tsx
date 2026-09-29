import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SubmitStoryModal from '../../components/youth/SubmitStoryModal';
import { submitYouthPulseStory } from '../../src/lib/communityReporterApi';

jest.mock('../../src/lib/communityReporterApi', () => ({ ...jest.requireActual('../../src/lib/communityReporterApi'), submitYouthPulseStory: jest.fn() }));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (submitYouthPulseStory as jest.Mock).mockResolvedValue({ ok: true, referenceId: 'fixture-reference', status: 'Under review' });
});

test('removes the unused legacy submitted-form copy without touching other storage', () => {
  localStorage.setItem('youth-story-last', JSON.stringify({ email: 'fixture@example.invalid', story: 'Private fixture story' }));
  localStorage.setItem('theme', 'light');

  render(<SubmitStoryModal open onClose={() => {}} />);

  expect(localStorage.getItem('youth-story-last')).toBeNull();
  expect(localStorage.getItem('theme')).toBe('light');
  expect(screen.getByRole('dialog')).toBeTruthy();
});

test('preserves draft restoration and normal submission without persisting a submitted copy', async () => {
  localStorage.setItem('youth-story-draft', JSON.stringify({ fullName: 'Test User', email: 'fixture@example.invalid', headline: 'Fixture headline', story: 'Private fixture story' }));
  const { container } = render(<SubmitStoryModal open onClose={() => {}} />);
  expect(screen.getByDisplayValue('fixture@example.invalid')).toBeTruthy();

  fireEvent.submit(container.querySelector('form') as HTMLFormElement);

  expect(await screen.findByText('Thank you. Your Youth Pulse submission has been received for review.')).toBeTruthy();
  expect(submitYouthPulseStory).toHaveBeenCalledWith(expect.objectContaining({ reporterEmail: 'fixture@example.invalid', story: 'Private fixture story' }));
  expect(localStorage.getItem('youth-story-last')).toBeNull();
  expect(localStorage.getItem('youth-story-draft')).toBeNull();
});