import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import HomepageSponsoredFeatureCard from '../../components/home/HomepageSponsoredFeatureCard';
import { normalizeHomepageSponsoredFeature } from '../../lib/publicSponsoredFeature';
import { resolveSponsoredContentMeta } from '../../lib/sponsoredContent';

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(cleanup);

const candidate = {
  active: true, sponsorName: 'Fixture Sponsor', headline: 'Sponsored fixture',
  shortSummary: 'Sponsor feature summary', ctaLabel: 'Read sponsored story',
  imageSrc: '/images/placeholder-16x9.svg', sponsorDisclosure: 'Paid fixture disclosure.',
  destinationUrl: 'https://sponsor.test/information',
};

test.each(['en', 'hi', 'gu'] as const)('%s Sponsored Combo retains its placement, canonical article link and disclosure', (lang) => {
  const slug = `sponsored-${lang}`;
  const feature = normalizeHomepageSponsoredFeature({
    feature: { ...candidate, linkedSponsoredArticleId: 'sponsored-id', linkedArticleSlug: slug },
  }, lang);
  expect(feature).not.toBeNull();
  if (!feature) throw new Error('Missing sponsored fixture');
  render(<HomepageSponsoredFeatureCard theme={{}} feature={feature} />);
  expect(screen.getByText('Sponsored Feature')).toBeTruthy();
  expect(screen.getByText('Partner')).toBeTruthy();
  expect(screen.getByText(candidate.sponsorDisclosure)).toBeTruthy();
  expect(screen.getByRole('link').getAttribute('href')).toBe(`${lang === 'en' ? '' : `/${lang}`}/news/${slug}`);
  expect(screen.getByRole('link').getAttribute('target')).toBeNull();

  const meta = resolveSponsoredContentMeta({
    _id: 'sponsored-id', slug, language: lang, isSponsoredArticle: true,
    sponsorName: candidate.sponsorName, sponsorDisclosure: candidate.sponsorDisclosure,
    sponsorFeatureLinkedId: 'feature-1',
    linkedSponsoredFeature: {
      id: 'feature-1', linkedArticleId: 'sponsored-id', linkedArticleSlug: slug,
      destinationUrl: candidate.destinationUrl, ctaText: 'Visit sponsor website',
    },
  }, lang);
  expect(meta.isArticle).toBe(true);
  expect(meta.sponsorDisclosure).toBe(candidate.sponsorDisclosure);
  expect(meta.sponsorDestinationHref).toBe(candidate.destinationUrl);
  expect(meta.destinationHref).toBe(feature.href);
});

test('a standalone Sponsored Feature keeps its external destination and advertising link attributes', () => {
  const feature = normalizeHomepageSponsoredFeature({ feature: candidate }, 'en');
  if (!feature) throw new Error('Missing sponsored fixture');
  render(<HomepageSponsoredFeatureCard theme={{}} feature={feature} />);
  expect(screen.getByRole('link').getAttribute('href')).toBe(candidate.destinationUrl);
  expect(screen.getByRole('link').getAttribute('target')).toBe('_blank');
  expect(screen.getByRole('link').getAttribute('rel')).toBe('sponsored noopener noreferrer');
});

test.each(['paused', 'expired', 'draft'])('%s sponsored placements remain hidden under the existing visibility contract', (status) => {
  expect(normalizeHomepageSponsoredFeature({
    feature: { ...candidate, active: undefined, status },
  }, 'en')).toBeNull();
});
