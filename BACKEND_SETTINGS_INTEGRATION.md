# Backend Settings Integration - Complete

## Overview
Frontend is now **fully controlled by published backend settings**. No localStorage pollution for production users.

## Architecture

### 1. Settings Fetch Flow
```
App Load → PublicSettingsContext (src/context/PublicSettingsContext.tsx)
  ↓
  GET /api/public/settings (proxied via Next.js rewrite)
  ↓
  Backend: ${NEXT_PUBLIC_API_BASE}/api/public/settings
  ↓
  Response: { ok: true, published: { modules, tickers, languageTheme, footerText } }
  ↓
  Stored in React Context (available globally)
```

### 2. Next.js Rewrite Configuration
**File:** `next.config.js`

```javascript
async rewrites() {
  const backend = process.env.NEXT_PUBLIC_API_BASE;
  return [
    {
      source: '/api/public/settings',
      destination: `${backend}/api/public/settings`,
    },
  ];
}
```

**Environment Variable:** `NEXT_PUBLIC_API_BASE=http://localhost:5000` (dev) or `NEXT_PUBLIC_API_BASE=https://YOUR_PROD_BACKEND_DOMAIN` (prod)

### 3. Settings Applied to UI

#### Homepage Modules (pages/index.tsx)
- ✅ **Category Strip** - `publishedSettings.modules.categoryStrip.enabled`
- ✅ **Trending Strip** - `publishedSettings.modules.trendingStrip.enabled`
- ✅ **Explore Categories** - `publishedSettings.modules.exploreCategories.enabled + order`
- ✅ **Live TV Card** - `publishedSettings.modules.liveTvCard.enabled + url`
- ✅ **Quick Tools** - `publishedSettings.modules.quickTools.enabled`
- ✅ **Snapshots** - `publishedSettings.modules.snapshots.enabled`
- ✅ **App Promo** - `publishedSettings.modules.appPromo.enabled`
- ✅ **Footer** - `publishedSettings.modules.footer.enabled + footerText override`

#### Tickers
- ✅ **Breaking Ticker**
  - Enabled: `publishedSettings.tickers.breaking.enabled`
  - Speed: `publishedSettings.tickers.breaking.speedSeconds`
  - Show When Empty: `publishedSettings.tickers.breaking.showWhenEmpty`
  - Breaking Mode: `publishedSettings.breakingMode` (auto/on/off)

- ✅ **Live Updates Ticker**
  - Enabled: `publishedSettings.tickers.live.enabled`
  - Speed: `publishedSettings.tickers.live.speedSeconds`
  - Show When Empty: `publishedSettings.tickers.live.showWhenEmpty`

#### Language & Theme Defaults
- ✅ **Language**: `publishedSettings.languageTheme.lang` (en/hi/gu)
- ✅ **Theme**: `publishedSettings.languageTheme.themeId` (aurora/night/ocean/sunset)
- Applied **once on load**, not persisted to localStorage for public users

#### Footer
- ✅ **Footer Text**: `publishedSettings.footerText` overrides default i18n text

### 4. Dev-Only Settings Drawer

**Environment Gate:**
```bash
NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER=true  # Dev/founder only
```

**Default:** `false` (hidden from public users)

**Behavior:**
- When `false`: Settings drawer icon hidden, no localStorage writes, published settings control everything
- When `true`: Drawer visible for dev/testing, can override settings locally (stored in localStorage)

### 5. Fallback Behavior

If backend fetch fails:
- Uses `DEFAULT_PUBLIC_SETTINGS` from `src/lib/publicSettings.ts`
- All modules enabled by default
- Safe speeds: breaking=18s, live=24s
- No localStorage reads for production users

### 6. Key Files Modified

1. **src/lib/publicSettings.ts**
   - Added: `breakingMode`, `footerText`, `languageTheme` types
   - Fetch endpoint: `{API_BASE}/public/settings` (preferred) → `/api/public/settings` (fallback)
   - Normalization logic for backend response shapes

2. **src/context/PublicSettingsContext.tsx**
   - Fetches settings on app mount
   - Exposes convenience getters: `isModuleEnabled()`, `ticker()`, `liveTvEmbedUrl()`, `footerText()`
   - Stores in global React Context

3. **src/i18n/LanguageProvider.tsx**
   - Added `setLang(lang, { persist: false })` option
   - Allows backend to set language without localStorage write

4. **pages/index.tsx**
   - Applies published settings to all rendering decisions
   - One-shot language/theme defaults from backend
   - Breaking mode, ticker speeds, showWhenEmpty all from backend
   - Footer text override support

5. **pages/api/public/settings.ts**
   - Next.js API route (fallback when rewrite not available)
   - Proxies to backend: `{API_BASE}/public/settings`
   - Maps legacy site-settings format if needed

6. **next.config.js**
   - Rewrites `/api/public/settings` → backend
   - No client-side CORS issues

## Acceptance Testing

### Test 1: Live TV Toggle
1. Admin Panel → Turn OFF Live TV → Publish
2. Frontend refresh → ✅ Live TV widget disappears
3. Admin Panel → Turn ON Live TV → Publish
4. Frontend refresh → ✅ Live TV widget appears

### Test 2: Ticker Toggle
1. Admin Panel → Turn OFF Breaking Ticker → Publish
2. Frontend refresh → ✅ Breaking ticker hidden
3. Admin Panel → Turn ON Breaking Ticker + speed=12s → Publish
4. Frontend refresh → ✅ Breaking ticker visible at 12s speed

### Test 3: Module Order
1. Admin Panel → Change order: Explore Categories=5, Live TV=10, Quick Tools=15
2. Publish
3. Frontend refresh → ✅ Sidebar modules render in new order

### Test 4: Footer Text
1. Admin Panel → Set footer text: "Custom footer message 2026"
2. Publish
3. Frontend refresh → ✅ Footer shows custom text instead of i18n default

### Test 5: Language/Theme Defaults
1. Admin Panel → Set language=gu, theme=sunset
2. Publish
3. Frontend refresh → ✅ UI loads in Gujarati with sunset theme
4. User changes language → ✅ Not saved to localStorage (session-only)

## Production Checklist

- [x] Backend URL configured via `NEXT_PUBLIC_API_BASE`
- [x] Settings drawer hidden by default: `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER` unset or `false`
- [x] Next.js rewrite proxies `/api/public/settings` to backend
- [x] No localStorage writes for production users
- [x] Fallback to safe defaults if backend unreachable
- [x] All modules/tickers/liveTV/footer controlled by backend
- [x] Language/theme defaults applied from backend (ephemeral)
- [x] Unit tests pass: `npm test -- __tests__/lib/publicSettings.test.ts`

## Dev Mode

To enable local settings drawer for testing:

```bash
# .env.local
NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER=true
```

Then restart dev server. Settings icon will appear in header.

## API Contract

**Backend Endpoint:** `GET /api/public/settings`

**Expected Response:**
```json
{
  "ok": true,
  "published": {
    "homeModules": {
      "categoryStrip": { "enabled": true, "order": 10 },
      "breakingTicker": { "enabled": true, "order": 20 },
      "liveUpdatesTicker": { "enabled": true, "order": 30 },
      "trendingStrip": { "enabled": true, "order": 40 },
      "exploreCategories": { "enabled": true, "order": 10 },
      "liveTvCard": { "enabled": true, "order": 20, "url": "https://..." },
      "quickTools": { "enabled": true, "order": 30 },
      "snapshots": { "enabled": true, "order": 40 },
      "appPromo": { "enabled": true, "order": 10 },
      "footer": { "enabled": true, "order": 20 }
    },
    "tickers": {
      "breaking": {
        "enabled": true,
        "speedSeconds": 18,
        "showWhenEmpty": true
      },
      "live": {
        "enabled": true,
        "speedSeconds": 24,
        "showWhenEmpty": true
      }
    },
    "breakingMode": "auto",
    "footerText": "Your trusted source for news in English, Hindi, and Gujarati.",
    "languageTheme": {
      "lang": "en",
      "themeId": "aurora"
    }
  },
  "version": "1.0.0",
  "updatedAt": "2026-01-07T10:30:00Z"
}
```

**Alternate Shape (Legacy):** Backend can also return:
```json
{
  "ok": true,
  "settings": {
    "ui": {
      "showBreakingTicker": true,
      "showLiveUpdatesTicker": true,
      "showLiveTvCard": false,
      "showFooter": true
    },
    "breakingMode": "auto",
    "liveTickerOn": true,
    "breakingSpeedSec": 18,
    "liveSpeedSec": 24,
    "liveTvUrl": "https://..."
  }
}
```

Frontend normalizes both shapes via `mergePublicSettingsWithDefaults()`.

## Troubleshooting

### Settings not updating after Admin Panel publish?
1. Check browser console for fetch errors
2. Verify `NEXT_PUBLIC_API_BASE` is set correctly
3. Check backend logs: `GET /api/public/settings` should return 200
4. Hard refresh: Ctrl+Shift+R (clears cache)

### Settings drawer still visible to public users?
1. Check `.env.local` or `.env.production`
2. Ensure `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER` is **not set** or `false`
3. Restart Next.js dev server after env changes

### Modules not respecting order?
1. Check Admin Panel → Published Settings → homeModules order values
2. Lower order renders first (e.g., order=10 before order=20)
3. Hard refresh frontend after publish

### Footer text not updating?
1. Verify `published.footerText` is set in backend response
2. Check if empty string (will fallback to i18n default)
3. Console log: `publishedSettings.footerText` should show custom text

---

**Status:** ✅ Production Ready
**Last Updated:** January 7, 2026
