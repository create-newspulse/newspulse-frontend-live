# News Pulse Frontend - Project Brain

This file contains durable context for coding agents working in the News Pulse public frontend repository.

It is intentionally small. Do not use it as a changelog, task list, implementation snapshot, or substitute for current code and tests.

## Repository

Repository: `newspulse-frontend-live-main`

Application: News Pulse public frontend.

## Source of Truth

When information conflicts, use this order:

1. Current application code
2. Current automated tests
3. `AGENTS.md`
4. Current environment and safety documentation
5. `README.md`
6. Historical Git commits

Do not assume an old Markdown document is correct merely because it says "complete", "verified", or "production ready".

## Agent Instructions

Always read and obey `AGENTS.md` before changing code.

Do not remove or casually modify the Next.js-managed agent-rules block in `AGENTS.md`.

For Next.js behavior that may have changed, follow the repository's agent instructions and installed Next.js documentation.

## Development and Production Isolation

Local development must remain isolated from production.

Read:

- `BACKEND_ENV_SEPARATION.md`

Normal localhost development must not silently use production backend services, production databases, production OTP delivery, or production email delivery.

Use the repository's current DEV/PROD backend-selection implementation and environment configuration.

Never weaken environment-separation safeguards merely to make local development work.

## Environment Configuration

The frontend uses separate development and production backend configuration.

Treat the current environment implementation, `.env.example`, `lib/publicApiBase.ts`, `next.config.js`, and their tests as authoritative.

Legacy environment aliases may remain for compatibility. Do not make them the preferred configuration without verifying the current implementation.

## Public Settings

Backend-driven public settings are an active feature.

The authoritative implementation is the current code and tests, including the public-settings normalization/fetching logic and `/api/public/settings`.

Do not rely on removed historical settings documentation.

Before modifying public settings behavior, inspect the current implementation and associated tests.

## Community Reporter

Community Reporter and Reporter Portal functionality are active features.

Their source of truth is the current implementation and tests.

Important areas include Community Reporter API logic, Reporter Portal session/authentication, submission behavior, and related hooks/components.

Do not reintroduce behavior from old or untracked documentation without confirming it against current code.

Local Reporter Portal authentication must not silently use production OTP or production email services.

## Documentation Policy

Keep durable documentation only when it has a clear continuing purpose.

Current root documentation includes:

- `AGENTS.md`
- `BACKEND_ENV_SEPARATION.md`
- `CHANGELOG.md`
- `README.md`
- `BRAIN.md`

Prefer code and automated tests over manually maintained "verified" snapshots.

Avoid creating duplicate architecture documents that will become stale.

## Change Safety

Make focused changes and avoid unrelated modifications.

Before recommending commit, push, deployment, or production changes, follow all mandatory News Pulse pre-commit and pre-deployment safety rules defined in `AGENTS.md`.

Do not treat passing local behavior alone as proof that production is safe.

## Maintaining BRAIN.md

Update this file only when a durable architectural rule, safety constraint, or source-of-truth policy changes.

Do not add:

- temporary bugs
- current task status
- one-off fixes
- release notes
- detailed implementation snapshots
- speculative roadmap items

Those belong in code, tests, issue tracking, Git history, or purpose-specific documentation.
