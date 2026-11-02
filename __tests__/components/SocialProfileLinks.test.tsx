import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Globe } from 'lucide-react';

import SocialProfileLinks from '../../components/SocialProfileLinks';
import * as socialProfiles from '../../src/config/socialProfiles';
import { getMessagesForLang, LanguageProvider } from '../../src/i18n/LanguageProvider';

const approvedProfiles = socialProfiles.SOCIAL_PROFILES;
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider initialLang="en">{children}</LanguageProvider>;

afterEach(() => { jest.restoreAllMocks(); });

test('the shared configuration contains exactly the four enabled Founder-approved profiles', () => {
  expect(approvedProfiles.map(({ id, label, url, enabled }) => ({ id, label, url, enabled }))).toEqual([
    { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@NewsPulse-Official', enabled: true },
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/newspulse.co.in/', enabled: true },
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61594207143478', enabled: true },
    { id: 'x', label: 'X', url: 'https://x.com/newspulse_co_in', enabled: true },
  ]);
  expect(new Set(approvedProfiles.map(profile => profile.id)).size).toBe(4);
  expect(new Set(approvedProfiles.map(profile => profile.url)).size).toBe(4);
});

describe.each(['card', 'footer'] as const)('%s social links', variant => {
  test.each(['en', 'hi', 'gu'] as const)('%s renders accessible, keyboard-focusable native external links with exact URLs', lang => {
    const messages = getMessagesForLang(lang);
    const { container } = render(<LanguageProvider initialLang={lang}><SocialProfileLinks variant={variant} /></LanguageProvider>);

    expect(screen.getByRole('region', { name: messages.social.followTitle })).toBeTruthy();
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(approvedProfiles.map(profile => profile.url));
    for (const profile of approvedProfiles) {
      const label = messages.social.followOn.replace('{{platform}}', profile.label);
      const link = screen.getByRole('link', { name: label });
      expect(link.getAttribute('href')).toBe(profile.url);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('title')).toBe(label);
      expect(link.tabIndex).toBe(0);
      link.focus();
      expect(document.activeElement).toBe(link);
      expect(fireEvent.click(link)).toBe(true);
      expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(link.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    }
    expect(container.querySelector('button, iframe, script, img, video')).toBeNull();
    expect(container.textContent).not.toMatch(/social\.|{{/);
    if (variant === 'card') {
      expect(screen.getByRole('heading', { name: messages.social.followTitle })).toBeTruthy();
      expect(container.querySelectorAll('a span')).toHaveLength(4);
    } else {
      expect(container.querySelector('h2')).toBeNull();
      expect(container.querySelector('a span')).toBeNull();
    }
  });

  test('empty and all-disabled configurations render no section or links', () => {
    const { container, rerender } = render(<SocialProfileLinks variant={variant} profiles={[]} />, { wrapper });
    expect(container.childElementCount).toBe(0);
    rerender(<SocialProfileLinks variant={variant} profiles={approvedProfiles.map(profile => ({ ...profile, enabled: false }))} />);
    expect(container.childElementCount).toBe(0);
  });

  test('disabled entries are omitted without reordering other profiles', () => {
    const profiles = approvedProfiles.map(profile => ({ ...profile, enabled: profile.id !== 'instagram' }));
    render(<SocialProfileLinks variant={variant} profiles={profiles} />, { wrapper });
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(
      approvedProfiles.filter(profile => profile.id !== 'instagram').map(profile => profile.url),
    );
  });

  test('a future platform is rendered from configuration alone with its supplied icon', () => {
    const futureProfile: socialProfiles.SocialProfile = {
      id: 'future-network',
      label: 'Future Network',
      url: 'https://social.example.test/@newspulse',
      icon: Globe,
      enabled: true,
    };
    jest.replaceProperty(socialProfiles, 'SOCIAL_PROFILES', [...approvedProfiles, futureProfile]);
    render(<SocialProfileLinks variant={variant} />, { wrapper });
    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual([...approvedProfiles, futureProfile].map(profile => profile.url));
    expect(links[4].querySelector('svg.lucide-globe')).not.toBeNull();
    expect(links[4].getAttribute('aria-label')).toBe('Follow News Pulse on Future Network (opens in a new tab)');
  });

  test('unavailable browser storage does not change links or trigger optional integrations', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const fetchSpy = jest.spyOn(global, 'fetch');
    const openSpy = jest.spyOn(window, 'open');
    const { container } = render(<SocialProfileLinks variant={variant} />, { wrapper });
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(approvedProfiles.map(profile => profile.url));
    fireEvent.mouseEnter(screen.getAllByRole('link')[0]);
    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(container.querySelector('iframe, script, link')).toBeNull();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s keeps the SSR profile links through hydration', async lang => {
    const app = <LanguageProvider initialLang={lang}><SocialProfileLinks variant={variant} /></LanguageProvider>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(app);
    document.body.appendChild(container);
    const initialHtml = container.innerHTML;
    const onRecoverableError = jest.fn();
    const root = hydrateRoot(container, app, { onRecoverableError });
    try {
      await act(async () => {});
      expect(container.innerHTML).toBe(initialHtml);
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});
