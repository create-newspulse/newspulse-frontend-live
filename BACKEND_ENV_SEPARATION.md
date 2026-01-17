# DEV vs PROD Settings/Ads Separation (Backend + DB)

## Goal
Prevent DEV and PROD from reading/writing the same settings/ads data.

Required behavior:

- Local Admin (`http://localhost:5173`) updates **DEV** settings/ads
- Local Public (`http://localhost:3000`) reads **DEV** settings/ads
- Production Admin (`https://admin.newspulse.co.in`) updates **PROD** settings/ads
- Production Public (`https://www.newspulse.co.in`) reads **PROD** settings/ads

## Non-negotiable requirement
Use separate databases:

- **DEV DB:** `newspulse_dev`
- **PROD DB:** `newspulse_prod`

## Backend deployment model (recommended)
Run two backend deployments (or one backend with two distinct deployments):

- **DEV backend** (local or staging) configured to connect to **`newspulse_dev`**
- **PROD backend** (production) configured to connect to **`newspulse_prod`**

The frontend must point to the correct backend per environment.

## Frontend configuration (this repo)
This frontend supports split backend origins:

- Local/dev runtime uses `NEXT_PUBLIC_API_BASE_DEV`
- Production deployment uses `NEXT_PUBLIC_API_BASE_PROD`

Example `.env.local` (local public site on port 3000):

```dotenv
NEXT_PUBLIC_API_BASE_DEV=http://localhost:3010
```

Example Vercel production env:

```dotenv
NEXT_PUBLIC_API_BASE_PROD=https://YOUR_PROD_BACKEND_DOMAIN
```

### Safety guard
In local/dev, the frontend refuses to talk to a `*.newspulse.co.in` backend unless you explicitly override:

```dotenv
NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV=true
```

(Keep this unset/false for normal development.)

## Backend configuration (what to implement in backend repo)
The backend must select the database based on its deployment environment.

A typical pattern (MongoDB example) is:

- DEV backend:
  - `MONGODB_DB=newspulse_dev`
  - `MONGODB_URI=<dev-cluster-or-local-uri>`

- PROD backend:
  - `MONGODB_DB=newspulse_prod`
  - `MONGODB_URI=<prod-cluster-uri>`

If your backend uses a single `MONGODB_URI` that already contains the DB name, then ensure the URI itself differs:

- DEV URI points to `.../newspulse_dev`
- PROD URI points to `.../newspulse_prod`

## Quick verification checklist
1. Point local frontend to DEV backend (`NEXT_PUBLIC_API_BASE_DEV`).
2. In Local Admin (5173), change an ad/settings value and publish.
3. Confirm Local Public (3000) reflects it.
4. Confirm Production Public **does not** reflect it.
5. Confirm Production Admin updates only Production Public.

If step (4) fails, DEV and PROD are still sharing a DB connection.
