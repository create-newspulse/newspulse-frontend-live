# ✅ Backend Settings Integration - Verification Checklist

## Implementation Complete

### 1. Settings Fetch on App Load ✅
- **File:** `src/context/PublicSettingsContext.tsx`
- **Endpoint:** `GET /api/public/settings` (proxied to backend)
- **Storage:** React Context (global state, no localStorage for production)
- **Fallback:** Safe defaults if backend unavailable

### 2. Next.js Rewrite Configuration ✅
- **File:** `next.config.js`
- **Rule:** `/api/public/settings` → `${NEXT_PUBLIC_API_BASE}/api/public/settings`
- **Backend URL:** Set via `NEXT_PUBLIC_API_BASE` (no hardcoded default)
- **No CORS issues:** Proxied through Next.js server

### 3. UI Rendering Controlled by Backend ✅

#### Homepage Modules
- ✅ Category Strip
- ✅ Breaking Ticker
- ✅ Live Updates Ticker
- ✅ Trending Strip
- ✅ Explore Categories
- ✅ Live TV Card (+ embed URL)
- ✅ Quick Tools
- ✅ Snapshots
- ✅ App Promo
- ✅ Footer (+ text override)

**All controlled by:** `publishedSettings.modules[key].enabled + order`

#### Tickers
- ✅ Breaking: enabled, speedSeconds, showWhenEmpty, mode (auto/on/off)
- ✅ Live Updates: enabled, speedSeconds, showWhenEmpty

#### Other Settings
- ✅ Live TV: enabled + embedUrl from `publishedSettings.modules.liveTvCard.url`
- ✅ Footer: enabled + text from `publishedSettings.footerText`
- ✅ Language/Theme: defaults from `publishedSettings.languageTheme` (ephemeral, not persisted)

### 4. Settings Drawer Hidden for Public Users ✅
- **Environment Gate:** `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER`
- **Default:** `false` (hidden)
- **localStorage Gated:** Reads/writes only when drawer enabled
- **Production Behavior:** No settings drawer, no localStorage, backend is source of truth

### 5. Fallback Behavior ✅
- **If fetch fails:** Uses `DEFAULT_PUBLIC_SETTINGS` (all modules enabled)
- **No localStorage reads:** Production users never read/write preferences
- **Safe defaults:** Breaking=18s, Live=24s, all modules visible

## Testing Instructions

### Quick Test (Dev Server)
```bash
# 1. Start frontend dev server
npm run dev

# 2. Visit http://localhost:3000
# 3. Check console: Should see successful fetch from /api/public/settings

# 4. Test settings fetch directly
curl http://localhost:3000/api/public/settings

# Expected: JSON with published settings from backend
```

### Admin Panel Integration Test
```bash
# 1. Open Admin Panel (http://localhost:3010 or your backend admin)
# 2. Navigate to Site Settings → Public Settings
# 3. Toggle Live TV OFF → Click "Publish"
# 4. Refresh frontend (http://localhost:3000)
# ✅ Expected: Live TV widget disappears

# 5. Toggle Live TV ON → Click "Publish"
# 6. Refresh frontend
# ✅ Expected: Live TV widget reappears

# 7. Change Breaking Ticker speed to 12s → Publish
# 8. Refresh frontend
# ✅ Expected: Breaking ticker animates faster (12s duration)

# 9. Set Footer text: "Custom Footer 2026" → Publish
# 10. Refresh frontend, scroll to bottom
# ✅ Expected: Footer shows custom text
```

### Settings Drawer Verification
```bash
# Production mode (default)
# ✅ Settings icon NOT visible in header
# ✅ No localStorage writes

# Dev mode
# 1. Add to .env.local:
NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER=true

# 2. Restart server: npm run dev
# ✅ Settings icon visible (for dev/testing only)
# ✅ Can toggle modules locally (saved to localStorage)
```

### Module Order Test
```bash
# 1. Admin Panel → Change sidebar order:
#    - Explore Categories: order=30
#    - Live TV: order=10
#    - Quick Tools: order=20
#    - Snapshots: order=40
# 2. Publish
# 3. Refresh frontend
# ✅ Expected: Sidebar modules render as:
#    1. Live TV (order=10)
#    2. Quick Tools (order=20)
#    3. Explore Categories (order=30)
#    4. Snapshots (order=40)
```

### Language/Theme Defaults Test
```bash
# 1. Admin Panel → Set:
#    - Language: gu (Gujarati)
#    - Theme: sunset
# 2. Publish
# 3. Refresh frontend (new session)
# ✅ Expected: UI loads in Gujarati with sunset theme
# 4. User changes language to English
# ✅ Expected: Change applies but NOT saved to localStorage
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Verify `NEXT_PUBLIC_API_BASE` points to production backend
- [ ] Ensure `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER` is **not set** or `false`
- [ ] Test Admin Panel → Publish → Frontend refresh flow
- [ ] Verify settings icon is NOT visible to public users
- [ ] Check browser localStorage: Should have no `newspulse.ui.v14_5_3.prefs` key
- [ ] Test fallback: Temporarily break backend URL → Frontend should show defaults
- [ ] Verify CSP headers allow backend API requests (already configured)

## Files Changed

### Core Implementation
1. `src/lib/publicSettings.ts` - Types, fetch, normalization
2. `src/context/PublicSettingsContext.tsx` - Global state, convenience getters
3. `src/i18n/LanguageProvider.tsx` - Ephemeral language support
4. `pages/index.tsx` - Apply settings to all UI rendering
5. `pages/api/public/settings.ts` - API route fallback
6. `next.config.js` - Rewrites for backend proxy

### Documentation
1. `BACKEND_SETTINGS_INTEGRATION.md` - Complete architecture doc
2. `VERIFICATION_CHECKLIST.md` - This file

## Backend API Contract

**Endpoint:** `GET /api/public/settings`

**Required Response Fields:**
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
      "liveTvCard": { "enabled": true, "order": 20, "url": "" },
      "quickTools": { "enabled": true, "order": 30 },
      "snapshots": { "enabled": true, "order": 40 },
      "appPromo": { "enabled": true, "order": 10 },
      "footer": { "enabled": true, "order": 20 }
    },
    "tickers": {
      "breaking": { "enabled": true, "speedSeconds": 18, "showWhenEmpty": true },
      "live": { "enabled": true, "speedSeconds": 24, "showWhenEmpty": true }
    },
    "breakingMode": "auto",
    "footerText": null,
    "languageTheme": { "lang": "en", "themeId": "aurora" }
  }
}
```

**Alternate Legacy Format (also supported):**
```json
{
  "ok": true,
  "settings": {
    "ui": {
      "showBreakingTicker": true,
      "showLiveUpdatesTicker": true,
      "showLiveTvCard": false
    },
    "breakingMode": "auto",
    "liveTickerOn": true,
    "breakingSpeedSec": 18,
    "liveSpeedSec": 24
  }
}
```

Frontend normalizes both shapes automatically.

## Troubleshooting

### "Settings not updating after publish"
- Clear browser cache: Ctrl+Shift+R
- Check Network tab: `/api/public/settings` should return 200
- Verify backend logs show successful publish

### "Settings drawer still visible"
- Check `.env.local`: Remove `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER` line
- Restart Next.js: `npm run dev`

### "Modules rendering in wrong order"
- Check published settings: Each module needs an `order` field
- Lower numbers render first (10 before 20)

### "Footer text not overriding"
- Check backend response: `published.footerText` must be a non-empty string
- Empty string or null will use i18n default

---

**Status:** ✅ Production Ready  
**Implementation Date:** January 7, 2026  
**Backend URL:** Set via `NEXT_PUBLIC_API_BASE`  
**Frontend URL:** http://localhost:3000 (dev) | https://newspulse.vercel.app (prod)
