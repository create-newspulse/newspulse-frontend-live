import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import CategoryHeader from '../../src/components/category/CategoryHeader';

const pushMock = jest.fn(() => Promise.resolve(true));

jest.mock('next/router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('CategoryHeader editorial display', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  test('renders the improved English Editorial header and search placeholder', () => {
    render(
      <CategoryHeader
        categorySlug="editorial"
        title="editorial"
        subtitle="News Feed"
        langPrefix=""
        showSearch
      />
    );

    expect(screen.getByText('Editorial')).toBeTruthy();
    expect(screen.getByText('In-depth Editorials and Special Stories from News Pulse.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search Editorials and Special Stories...')).toBeTruthy();
    expect(screen.queryByText('editorial')).toBeNull();
    expect(screen.queryByText('News Feed')).toBeNull();
    expect(document.body.textContent).not.toContain('📰');
  });

  test.each([
    ['/hi', 'संपादकीय', 'न्यूज़ पल्स के गहन संपादकीय और विशेष लेख।', 'संपादकीय और विशेष लेख खोजें...'],
    ['/gu', 'સંપાદકીય', 'ન્યૂઝ પલ્સના વિશ્લેષણાત્મક સંપાદકીય અને વિશેષ લેખો.', 'સંપાદકીય અને વિશેષ લેખો શોધો...'],
  ] as const)('renders localized %s Editorial header copy', (langPrefix, title, subtitle, placeholder) => {
    render(
      <CategoryHeader
        categorySlug="editorial"
        title="editorial"
        subtitle="News Feed"
        langPrefix={langPrefix}
        showSearch
      />
    );

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(subtitle)).toBeTruthy();
    expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
  });
});