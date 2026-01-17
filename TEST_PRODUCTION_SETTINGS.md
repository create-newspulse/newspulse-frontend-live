# Production Settings Test - Public Frontend

## ✅ Current Implementation Status

### Settings UI Visibility
- **Settings Icon in Header:** HIDDEN (gated by `showLocalSettingsUi`)
- **Settings Drawer:** HIDDEN (not rendered when flag is false)
- **localStorage Writes:** BLOCKED (only when `enablePublicSettingsDrawer=true`)

### Environment Configuration
```bash
# .env.local (production)
# NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER is NOT set
# Default: false → Settings UI hidden

# .env.example (for developers)
NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER=false
```

### Settings Source
- **Production:** Backend published settings only (`GET /api/public/settings`)
- **Fallback:** Safe defaults if backend unavailable
- **No localStorage:** Public users cannot save preferences

## How to Test

### 1. Verify Settings UI is Hidden
```bash
# Start dev server
npm run dev

# Visit http://localhost:3000
# ✅ Expected: NO settings icon in top-right header
# ✅ Expected: NO settings drawer anywhere
# ✅ Expected: Console shows successful fetch from /api/public/settings
```

### 2. Verify Settings are Applied from Backend
```bash
# Open browser DevTools → Network tab
# Visit http://localhost:3000
# Look for request: GET /api/public/settings
# ✅ Expected: 200 OK with JSON response

# Example response:
{
  "ok": true,
  "settings": {
    "modules": {
      "liveTvCard": { "enabled": true, "order": 20, "url": "..." }
    },
    "tickers": {
      "breaking": { "enabled": true, "speedSeconds": 18 }
    }
  }
}
```

### 3. Test Admin Panel Integration
```bash
# Step 1: Open Admin Panel
# Navigate to: Site Settings → Public Settings

# Step 2: Toggle Live TV OFF
# Click "Publish"

# Step 3: Refresh Frontend
# Visit: http://localhost:3000
# ✅ Expected: Live TV widget HIDDEN

# Step 4: Toggle Live TV ON
# Click "Publish"

# Step 5: Refresh Frontend
# ✅ Expected: Live TV widget VISIBLE
```

### 4. Verify No localStorage Pollution
```bash
# Open DevTools → Application → Local Storage
# Look for key: newspulse.ui.v14_5_3.prefs
# ✅ Expected: Key should NOT exist (or be empty)

# If key exists, it's from previous dev testing
# To verify it's not being written:
# 1. Delete the key manually
# 2. Refresh page
# 3. Check again
# ✅ Expected: Key still doesn't exist
```

### 5. Test Fallback Behavior
```bash
# Simulate backend failure:
# 1. Edit .env.local:
NEXT_PUBLIC_API_BASE=http://localhost:9999

# 2. Restart dev server: npm run dev
# 3. Visit homepage

# ✅ Expected: Page loads with default settings
# ✅ Expected: All modules visible (safe defaults)
# ✅ Expected: No errors, graceful fallback

# 4. Restore correct backend URL
NEXT_PUBLIC_API_BASE=https://YOUR_PROD_BACKEND_DOMAIN

# 5. Restart server
```

## Code Verification

### Settings Icon Gating (pages/index.tsx:2415)
```tsx
{showLocalSettingsUi ? (
  <IconButton theme={theme} onClick={() => setSettingsOpen(true)}>
    <Settings className="h-5 w-5" />
  </IconButton>
) : null}
```
✅ Only renders when `showLocalSettingsUi=true`

### showLocalSettingsUi Logic (pages/index.tsx:2218)
```tsx
const showLocalSettingsUi = enablePublicSettingsDrawer && settingsSource === 'local';
```
✅ Requires BOTH:
- `enablePublicSettingsDrawer=true` (from env)
- `settingsSource='local'` (manual override)

### enablePublicSettingsDrawer Logic (pages/index.tsx:2092)
```tsx
const enablePublicSettingsDrawer = 
  String(process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER || '')
    .toLowerCase() === 'true';
```
✅ Defaults to `false` if env var not set

### localStorage Gating (pages/index.tsx:2189-2192)
```tsx
React.useEffect(() => {
  if (!enablePublicSettingsDrawer) return;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, JSON.stringify(normalizePrefs(prefs)));
}, [prefs, enablePublicSettingsDrawer]);
```
✅ Only writes when `enablePublicSettingsDrawer=true`

### Settings Drawer Rendering (pages/index.tsx:2544)
```tsx
{showLocalSettingsUi ? (
  <PreferencesDrawer theme={theme} open={settingsOpen} ... />
) : null}
```
✅ Only renders when `showLocalSettingsUi=true`

## Production Deployment Checklist

Before deploying to production:

- [x] Verify `.env.production` or Vercel env vars do NOT set `NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER`
- [x] Test homepage loads without settings icon
- [x] Verify `/api/public/settings` returns 200 from backend
- [x] Test Admin Panel → Publish → Frontend refresh flow
- [x] Confirm localStorage is NOT written to
- [x] Test fallback behavior (backend down scenario)

## Browser Console Checks

### Expected Logs (Production)
```
✅ PublicSettingsContext: Fetching settings...
✅ PublicSettingsContext: Settings loaded successfully
✅ Modules rendered: 8 enabled
```

### NOT Expected (Production)
```
❌ Settings loaded from localStorage
❌ Settings saved to localStorage
❌ Dev mode: Settings drawer enabled
```

## Visual Confirmation

### Production UI Should Show:
- ✅ Language picker (top-right)
- ✅ Theme picker (top-right)
- ❌ Settings icon (should NOT be visible)

### Dev UI (with flag enabled) Shows:
- ✅ Language picker
- ✅ Theme picker
- ✅ Settings icon (gear/cog)

## Acceptance Criteria

All criteria met:
- [x] No settings UI visible to public users
- [x] Settings icon hidden in header
- [x] Settings drawer not rendered
- [x] localStorage not written in production mode
- [x] Backend settings fetched on app load
- [x] Settings applied to all modules/tickers/footer
- [x] Admin Panel publish → Frontend refresh flow works
- [x] Safe defaults used if backend fails
- [x] Network shows `GET /api/public/settings` with 200 status

---

**Implementation Date:** January 8, 2026  
**Status:** ✅ Production Ready  
**Backend URL:** Set via `NEXT_PUBLIC_API_BASE`  
**Frontend URL:** http://localhost:3000 (dev) | https://newspulse.vercel.app (prod)
