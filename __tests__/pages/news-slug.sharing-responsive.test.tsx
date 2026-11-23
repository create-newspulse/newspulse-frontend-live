/** @jest-environment node */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Browser, type Page } from 'playwright';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import NewsSlugDetailPage from '../../pages/news/[slug]';
import { LanguageProvider, getMessagesForLang, type Lang } from '../../src/i18n/LanguageProvider';
import tailwindConfig from '../../tailwind.config';

let mockConsent = { hasDecision: true, isPreferencesOpen: false };
jest.mock('../../src/consent/CookieConsentProvider', () => ({ useOptionalCookieConsent: () => mockConsent }));
jest.mock('next/router', () => ({ useRouter: () => ({ query: { slug: 'share-story' }, asPath: '/news/share-story' }) }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/components/ads/AdSlot', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/components/category/CategoryHeader', () => ({ __esModule: true, default: () => <header>News Pulse</header> }));
jest.mock('../../src/components/story/StoryImage', () => ({ __esModule: true, default: () => null, ArticleHeroImage: () => null }));
jest.mock('../../hooks/useArticleAnalytics', () => ({ useArticleAnalytics: () => {} }));

let browser: Browser;
let page: Page;
let css: string;

beforeAll(async () => {
  browser = await chromium.launch();
  const files = [['pages', 'news', '[slug].tsx'], ['components', 'ArticleShareBar.tsx']];
  css = (await postcss([tailwindcss({
    ...tailwindConfig,
    content: files.map((file) => ({ raw: fs.readFileSync(path.join(process.cwd(), ...file), 'utf8'), extension: 'tsx' })),
  })]).process('@tailwind base; @tailwind utilities;', { from: undefined })).css;
}, 30000);

beforeEach(async () => {
  mockConsent = { hasDecision: true, isPreferencesOpen: false };
  page = await browser.newPage();
  await page.route('**/*', (route) => route.abort());
});

afterEach(async () => { await page?.close(); });
afterAll(async () => { await browser?.close(); });

async function loadArticle(locale: Lang, width: number, height = 800) {
  const title = { en: 'News Pulse article headline', hi: 'न्यूज़ पल्स लेख का शीर्षक', gu: 'ન્યૂઝ પલ્સના લેખનું શીર્ષક' }[locale];
  const body = Array.from({ length: 18 }, (_, index) => `<p>Article paragraph ${index + 1}: readable content and a <a href="#article-end">related reference</a>.</p>`).join('');
  const article = { _id: 'share-story', slug: 'share-story', language: locale, status: 'published', title, content: body, publishedAt: '2026-01-01T10:00:00Z' };
  const html = renderToStaticMarkup(
    <LanguageProvider initialLang={locale}>
      <NewsSlugDetailPage
        lang={locale} slug="share-story" siteUrl="https://www.newspulse.co.in"
        article={article}
        relatedStories={[]} pending={false} error={null}
      />
    </LanguageProvider>
  );
  await page.setViewportSize({ width, height });
  await page.setContent(`<html lang="${locale}"><head><style>${css}</style></head><body>${html}</body></html>`);
}

async function exposeMenuForLayout() {
  // React interactions are covered by the component suite; this fixture measures SSR markup/CSS.
  await page.locator('.np-article-share__menu').evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error('Share menu must be an HTML element');
    node.hidden = false;
  });
  return page.getByRole('dialog');
}

test.each([
  ['en', 320], ['hi', 320], ['gu', 320], ['en', 767], ['en', 768], ['en', 1280], ['hi', 1024], ['gu', 1024],
] as const)('%s at %ipx has one compact trigger and a three-row menu without overflow or trapped final content', async (locale, width) => {
  await loadArticle(locale, width);
  const bar = page.getByRole('group', { name: getMessagesForLang(locale).articleShare.label });
  expect(await bar.count()).toBe(1);
  expect(await bar.getByRole('button').count()).toBe(1);
  expect(await bar.getByRole('link').count()).toBe(0);
  expect(await page.getByRole('dialog').count()).toBe(0);
  const bounds = await bar.boundingBox();
  if (!bounds) throw new Error('Share bar must be visible');
  const position = await bar.evaluate((node) => getComputedStyle(node).position);
  expect(position).toBe(width < 768 ? 'fixed' : 'relative');
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  if (width < 768) {
    expect(bounds.width).toBeLessThan(width / 2);
    const padding = await page.locator('main').evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(800 - bounds.y);
    const lastLink = page.locator('.article-body a').last();
    await lastLink.focus();
    const lastBounds = await lastLink.boundingBox();
    if (!lastBounds) throw new Error('Final article link must be visible');
    expect(lastBounds.y + lastBounds.height).toBeLessThanOrEqual(bounds.y);
  } else {
    const headline = await page.locator('h1').boundingBox();
    if (!headline) throw new Error('Article headline must be visible');
    expect(bounds.y).toBeGreaterThan(headline.y);
    expect(bounds.y - headline.y - headline.height).toBeLessThan(120);
  }

  const menu = await exposeMenuForLayout();
  const menuBounds = await menu.boundingBox();
  if (!menuBounds) throw new Error('Share menu must be visible');
  expect(menuBounds.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(width);
  expect(menuBounds.y).toBeGreaterThanOrEqual(0);
  expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(800);
  const actions = menu.locator('a, button');
  expect(await actions.count()).toBe(7);
  const boxes = await actions.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(menuBounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(menuBounds.x + menuBounds.width);
  }
  for (const box of boxes.slice(0, 5)) {
    expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(1);
    expect(box.width).toBe(44);
  }
  expect(await actions.first().evaluate((node) => getComputedStyle(node).borderRadius)).toBe('50%');
  expect(boxes[5].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height);
  expect(boxes[6].y).toBeGreaterThanOrEqual(boxes[5].y + boxes[5].height);
  expect(boxes[5].width).toBeGreaterThanOrEqual(menuBounds.width - 20);
  expect(boxes[6].width).toBe(boxes[5].width);
  await actions.first().focus();
  for (let index = 0; index < 7; index++) {
    expect(await actions.nth(index).evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await actions.nth(index).evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('solid');
    if (index < 6) await page.keyboard.press('Tab');
  }
});

test('resizing repositions the same controls without inserting a second sharing bar', async () => {
  await loadArticle('en', 1280);
  const bar = page.getByRole('group', { name: 'Share this article' });
  await bar.evaluate((node) => node.setAttribute('data-resize-check', 'same-instance'));
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await bar.count()).toBe(1);
  expect(await bar.getAttribute('data-resize-check')).toBe('same-instance');
  expect(await bar.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
  await page.setViewportSize({ width: 1024, height: 800 });
  expect(await bar.count()).toBe(1);
  expect(await bar.evaluate((node) => getComputedStyle(node).position)).toBe('relative');
});

test.each([
  { width: 320, hasDecision: false, isPreferencesOpen: false },
  { width: 320, hasDecision: true, isPreferencesOpen: true },
  { width: 375, hasDecision: false, isPreferencesOpen: false },
  { width: 375, hasDecision: true, isPreferencesOpen: true },
])('mobile sharing stays inline while cookie controls are active (%p)', async ({ width, ...consent }) => {
  mockConsent = consent;
  await loadArticle('en', width);
  const bar = page.getByRole('group', { name: 'Share this article' });
  expect(await bar.evaluate((node) => getComputedStyle(node).position)).toBe('relative');
  expect(await bar.getByRole('button').count()).toBe(1);
  const menu = await exposeMenuForLayout();
  expect(await menu.locator('a, button').count()).toBe(7);
  expect(await menu.evaluate((node) => getComputedStyle(node).position)).toBe('static');
  expect(await menu.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await bar.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('the mobile menu stays within a short viewport and scrolls rather than clipping actions', async () => {
  await loadArticle('gu', 667, 240);
  const menu = await exposeMenuForLayout();
  const bounds = await menu.boundingBox();
  if (!bounds) throw new Error('Share menu must be visible');
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(240);
  expect(await menu.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await menu.getByRole('button').last().focus();
  const last = await menu.getByRole('button').last().boundingBox();
  if (!last) throw new Error('More options must remain reachable');
  expect(last.y).toBeGreaterThanOrEqual(bounds.y);
  expect(last.y + last.height).toBeLessThanOrEqual(bounds.y + bounds.height);
});
