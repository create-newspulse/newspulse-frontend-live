import {
  getPulseDialogueFormatLabel,
  getPulseDialogueMetadata,
  resolvePulseDialogueDisclaimer,
} from '../../lib/pulseDialogue';

const t = (key: string) => ({
  'pulseDialogue.formats.guestColumn': 'Guest Column',
  'pulseDialogue.article.defaultDisclaimer': 'Localized default disclaimer.',
} as Record<string, string>)[key] || key;

describe('pulseDialogue helpers', () => {
  test('returns null for non-Pulse articles and Pulse articles without metadata', () => {
    expect(getPulseDialogueMetadata({ category: 'business', pulseDialogue: { contributorId: 'c-1' } })).toBeNull();
    expect(getPulseDialogueMetadata({ category: 'pulse-dialogue' })).toBeNull();
  });

  test('prefers byline snapshot attribution while keeping public contributor biography', () => {
    const metadata = getPulseDialogueMetadata({
      category: 'pulse-dialogue',
      authorName: 'News Pulse Staff',
      pulseDialogue: {
        contributorId: 'contributor-1',
        dialogueFormat: 'guest_column',
        series: 'Civic Lens',
        bylineDesignationOverride: 'Override Role',
        bylineSnapshot: {
          name: 'Snapshot Contributor',
          designation: 'Snapshot Role',
          affiliation: 'Snapshot Institute',
          photo: { url: '/contributors/snapshot.jpg', alt: 'Snapshot portrait' },
        },
        contributor: {
          id: 'contributor-1',
          name: 'Current Contributor',
          canonicalName: 'Canonical Contributor',
          photo: { url: '/contributors/current.jpg', alt: 'Current portrait' },
          publicDesignation: 'Current Role',
          affiliation: 'Current Institute',
          shortBio: 'Public contributor biography.',
        },
        showAboutContributor: true,
      },
    });

    expect(metadata).toEqual(expect.objectContaining({
      contributorId: 'contributor-1',
      dialogueFormat: 'guest_column',
      series: 'Civic Lens',
      contributorName: 'Snapshot Contributor',
      contributorDesignation: 'Snapshot Role',
      contributorAffiliation: 'Snapshot Institute',
      contributorPhotoUrl: '/contributors/snapshot.jpg',
      contributorPhotoAlt: 'Snapshot portrait',
      contributorShortBio: 'Public contributor biography.',
      showAboutContributor: true,
    }));
  });

  test('localizes known format labels and falls back safely', () => {
    expect(getPulseDialogueFormatLabel('guest_column', t)).toBe('Guest Column');
    expect(getPulseDialogueFormatLabel('open_letter')).toBe('Open Letter');
    expect(getPulseDialogueFormatLabel('unknown_format', t)).toBe('');
  });

  test('resolves absent, default, and custom disclaimer text', () => {
    expect(resolvePulseDialogueDisclaimer('', t)).toBe('');
    expect(resolvePulseDialogueDisclaimer('true', t)).toBe('Localized default disclaimer.');
    expect(resolvePulseDialogueDisclaimer('The views expressed in this contribution are those of the author and do not necessarily represent the editorial position of News Pulse.', t)).toBe('Localized default disclaimer.');
    expect(resolvePulseDialogueDisclaimer('Custom contributor disclaimer.', t)).toBe('Custom contributor disclaimer.');
  });
});