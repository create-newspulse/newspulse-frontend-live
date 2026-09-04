import React from 'react';

import ExploreCategories from './ExploreCategories';
import { HomeSpotlightCarousel, HomeTrendingStrip } from './home/HomeSharedFeatureModules';
import { HomeLeftRailLiveTvCard, HomeLeftRailSnapshotsCard } from './home/HomeLeftRailUtilities';
import HomeRightRail, { articleToHomeRightRailFeedItem, DEFAULT_HOME_RIGHT_RAIL_THEME, type HomeRightRailLang } from './home/HomeRightRail';
import AdSlot from '../src/components/ads/AdSlot';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS } from '../src/lib/publicSettings';
import { fetchPublicNews } from '../lib/publicNewsApi';

type NewsPulseCategoryShellProps = {
	activeCategory: string;
	latestItems: any[] | null;
	lang: HomeRightRailLang;
	rightRail?: React.ReactNode;
	tickerContent?: React.ReactNode;
	topContent?: React.ReactNode;
	children: React.ReactNode;
};

const CATEGORY_ROUTES: Record<string, string> = {
	breaking: '/breaking',
	regional: '/regional/gujarat',
	national: '/national',
	international: '/international',
	business: '/business',
	'science-technology': '/science-technology',
	sports: '/sports',
	lifestyle: '/lifestyle',
	glamour: '/glamour',
	'web-stories': '/web-stories',
	editorial: '/editorial',
	youth: '/youth-pulse',
	'youth-pulse': '/youth-pulse',
	inspiration: '/inspiration-hub',
	'inspiration-hub': '/inspiration-hub',
	community: '/community-reporter',
	'community-reporter': '/community-reporter',
};

const HOME_STORY_CACHE_KEY = 'newspulse-home-cache';

function routeForCategory(activeCategory: string): string {
	const key = String(activeCategory || '').trim().toLowerCase();
	return CATEGORY_ROUTES[key] || `/${key || ''}`;
}

function safeJsonParse(raw: string): any {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function readCachedHomeLatestItems(lang: HomeRightRailLang): any[] {
	if (typeof window === 'undefined') return [];

	const stores = [window.localStorage, window.sessionStorage];
	for (const store of stores) {
		try {
			const raw = store.getItem(HOME_STORY_CACHE_KEY);
			const cache = raw ? safeJsonParse(raw) : null;
			if (!cache || typeof cache !== 'object') continue;
			if (cache.lang && cache.lang !== lang) continue;

			const freshStories = Array.isArray(cache.freshStories) ? cache.freshStories : [];
			const topStory = cache.topStory && typeof cache.topStory === 'object'
				? articleToHomeRightRailFeedItem(cache.topStory as any, lang)
				: null;
			const items = [topStory, ...freshStories].filter(Boolean);
			if (!items.length) continue;

			const seen = new Set<string>();
			return items.filter((item: any) => {
				const key = String(item?.id || item?._id || item?.slug || item?.title || '').trim();
				if (!key) return true;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		} catch {}
	}

	return [];
}

export default function NewsPulseCategoryShell({ activeCategory, latestItems, lang, rightRail, tickerContent, topContent, children }: NewsPulseCategoryShellProps) {
	const activePath = routeForCategory(activeCategory);
	const { settings, isModuleEnabled, moduleOrder } = usePublicSettings();
	const [globalLatestItems, setGlobalLatestItems] = React.useState<any[] | null>(null);

	React.useEffect(() => {
		if (rightRail) return;

		let cancelled = false;
		const cachedItems = readCachedHomeLatestItems(lang);
		setGlobalLatestItems(cachedItems.length ? cachedItems : null);

		const controller = new AbortController();
		const loadLatest = async () => {
			const response = await fetchPublicNews({ language: lang, limit: 40, signal: controller.signal });
			if (cancelled || controller.signal.aborted) return;

			const items = Array.isArray(response.items)
				? response.items.map((article) => articleToHomeRightRailFeedItem(article as any, lang))
				: [];
			if (items.length || cachedItems.length) {
				setGlobalLatestItems(items.length ? items : cachedItems);
			}
		};

		void loadLatest().catch(() => {
			if (!cancelled && cachedItems.length) setGlobalLatestItems(cachedItems);
		});

		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [lang, rightRail]);

	const rightRailLatestItems = globalLatestItems && globalLatestItems.length > 0 ? globalLatestItems : latestItems;
	const spotlightItems = Array.isArray(rightRailLatestItems) ? rightRailLatestItems : [];
	const resolvedRightRail = rightRail ?? (
		<HomeRightRail theme={DEFAULT_HOME_RIGHT_RAIL_THEME} latestItems={rightRailLatestItems} lang={lang} />
	);
	const liveTvSettings = settings?.liveTv ?? DEFAULT_NORMALIZED_PUBLIC_SETTINGS.liveTv;
	const hasLiveTvMedia = Boolean(
		liveTvSettings?.enabled ||
		liveTvSettings?.embedUrl ||
		liveTvSettings?.fallbackVideoUrl ||
		liveTvSettings?.offlineLoopVideoUrl ||
		liveTvSettings?.offlinePosterImageUrl
	);
	const leftRailUtilityBlocks = [
		{
			key: 'liveTvCard',
			order: moduleOrder('liveTvCard'),
			enabled: isModuleEnabled('liveTvCard') && hasLiveTvMedia,
			node: <HomeLeftRailLiveTvCard theme={DEFAULT_HOME_RIGHT_RAIL_THEME} liveTvSettings={liveTvSettings} />,
		},
		{
			key: 'snapshots',
			order: moduleOrder('snapshots'),
			enabled: isModuleEnabled('snapshots'),
			node: <HomeLeftRailSnapshotsCard theme={DEFAULT_HOME_RIGHT_RAIL_THEME} />,
		},
	]
		.filter((block) => block.enabled)
		.sort((a, b) => a.order - b.order);

	return (
		<section className="relative min-h-screen w-full overflow-x-hidden bg-gray-50/30">
			<style>{`
				.np-no-scrollbar::-webkit-scrollbar,
				.no-scrollbar::-webkit-scrollbar {
					display: none;
				}
				.np-no-scrollbar,
				.no-scrollbar {
					-ms-overflow-style: none;
					scrollbar-width: none;
				}
				.home-shell,
				.home-container {
					width: min(calc(100% - 48px), 1480px);
					margin-left: auto;
					margin-right: auto;
					box-sizing: border-box;
				}
				.home-grid {
					display: grid;
					grid-template-columns: clamp(300px, 24vw, 360px) minmax(560px, 1fr) clamp(300px, 22vw, 340px);
					gap: 24px;
					align-items: start;
					width: 100%;
					min-width: 0;
					min-height: 0;
				}
				.home-grid--three {
					grid-template-columns: clamp(300px, 24vw, 360px) minmax(560px, 1fr) clamp(300px, 22vw, 340px);
				}
				.home-grid-section {
					margin-bottom: 24px;
					padding-bottom: 0;
				}
				.home-left,
				.home-center,
				.home-right,
				.top-story-card,
				.fresh-stories-card {
					width: 100%;
					min-width: 0;
				}
				@media (min-width: 1200px) and (max-width: 1479px) {
					.home-grid--three {
						grid-template-columns: clamp(280px, 24vw, 330px) minmax(0, 1fr) clamp(280px, 22vw, 320px);
						gap: 24px;
					}
				}
				@media (min-width: 1480px) {
					.home-shell,
					.home-container {
						max-width: 1480px;
					}
				}
				@media (max-width: 1280px) {
					.home-shell,
					.home-container {
						width: min(calc(100% - 32px), 100%);
					}
				}
				@media (max-width: 1200px) {
					.home-shell,
					.home-container {
						width: min(calc(100% - 32px), 100%);
					}
					.home-grid,
					.home-grid--three {
						grid-template-columns: 1fr;
						gap: 20px;
					}
					.home-left { order: 3; }
					.home-center { order: 1; }
					.home-right { order: 2; }
					.home-grid-section {
						margin-bottom: 20px;
					}
				}
			`}</style>

			{tickerContent ? (
				<div className="mt-3 w-full max-w-full">
					<div className="home-shell">
						<div className="ticker-wrapper rounded-2xl border border-black/10 bg-white/80 p-2 shadow-sm ring-1 ring-black/5 backdrop-blur-md">
							{tickerContent}
						</div>
					</div>
				</div>
			) : null}

			{topContent ? <div className="home-container pt-4">{topContent}</div> : null}

			<AdSlot slot="HOME_728x90" variant="homeBanner" className="home-shell mx-auto mt-4" />
			{isModuleEnabled('trending') ? <HomeTrendingStrip theme={DEFAULT_HOME_RIGHT_RAIL_THEME} /> : null}

			<div className="home-container pb-6 pt-4">
				<div className="relative">
					<div className="home-grid-section relative grid gap-6">
						<div className="home-grid home-grid--three">
							<aside className="home-left">
								<div className="grid gap-4">
									<ExploreCategories pathname={activePath} />
									<AdSlot slot="HOME_LEFT_300x600" variant="right300x600" />
									{leftRailUtilityBlocks.map((block) => (
										<React.Fragment key={block.key}>{block.node}</React.Fragment>
									))}
									<AdSlot slot="HOME_LEFT_300x250" variant="right300" />
								</div>
							</aside>

							<main className="home-center">
								{children}
							</main>

							<aside className="home-right self-start">
								{resolvedRightRail}
							</aside>
						</div>
					</div>
				</div>

				<div className="post-home-grid-ads grid gap-4">
					<AdSlot slot="HOME_BILLBOARD_970x250" variant="billboard970x250" className="mx-auto" />
				</div>

				<div className="spotlight-section mt-8">
					<HomeSpotlightCarousel
						theme={DEFAULT_HOME_RIGHT_RAIL_THEME}
						title="News Pulse Spotlight"
						href="/latest"
						items={spotlightItems}
						lang={lang}
					/>
				</div>
			</div>
		</section>
	);
}
