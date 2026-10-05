# News Pulse project rules

Contributor rules for the public frontend in this repository. For the code map and current implementation boundaries, see [architecture.md](./architecture.md).

These requirements are not a claim that every existing path already satisfies them or that release checks have passed.

## 1. Read the right sources

- Read [AGENTS.md](./AGENTS.md) and [BRAIN.md](./BRAIN.md) before changing the application. Keep the Next.js-managed block in [AGENTS.md](./AGENTS.md) intact.
- Use current code and automated tests to establish actual behavior. Follow the source-of-truth order in [BRAIN.md](./BRAIN.md); historical documentation is not proof of correctness.
- Read the relevant installed [Next.js guides](./node_modules/next/dist/docs/) before changing framework code. This project uses the Pages Router and Next.js 16; do not assume older Next.js APIs or App Router conventions apply.
- Use [package.json](./package.json), [package-lock.json](./package-lock.json), and the current configuration for runtime and tooling requirements, rather than older version descriptions.

## 2. Keep changes focused

- Inspect the worktree before editing. Preserve unrelated changes and do not overwrite another contributor's work.
- Work in the root application unless the task explicitly targets another project. A similarly named nested directory is not automatically part of the deployed frontend.
- Trace the relevant page, component, hook, API handler, helper, and tests before changing a contract. Update all affected callers together.
- Follow the surrounding naming, formatting, and import patterns. Prefer existing helpers over a second implementation of backend selection, article routing, localization, or settings normalization.
- Keep new code typed. Validate external payloads at their boundary rather than spreading unchecked casts through components. Do not weaken the existing TypeScript configuration to hide errors.
- Preserve intentional error, empty, loading, timeout, and fallback states. New failures must be observable through the applicable error response, UI, or diagnostics; do not disguise a failure as success.
- Do not mix a feature change with dependency upgrades, directory reorganizations, or unrelated cleanup. Update directly affected tests and documentation.

## 3. Keep local development isolated

The environment contract is documented in [BACKEND_ENV_SEPARATION.md](./BACKEND_ENV_SEPARATION.md). The backend, not a frontend flag, is responsible for using separate databases.

| Environment | Preferred frontend configuration | Backend database contract |
| --- | --- | --- |
| Local/development | `NEXT_PUBLIC_API_BASE_DEV=http://localhost:3010` | `newspulse_dev` |
| Production | `NEXT_PUBLIC_API_BASE_PROD` set to the production backend origin | `newspulse_prod` |

- Use [.env.example](./.env.example) as the configuration reference. Never copy real credentials into documentation, fixtures, or tracked environment files.
- Leave `NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV` unset or false for normal development. Do not enable it merely to make a local page work.
- Check explicit overrides and legacy aliases. In [lib/publicApiBase.ts](./lib/publicApiBase.ts), `NEXT_PUBLIC_API_BASE` takes priority over the split DEV/PROD variables.
- Do not equate `NODE_ENV=production` with a production deployment. The shared backend resolver uses deployment signals so a local production build can still use a development backend.
- Verify every affected outbound path. [proxy.ts](./proxy.ts), [vercel.json](./vercel.json), and [lib/reporterAuthProxy.ts](./lib/reporterAuthProxy.ts) have routing or target-selection behavior beyond the shared resolver. Its guard alone is not proof of complete isolation.
- Use mocks or an isolated development backend for automated checks. Do not send test submissions, publish settings, register devices, or send email against production without explicit authorization.

### Reporter Portal OTP and email

- Localhost may generate and display a local/development OTP for localhost sign-in. It must not silently use production OTP or email services.
- Inspect both [lib/reporterAuthProxy.ts](./lib/reporterAuthProxy.ts) and [lib/reporterPortalAuth.ts](./lib/reporterPortalAuth.ts), not just the public API base.
- The current local email helper returns a development code only when no mail provider is configured and `NODE_ENV` is not `production`. Configured Resend/SMTP credentials can select real delivery; localhost is not, by itself, an email sandbox.
- Keep production mail credentials and production reporter-auth overrides out of the normal local environment. When testing delivery explicitly, use an authorized isolated provider and recipient.
- Preserve session validation, cookie handling, expiry, no-store responses, and logout behavior. Never use browser-stored profile data as authorization.

## 4. Preserve product contracts

### News and localization

- Keep English (`en`), Hindi (`hi`), and Gujarati (`gu`) behavior consistent. The route locale controls the current render; stored language preferences must not replace it during hydration.
- Maintain the relevant runtime dictionaries in [src/i18n/](./src/i18n/) and server-loaded messages in [messages/](./messages/). Check translation-key parity and any shared copy covered by [DictionaryKeys.test.ts](./__tests__/i18n/DictionaryKeys.test.ts).
- Reuse [lib/newsRoutes.ts](./lib/newsRoutes.ts), [lib/articleSlugs.ts](./lib/articleSlugs.ts), and [lib/localizedArticleFields.ts](./lib/localizedArticleFields.ts). Preserve published-article filtering, locale visibility, translation identity, canonical URLs, and intentional redirects.
- Test locale-prefixed navigation, direct loads, and Next.js data/prefetch requests when changing routing. Avoid redirect loops or accidental cross-language content.

### Settings, rendering, and refresh

- Treat published public settings as an active backend-driven contract. Use [src/lib/publicSettings.ts](./src/lib/publicSettings.ts) and [PublicSettingsContext.tsx](./src/context/PublicSettingsContext.tsx) rather than adding competing component defaults or fetch loops.
- Preserve the distinction between published settings and the legacy `?keys=` feature-flag mode of [the public settings API](./pages/api/public/settings.ts).
- Keep SSR/static initial data compatible with client refreshes. Preserve cancellation, request deadlines, last-known-good data, and fallback-source distinctions.
- Preserve responsive layouts, keyboard access, light/dark themes, loading states, and multilingual typography. Check the production CSS output when adding classes outside the directories scanned by [tailwind.config.js](./tailwind.config.js).

### Privacy and external services

- Use the existing [consent layer](./src/consent/) for optional storage and integrations. Check both initial consent and consent withdrawal when changing analytics, advertising, preferences, or embedded media.
- Keep article sanitization and controlled embed handling in [lib/articleBody.ts](./lib/articleBody.ts). Do not bypass them with raw external HTML.
- Keep server credentials server-side. `NEXT_PUBLIC_*` values are browser-visible; Firebase Admin credentials, private keys, mail secrets, and Cloudinary API secrets do not belong there.
- Preserve upload authorization, input validation, and response error handling when changing [admin API handlers](./pages/api/admin/).
- Do not re-enable general PWA behavior as a side effect of push-notification work. The Firebase messaging worker is a separate integration; see [architecture.md](./architecture.md).

## 5. Use the existing validation tools

Use Node.js **22.x** and npm, as declared by [package.json](./package.json). Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js server using Webpack |
| `npm run dev:3000` / `npm run dev:3002` | Explicit local frontend ports |
| `npm run type-check` | TypeScript checking without emitting application code |
| `npm test -- --runInBand --runTestsByPath <test-files>` | Focused Jest tests |
| `npm run build` | Production compilation |
| `npm run storybook` / `npm run build-storybook` | Optional component development/build |

For example, backend-selection changes have these focused tests (PowerShell):

```powershell
npm test -- --runInBand --runTestsByPath __tests__\lib\publicApiBase.test.ts __tests__\next-config.backend.test.js
```

Start with the smallest relevant test set. For application code, also check types and the build where the change affects compilation, routing, configuration, or rendering. Include reporter-auth, locale, consent, or API tests when those contracts change.

**Current lint limitation:** `npm run lint` still invokes `next lint`, which Next.js 16 removed. A successful build is not a lint pass either. Record this as a tooling limitation; do not claim lint is green or silently introduce a tooling migration into an unrelated task.

Documentation-only changes need source/reference checks, not an application rebuild, unless a documentation test is added to the project. Do not install dependencies just to validate Markdown.

## 6. Mandatory News Pulse Pre-Commit / Pre-Deployment Safety Rules

Before recommending staging, committing, pushing, or deploying, complete the applicable checklist and record the results. Do not treat this document, an old report, or a successful localhost page as evidence that these checks have passed.

- [ ] **Scope:** Review intended changes and preserve unrelated work. Exclude secrets, local environment files, generated output, logs, and temporary artifacts.
- [ ] **Environment:** Confirm effective DEV/PROD targets, including overrides, rewrites, reporter-auth targets, and any newly introduced external calls. Confirm the separate backend/database contract when that integration changes.
- [ ] **Local authentication:** For Reporter Portal changes, verify local OTP behavior without production email/OTP calls, plus session success, rejection/expiry, and logout.
- [ ] **Validation:** Run relevant automated tests and code checks. Record exact commands and outcomes, including failures, unavailable checks, and justified non-applicable checks. For documentation-only changes, verify the claims and links.
- [ ] **Behavior:** Check affected routes and UI states, including relevant locales, direct navigation, responsive behavior, privacy controls, and backend failure handling.
- [ ] **Production boundary:** For a release, verify intended production configuration and backend compatibility separately. Keep development overrides and debug OTP behavior out of production. Production verification must be explicitly authorized and must not rely on test writes to live data.
- [ ] **Handoff:** State what changed, what was verified, and what remains blocked. Do not recommend release actions while an applicable safety requirement is unresolved.

Keep these rules durable. Put release evidence, temporary task status, and incident details in their appropriate workflow, not in this file.
