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

  test('keeps byline snapshot photo priority with existing nested media asset shapes', () => {
    const metadata = getPulseDialogueMetadata({
      category: 'pulse-dialogue',
      coverImageUrl: '/covers/topic-image.jpg',
      pulseDialogue: {
        contributorId: 'contributor-asset-1',
        bylineSnapshot: {
          name: 'Snapshot Contributor',
          photo: {
            asset: { url: '/contributors/snapshot-asset.jpg', alt: 'Snapshot asset portrait' },
          },
        },
        contributor: {
          name: 'Current Contributor',
          photo: { url: '/contributors/current.jpg', alt: 'Current portrait' },
        },
      },
    });

    expect(metadata).toEqual(expect.objectContaining({
      contributorName: 'Snapshot Contributor',
      contributorPhotoUrl: '/contributors/snapshot-asset.jpg',
      contributorPhotoAlt: 'Snapshot asset portrait',
    }));
  });

  test('falls back to public contributor photo when snapshot photo is absent', () => {
    const metadata = getPulseDialogueMetadata({
      category: 'pulse-dialogue',
      coverImageUrl: '/covers/topic-image.jpg',
      pulseDialogue: {
        contributorId: 'contributor-asset-2',
        bylineSnapshot: {
          name: 'Public Contributor',
          designation: 'Policy Researcher',
        },
        contributor: {
          name: 'Public Contributor',
          photo: {
            image: { secureUrl: '/contributors/public-safe.jpg', altText: 'Public contributor portrait' },
          },
        },
      },
    });

    expect(metadata).toEqual(expect.objectContaining({
      contributorName: 'Public Contributor',
      contributorPhotoUrl: '/contributors/public-safe.jpg',
      contributorPhotoAlt: 'Public contributor portrait',
    }));
  });

  test('does not use article cover media as a contributor photo', () => {
    const metadata = getPulseDialogueMetadata({
      category: 'pulse-dialogue',
      imageUrl: '/covers/story-topic.jpg',
      coverImage: { url: '/covers/story-topic-object.jpg' },
      pulseDialogue: {
        contributorId: 'contributor-no-photo',
        bylineSnapshot: {
          name: 'No Photo Contributor',
          designation: 'Civic Writer',
        },
        contributor: {
          name: 'No Photo Contributor',
        },
      },
    });

    expect(metadata).toEqual(expect.objectContaining({
      contributorName: 'No Photo Contributor',
      contributorPhotoUrl: '',
      contributorPhotoAlt: 'No Photo Contributor',
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