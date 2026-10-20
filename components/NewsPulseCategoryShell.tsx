import React from 'react';

import ExploreCategories from './ExploreCategories';
import { HomeSpotlightCarousel, HomeTrendingStrip } from './home/HomeSharedFeatureModules';
import { HomeLeftRailLiveTvCard, HomeLeftRailSnapshotsCard } from './home/HomeLeftRailUtilities';
import HomeRightRail, { articleToHomeRightRailFeedItem, DEFAULT_HOME_RIGHT_RAIL_THEME, type HomeRightRailLang } from './home/HomeRightRail';
import AdSlot from '../src/components/ads/AdSlot';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS } from '../src/lib/publicSettings';
import { filterPubliclyPublishedArticles } from '../lib/localizedArticleFields';
import { getRegionalLocalePolicy } from '../lib/regionalInitialStories';
import { fetchPublicNews } from '../lib/publicNewsApi';
import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import { withPublicReadDeadline } from '../lib/publicReadDeadline';
import {
	fetchHomeSpotlightArticles,
	HOME_FRESH_SOURCE_LIMIT,
	isHomeSpotlightSponsoredContent,
} from '../lib/homeSpotlight';

type NewsPulseCategoryShellProps = {
	activeCategory: string;
	latestItems: any[] | null;
	lang: HomeRightRailLang;
	rightRail?: React.ReactNode;
	tickerContent?: React.ReactNode;
	topContent?: React.ReactNode;
	afterColumns?: React.ReactNode;
	children: React.ReactNode;
};

type SharedNewsState = {
	owner: string;
	latestItems: ReturnType<typeof articleToHomeRightRailFeedItem>[] | null;
	spotlightItems: ReturnType<typeof articleToHomeRightRailFeedItem>[] | null;
	latestReadError: boolean;
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

const CATEGORY_TOP_BANNER_CATEGORIES = new Set([
	'regional',
	'national',
	'international',
	'business',
	'sports',
	'lifestyle',
	'glamour',
	'science-technology',
	'tech-gadgets',
	'faith-culture',
]);

function routeForCategory(activeCategory: string): string {
	const key = String(activeCategory || '').trim().toLowerCase();
	return CATEGORY_ROUTES[key] || `/${key || ''}`;
}

export default function NewsPulseCategoryShell({ activeCategory, latestItems, lang, rightRail, tickerContent, topContent, afterColumns, children }: NewsPulseCategoryShellProps) {
	const activePath = routeForCategory(activeCategory);
	const topAdSlot = CATEGORY_TOP_BANNER_CATEGORIES.has(activeCategory) ? 'CATEGORY_TOP_970x90' : 'HOME_728x90';
	const publicLatestItems = React.useMemo(
		() => Array.isArray(latestItems) ? filterPubliclyPublishedArticles(latestItems)
			.filter((article) => !isHomeSpotlightSponsoredContent(article, lang))
			.map((article) => articleToHomeRightRailFeedItem(article, lang, activeCategory === 'regional' ? getRegionalLocalePolicy(lang) : undefined))
			.filter((item) => Boolean(item.title)) : latestItems,
		[activeCategory, lang, latestItems]
	);
	const { settings, isModuleEnabled, moduleOrder } = usePublicSettings();
	const hasCustomRightRail = Boolean(rightRail);
	const owner = `${lang}:${activeCategory}:${hasCustomRightRail}`;
	const [sharedNews, setSharedNews] = React.useState<SharedNewsState>({
		owner, latestItems: null, spotlightItems: null, latestReadError: false,
	});

	React.useEffect(() => {
		let active = true;
		let pending: AbortController | null = null;
		const initial: SharedNewsState = { owner, latestItems: null, spotlightItems: null, latestReadError: false };
		setSharedNews(initial);

		const loadHomeSharedNews = async () => {
			pending?.abort();
			const controller = new AbortController();
			pending = controller;
			const [latestResult, spotlightResult] = await Promise.allSettled([
				withPublicReadDeadline(4000, async (signal) => {
					const response = await fetchPublicNews({ language: lang, limit: HOME_FRESH_SOURCE_LIMIT, signal });
					if (response.error) throw new Error(response.error);
					return filterPubliclyPublishedArticles(response.items)
						.filter((article) => !isHomeSpotlightSponsoredContent(article, lang))
						.map((article) => articleToHomeRightRailFeedItem(article, lang))
						.filter((item) => Boolean(item.title));
				}, controller.signal),
				withPublicReadDeadline(4000, async (signal) => {
					const articles = await fetchHomeSpotlightArticles({ lang, signal });
					return articles.map((article) => articleToHomeRightRailFeedItem(article, lang));
				}, controller.signal),
			]);
			if (!active || controller.signal.aborted) return;
			if (spotlightResult.status === 'rejected') {
				console.warn('[category-shell] Spotlight unavailable', spotlightResult.reason);
			}
			setSharedNews((previous) => {
				const current = previous.owner === owner ? previous : initial;
				return {
					owner,
					latestItems: hasCustomRightRail ? current.latestItems
						: latestResult.status === 'fulfilled' ? latestResult.value : current.latestItems ?? [],
					spotlightItems: spotlightResult.status === 'fulfilled' ? spotlightResult.value : current.spotlightItems ?? [],
					latestReadError: !hasCustomRightRail && latestResult.status === 'rejected',
				};
			});
		};

		void loadHomeSharedNews();
		const unsubscribe = subscribePublicDataRefresh(() => { void loadHomeSharedNews(); });
		return () => {
			active = false;
			pending?.abort();
			unsubscribe();
		};
	}, [lang, owner, hasCustomRightRail]);

	const globalLatestItems = sharedNews.owner === owner ? sharedNews.latestItems : null;
	const latestReadError = sharedNews.owner === owner && sharedNews.latestReadError;
	const rightRailLatestItems = globalLatestItems ?? publicLatestItems;
	const spotlightItems = sharedNews.owner === owner ? sharedNews.spotlightItems ?? [] : [];
	const resolvedRightRail = rightRail ?? (
		<HomeRightRail theme={DEFAULT_HOME_RIGHT_RAIL_THEME} latestItems={rightRailLatestItems} latestReadError={latestReadError} lang={lang} />
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

			<AdSlot slot={topAdSlot} variant="homeBanner" className="home-shell mx-auto mt-4" />
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

				{afterColumns ? <div className="category-after-columns min-w-0">{afterColumns}</div> : null}

				<div className="post-home-grid-ads grid gap-4">
					<AdSlot slot="HOME_BILLBOARD_970x250" variant="billboard970x250" className="mx-auto w-full" />
				</div>

				{spotlightItems.length ? (
					<div className="spotlight-section mt-8">
						<HomeSpotlightCarousel
							theme={DEFAULT_HOME_RIGHT_RAIL_THEME}
							title="News Pulse Spotlight"
							href="/latest"
							items={spotlightItems}
							lang={lang}
						/>
					</div>
				) : null}
			</div>
		</section>
	);
}
