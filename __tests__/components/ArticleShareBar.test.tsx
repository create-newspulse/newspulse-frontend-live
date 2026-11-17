import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ArticleShareBar from '../../components/ArticleShareBar';
import { getMessagesForLang, LanguageProvider, type Lang } from '../../src/i18n/LanguageProvider';
import messagesEn from '../../messages/en.json';
import messagesHi from '../../messages/hi.json';
import messagesGu from '../../messages/gu.json';

let mockConsent: { hasDecision: boolean; isPreferencesOpen: boolean } | null = null;
jest.mock('../../src/consent/CookieConsentProvider', () => ({
  useOptionalCookieConsent: () => mockConsent,
}));

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const writeText = jest.fn(async (_text: string) => {});
const url = 'https://www.newspulse.co.in/gu/news/%E0%AA%B8%E0%AA%AE%E0%AA%BE%E0%AA%9A%E0%AA%BE%E0%AA%B0';
const title = 'ગુજરાતના સમાચાર & વિશ્લેષણ';

function sharing(locale: Lang = 'en', shareUrl = url) {
  return <LanguageProvider initialLang={locale}><ArticleShareBar url={shareUrl} title={title} /></LanguageProvider>;
}

function openMenu(locale: Lang = 'en') {
  fireEvent.click(screen.getByRole('button', { name: getMessagesForLang(locale).articleShare.label }));
  return screen.getByRole('dialog', { name: getMessagesForLang(locale).articleShare.label });
}

beforeEach(() => {
  mockConsent = null;
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
  else Reflect.deleteProperty(navigator, 'share');
});

test.each(['en', 'hi', 'gu'] as const)('%s opens one menu with five branded destinations, the canonical URL and localized feedback', async (locale) => {
  const copy = getMessagesForLang(locale).articleShare;
  expect({ en: messagesEn, hi: messagesHi, gu: messagesGu }[locale].articleShare).toEqual(copy);
  const shareUrl = `https://www.newspulse.co.in${locale === 'en' ? '' : `/${locale}`}/news/${encodeURIComponent(title)}`;
  render(sharing(locale, shareUrl));
  const bar = screen.getByRole('group', { name: copy.label });
  const trigger = within(bar).getByRole('button', { name: copy.label });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(within(bar).queryAllByRole('link')).toHaveLength(0);
  expect(within(bar).getAllByRole('button')).toHaveLength(1);
  const menu = openMenu(locale);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
  const links = within(menu).getAllByRole('link');
  expect(links).toHaveLength(5);
  expect(within(menu).getAllByRole('button')).toHaveLength(2);
  expect(document.activeElement).toBe(links[0]);
  for (const link of links) {
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toBeTruthy();
  }
  const destinations = links.map((link) => new URL(link.getAttribute('href')!));
  expect(destinations.map((link) => link.origin + link.pathname)).toEqual([
    'https://www.facebook.com/sharer/sharer.php',
    'https://twitter.com/intent/tweet',
    'https://wa.me/',
    'https://www.linkedin.com/sharing/share-offsite/',
    'https://t.me/share/url',
  ]);
  expect(destinations[0].searchParams.get('u')).toBe(shareUrl);
  expect(destinations[1].searchParams.get('url')).toBe(shareUrl);
  expect(destinations[1].searchParams.get('text')).toBe(title);
  expect(destinations[2].searchParams.get('text')).toBe(`${title} ${shareUrl}`);
  expect(destinations[3].searchParams.get('url')).toBe(shareUrl);
  expect(destinations[4].searchParams.get('url')).toBe(shareUrl);
  expect(destinations[4].searchParams.get('text')).toBe(title);
  expect(screen.getByRole('status').textContent).toBe('');
  fireEvent.click(within(bar).getByRole('button', { name: copy.copyLink }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe(copy.copied));
  expect(writeText).toHaveBeenCalledWith(shareUrl);
});

test('native Share uses the same article title and canonical without also copying', async () => {
  const share = jest.fn(async (_data: ShareData) => {});
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(sharing());
  openMenu();
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  await waitFor(() => expect(share).toHaveBeenCalledWith({ title, url }));
  expect(writeText).not.toHaveBeenCalled();
});

test.each(['unavailable', 'rejected'])('native Share retains the clipboard fallback when %s', async (state) => {
  if (state === 'rejected') {
    Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn().mockRejectedValue(new Error('Share unavailable')) });
  }
  render(sharing());
  openMenu();
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copied.'));
  expect(writeText).toHaveBeenCalledWith(url);
});

test('dismissing the native sheet neither copies nor displays an error', async () => {
  const share = jest.fn().mockRejectedValue(new DOMException('Dismissed', 'AbortError'));
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(sharing());
  openMenu();
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('');
});

test.each(['Copy link', 'More options'])('%s surfaces a clipboard failure instead of claiming success', async (name) => {
  writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
  render(sharing());
  openMenu();
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sharing is unavailable. Copy the URL from your browser.'));
  expect(screen.queryByText('Link copied.')).toBeNull();
});

test('a route change clears old feedback and retargets the existing bar', async () => {
  const view = render(sharing());
  openMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copied.'));
  const nextUrl = 'https://www.newspulse.co.in/hi/news/next-story';
  view.rerender(sharing('hi', nextUrl));
  expect(screen.getAllByRole('group')).toHaveLength(1);
  expect(screen.queryByRole('dialog')).toBeNull();
  openMenu('hi');
  expect(screen.getByRole('status').textContent).toBe('');
  fireEvent.click(screen.getByRole('button', { name: getMessagesForLang('hi').articleShare.copyLink }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(nextUrl));
});

test('ArrowDown opens the menu and Escape dismisses it and restores trigger focus', () => {
  render(sharing());
  const trigger = screen.getByRole('button', { name: 'Share this article' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getAllByRole('link')[0]);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

test('pointer and focus interactions inside the menu keep it open; outside pointer dismisses it', () => {
  render(sharing());
  const menu = openMenu();
  const copy = within(menu).getByRole('button', { name: 'Copy link' });
  fireEvent.pointerDown(copy);
  copy.focus();
  expect(screen.getByRole('dialog')).toBe(menu);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Share this article' }).getAttribute('aria-expanded')).toBe('false');
});

test('moving keyboard focus outside dismisses the nonmodal menu without stealing focus', () => {
  render(<>{sharing()}<button type="button">Next article action</button></>);
  openMenu();
  const outside = screen.getByRole('button', { name: 'Next article action' });
  act(() => outside.focus());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(outside);
});

test('the same trigger toggles the menu and cookie preferences dismiss it', () => {
  const view = render(sharing());
  openMenu();
  const trigger = screen.getByRole('button', { name: 'Share this article' });
  fireEvent.click(trigger);
  expect(screen.queryByRole('dialog')).toBeNull();
  openMenu();
  mockConsent = { hasDecision: true, isPreferencesOpen: true };
  view.rerender(sharing());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('group').getAttribute('data-floating')).toBe('false');
});
