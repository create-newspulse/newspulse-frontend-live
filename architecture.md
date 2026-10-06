# News Pulse architecture

A code-linked overview of the root News Pulse public frontend. This describes current wiring, not a production-readiness certification. Follow [rules.md](./rules.md) for contribution and safety requirements, and [BRAIN.md](./BRAIN.md) for source-of-truth policy.

## 1. Application boundary

The root [package.json](./package.json) defines a Next.js 16 / React 19 application using TypeScript, Tailwind CSS 3, and Framer Motion, with Node.js 22.x required. The lockfile determines installed dependency versions.

- The application uses the **Pages Router**, rooted at [pages/](./pages/), not an App Router tree.
- Rendering is mixed: [the homepage](./pages/index.tsx) and [article detail](./pages/news/[slug].tsx) use server-side props; routes such as [business](./pages/business/index.tsx) use static props through [categoryPageProps.ts](./lib/categoryPageProps.ts). Client hooks refresh public data after hydration.
- Next.js API handlers live in [pages/api/](./pages/api/). Many proxy backend endpoints; others implement frontend-owned behavior such as settings compatibility, authentication fallback, or upload integration.
- The main news/admin backend is a separate service. Its DEV/PROD database contract is described in [BACKEND_ENV_SEPARATION.md](./BACKEND_ENV_SEPARATION.md); the public frontend is not the backend deployment or database schema.
- Root scripts launch Next.js, not [server/](./server/) or the nested [newspulse-app/](./newspulse-app/) projects. Do not assume every top-level directory belongs to the active web application.

## 2. Request and rendering flow

```text
Browser
  +-- page navigation --> Next routing / proxy --> page and application providers
  +-- /api/... --------> Next API handler ------> backend or external service
  +-- broadcast aliases -----------------------> rewrite to backend

SSR / static page loaders --> shared data helpers --> configured backend
Initial page props --------> client state ---------> later refreshes
```

The exact path matters:

- [proxy.ts](./proxy.ts) handles backend-driven SEO redirects, locale routing, and blocking legacy PWA endpoints. It skips API routes and Next internals.
- [next.config.js](./next.config.js) configures locales, image sources, redirects, rewrites, and response headers. It disables automatic trailing-slash redirects.
- [vercel.json](./vercel.json) adds deployment-specific rewrites, headers, and API function duration limits. Its public broadcast rewrites contain a fixed production backend target.
- Browser calls through [lib/publicApiBase.ts](./lib/publicApiBase.ts) use an empty base so requests reach same-origin API routes. Server-side calls can go directly to the configured backend instead of making a loopback request to Next.js.

### Backend selection

The shared resolver in [lib/publicApiBase.ts](./lib/publicApiBase.ts) and the related configuration logic in [next.config.js](./next.config.js) prefer:

1. The explicit `NEXT_PUBLIC_API_BASE` override.
2. The appropriate `NEXT_PUBLIC_API_BASE_DEV` or `NEXT_PUBLIC_API_BASE_PROD`.
3. Supported legacy aliases.

Production is identified using `VERCEL_ENV=production` or the explicit `NEWS_PULSE_DEPLOYMENT` / `NEWS_PULSE_ENV` production values, not `NODE_ENV` alone. The shared resolver can use the known production backend when production configuration is absent; normal non-production use returns no base and warns when missing or when a known production target is refused.

**Boundary:** not every outbound request uses this resolver. [proxy.ts](./proxy.ts) has a separate SEO-redirect resolver with a production fallback, [vercel.json](./vercel.json) has fixed rewrite destinations, and [reporterAuthProxy.ts](./lib/reporterAuthProxy.ts) supports reporter-specific targets. Review those paths explicitly when checking environment isolation; do not infer a universal guard from the shared helper.

## 3. Application shell and source layout

[pages/_app.tsx](./pages/_app.tsx) imports global styles and fonts and composes:

- Theme, public settings, public mode, and feature-flag providers.
- The route-driven language provider, cookie-consent provider, and `next-intl` compatibility bridge.
- Public-version watching, route-language synchronization, SEO alternates, shared navigation, Firebase foreground messaging, and analytics integrations.
- A reporter-auth provider around protected reporter pages.

[pages/_document.tsx](./pages/_document.tsx) owns the document shell. Page-level layouts and content remain in the individual page/component trees.

| Location | Responsibility |
| --- | --- |
| [pages/](./pages/) | Public routes, page data loaders, and API handlers |
| [components/](./components/) | Shared page shells, news/category UI, homepage modules, reporter and other feature UI |
| [src/components/](./src/components/) | Additional shared layout, category, ad, story-image, and navigation components |
| [hooks/](./hooks/) | Client data lifecycles, authentication state, public refreshes, bookmarks, ads, and tickers |
| [lib/](./lib/) | API clients/proxies, article identity and routing, SEO, content handling, authentication, and integration helpers |
| [src/lib/](./src/lib/) | Published-settings normalization and additional UI/domain helpers |
| [src/context/](./src/context/) and [utils/](./utils/) | Public settings and other shared providers/utilities |
| [features/](./features/) and [src/features/](./src/features/) | Regional/youth feature clients, hooks, types, and fallbacks |
| [src/i18n/](./src/i18n/) and [messages/](./messages/) | Runtime language dictionaries and server-loaded messages |
| [src/consent/](./src/consent/) | Consent state, storage policy, technology inventory, and embedded-media gating |
| [types/](./types/) and [data/](./data/) | Shared contracts and local JSON/reference data |
| [styles/](./styles/) and [public/](./public/) | Global styling and served static assets |
| [__tests__/](./__tests__/) | Jest coverage for helpers, hooks, components, pages, API handlers, and configuration |

Both root-level and `src` modules are used by the live page tree. Similar names do not make them interchangeable; follow imports before moving or replacing code.

## 4. Main feature and data flows

### News, categories, and article detail

The [homepage](./pages/index.tsx), [category feed](./components/CategoryFeedPage.tsx), [national routes](./pages/national/), [regional routes](./pages/regional/), and [article routes](./pages/news/) share news/domain helpers:

- [publicNewsApi.ts](./lib/publicNewsApi.ts) fetches news, unwraps backend response shapes, passes language/category parameters, and filters publicly published items.
- [localizedArticleFields.ts](./lib/localizedArticleFields.ts) controls localized content and visibility. [newsRoutes.ts](./lib/newsRoutes.ts), [articleSlugs.ts](./lib/articleSlugs.ts), and [storyIdentity.ts](./lib/storyIdentity.ts) coordinate links and identity.
- [regionalInitialStories.ts](./lib/regionalInitialStories.ts) opts Regional EN/HI selection into backend `ready` translations only when both the requested locale's title and body are present. Gujarati selection and the shared strict policy used by Home and other categories do not opt in.
- [The Regional query proxy](./pages/api/public/regional/index.ts) and the initial ISR loader share [regionalFeedSource.ts](./lib/regionalFeedSource.ts) for primary eligibility and fallback resolution. They retain `/api/public/regional` as primary and fall back to `/api/public/news?category=regional` with both requested-language parameters. Only this fallback treats exact `regional` News as Gujarat without redundant state metadata; district filtering and the existing publication/language selectors remain in place. Initial loading retains its four-second deadline and propagates source failures so failed background regeneration keeps the previous ISR page.
- Regional Gujarat uses fixed 30-item backend pages. Pagination metadata is captured before frontend filtering; completely filtered pages are advanced within the existing read deadline. Load More appends the next page using the existing locale/slug selection, chronology, and ID dedupe. The 60-second refresh rereads the loaded range sequentially in fixed-size pages, retaining the previous list if any read fails. Unpaged Regional callers keep their existing response contract.
- Only Regional Gujarat initial props use [regionalListingStories.ts](./lib/regionalListingStories.ts): display/filter/identity/publication fields, the resolved cover URL, and the existing reading-time calculation are retained. Full bodies, other-language payloads, and duplicate metadata are omitted. A bounded real requested-language content excerpt and existing normalized translation state preserve the strict locale checks after hydration; eligibility is checked against full records before projection. Browser responses remain full records for the existing body-search behavior.
- The eight non-Regional ordinary categories opt into bounded News pagination through [ordinaryCategoryPagination.ts](./lib/ordinaryCategoryPagination.ts) and [categoryFeed.ts](./lib/categoryFeed.ts): National uses 20 records per page; International, Business, Science & Technology (`tech`), Tech & Gadgets, Sports, Lifestyle and Glamour use 30. The explicit browser request header activates a single requested-language primary page in [the News proxy](./pages/api/public/news.ts), without its legacy translation-group widening. Other consumers, including Regional, Home and protected categories, do not opt in and retain their existing contracts.
- [CategoryFeedPage.tsx](./components/CategoryFeedPage.tsx) and [National](./pages/national/index.tsx) append unique records, retain backend exhaustion metadata captured before filtering, and reset/abort reads when their query context changes. Existing local search/topic/state predicates are preserved; completely filtered pages advance within the read deadline rather than implying exhaustion. Refreshes use fixed pages and retain the loaded range until its replacement succeeds; polling remains 60 seconds for shared pages and 45 seconds for National. Existing initial-prop compaction and 60-second ISR remain in place. Offset pagination is not a snapshot across concurrent publication/deletion.
- [articleBody.ts](./lib/articleBody.ts) handles article-body content and controlled embeds; [seo.ts](./lib/seo.ts) centralizes SEO helpers. [The sitemap handlers](./pages/api/sitemap.ts) and [news sitemap handler](./pages/api/news-sitemap.ts) serve the corresponding rewritten public URLs.
- Homepage SSR reads news, sponsored content, and public settings concurrently with bounded deadlines. Those initial props seed the page before client refreshes.

### Published settings and live refresh

```text
Backend published settings
  -> /api/public/settings
  -> src/lib/publicSettings normalization
  -> PublicSettingsProvider
  -> homepage modules, tickers, Live TV, and other consumers

Backend public version
  -> usePublicVersion
  -> publicDataRefresh event
  -> subscribed consumers refetch
```

[pages/api/public/settings.ts](./pages/api/public/settings.ts) supports two distinct contracts:

- Without `keys`, it reads published settings, tries compatibility backend endpoints, and can return local/default fallback settings marked with `settingsSource: 'fallback'`.
- With `keys`, it reads an allowlisted set of file-backed feature flags through [lib/publicSettings.ts](./lib/publicSettings.ts).

The published-settings types, normalization, and client fetcher are in [src/lib/publicSettings.ts](./src/lib/publicSettings.ts). They are not the same module as the root feature-flag helper. [PublicSettingsContext.tsx](./src/context/PublicSettingsContext.tsx) seeds from page props, deduplicates loads, and retains existing settings during background refresh.

[usePublicVersion.ts](./hooks/usePublicVersion.ts) polls and responds to focus/visibility changes. It dispatches through [publicDataRefresh.ts](./lib/publicDataRefresh.ts) when a backend-confirmed version changes; fallback versions must not be interpreted as a publish.

File-backed settings are compatibility/fallback behavior, not evidence that a serverless filesystem is a durable production database. Successful fallback rendering also does not prove the backend is healthy.

### Community Reporter and Reporter Portal

The public [Community Reporter page](./pages/community-reporter.tsx) and [submission experience](./components/community-reporter/SubmissionExperience.tsx) are distinct from the authenticated [reporter routes](./pages/reporter/). Shared contracts and requests live in [communityReporterApi.ts](./lib/communityReporterApi.ts) and [the community-reporter API handlers](./pages/api/community-reporter/).

Reporter sign-in uses same-origin [reporter-auth API handlers](./pages/api/reporter-auth/) for code requests, verification, session checks, and logout:

- [reporterAuthProxy.ts](./lib/reporterAuthProxy.ts) selects an upstream target, handles proxy response bodies/cookies, and rejects frontend-loop targets.
- When no upstream is selected, route-specific local authentication behavior uses [reporterPortalAuth.ts](./lib/reporterPortalAuth.ts) for signed tokens/cookies and Resend/SMTP email delivery.
- The local email helper can return a development OTP when no provider is configured outside production mode. Configured mail providers can still send email in development; use the isolation rules in [rules.md](./rules.md).
- [useReporterPortalSession.ts](./hooks/useReporterPortalSession.ts) bootstraps the session with credentials and no-store requests, tracks checking/authenticated/anonymous states, and coordinates client cleanup.
- [reporterPortalPage.ts](./lib/reporterPortalPage.ts) supplies server-loaded closure toggles and messages; it is not itself an authorization check.

### Other public surfaces

| Area | Entry points |
| --- | --- |
| Pulse Dialogue | [pages/pulse-dialogue/](./pages/pulse-dialogue/), [PulseDialogueLanding.tsx](./components/PulseDialogueLanding.tsx), [lib/pulseDialogue.ts](./lib/pulseDialogue.ts) |
| Youth Pulse | [pages/youth-pulse.tsx](./pages/youth-pulse.tsx), [features/youthPulse/](./features/youthPulse/) |
| Viral videos and Live TV | [pages/viral-videos/](./pages/viral-videos/), [pages/live-tv.tsx](./pages/live-tv.tsx), [src/lib/liveTv.ts](./src/lib/liveTv.ts) |
| Advertising and broadcast | [src/components/ads/AdSlot.tsx](./src/components/ads/AdSlot.tsx), [usePublicBroadcastTicker.ts](./hooks/usePublicBroadcastTicker.ts), [public API handlers](./pages/api/public/) |
| Privacy and compliance | [pages/privacy-request.tsx](./pages/privacy-request.tsx), [pages/grievance-redressal.tsx](./pages/grievance-redressal.tsx), [lib/publicComplianceSettings.ts](./lib/publicComplianceSettings.ts) |

## 5. Localization, consent, and notifications

- [next.config.js](./next.config.js) defines `en`, `hi`, and `gu`, with English as the default and automatic locale detection disabled. [LanguageProvider.tsx](./src/i18n/LanguageProvider.tsx) uses the route-derived initial language; preference persistence is a separate concern.
- Runtime dictionaries live alongside that provider. [getMessages.ts](./lib/getMessages.ts) loads the separate [messages/](./messages/) dictionaries for page props. Preserve both consumers when changing shared copy.
- [SharedMobileNavigationDrawer.tsx](./src/components/layout/SharedMobileNavigationDrawer.tsx) uses the runtime `mobileMenu` keys for complete Quick Access labels, separate from ticker and desktop copy.
- [cookieConsent.ts](./src/consent/cookieConsent.ts) models necessary, preferences, analytics, advertising, and embedded-media categories. Optional categories default to denied. This consent model does not replace checking each integration's actual behavior.
- [EmbeddedMediaConsentGate.tsx](./src/consent/EmbeddedMediaConsentGate.tsx) is the shared UI boundary for gated media.
- Firebase browser messaging uses [firebaseClient.ts](./lib/firebaseClient.ts), [firebaseMessaging.ts](./lib/firebaseMessaging.ts), [public push handlers](./pages/api/public/push/), and [firebase-messaging-sw.js](./public/firebase-messaging-sw.js). Keep browser-safe Firebase configuration separate from server credentials.
- General PWA support remains disabled: [proxy.ts](./proxy.ts) returns HTTP 410 for legacy manifest/service-worker endpoints. [pages/_app.tsx](./pages/_app.tsx) preserves the Firebase messaging worker while cleaning up other workers in the normal disabled-PWA path. Enabling one environment flag is not a complete PWA implementation.

## 6. Tooling and maintenance boundaries

- [jest.config.js](./jest.config.js) configures Jest with jsdom, fetch setup, and TypeScript transforms. The [tests](./__tests__/) cover environment separation, localization, news visibility, settings, reporter auth, consent, and public integrations. They are not a certificate for a live backend.
- [tsconfig.json](./tsconfig.json) includes the root page/component/helper trees, `src`, and tests. It enables `strictNullChecks` but not full `strict` mode.
- [tailwind.config.js](./tailwind.config.js) currently scans the root page and component trees, not all `src` files. New utility classes need an appropriate scanned source or an intentional configuration change.
- [.storybook/main.ts](./.storybook/main.ts) configures the separate Storybook workflow. Root application tests use Jest.
- `npm run lint` is a known script mismatch: [package.json](./package.json) still calls the removed `next lint` command. Next.js 16 builds do not run linting. See [rules.md](./rules.md) for validation expectations rather than treating a build as a lint result.
- [.gitignore](./.gitignore) excludes local environment files, generated output, local labs, and the local documentation directory. Durable project documentation belongs in the tracked root documents.

Update this map when ownership, request flow, or integration boundaries change. Keep exact payload details in types/tests and transient verification results out of architecture documentation.
