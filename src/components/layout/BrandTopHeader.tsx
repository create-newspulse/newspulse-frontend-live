import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Menu } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageProvider';
import { usePublicSettings } from '../../context/PublicSettingsContext';
import { hasStoredConsentForCategory } from '../../consent/cookieConsent';
import { useLanguage, type NewsPulseLanguage } from '../../../utils/LanguageContext';
import { useTheme, type ThemeMode } from '../../../utils/ThemeContext';
import { usePublicFounderToggles } from '../../../hooks/usePublicFounderToggles';
import HeaderLogo from './HeaderLogo';
import SharedMobileNavigationDrawer from './SharedMobileNavigationDrawer';

export type BrandTopHeaderProps = {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
};

const STYLE_STORAGE_KEY = 'np_style';

type HeaderThemeId = 'aurora' | 'midnight';
type HeaderTheme = {
  id: HeaderThemeId;
  name: string;
  mode: ThemeMode;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  sub: string;
  muted: string;
  chipHover: string;
  accent: string;
};

const HEADER_THEMES: HeaderTheme[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    mode: 'light',
    surface: 'rgba(255,255,255,0.92)',
    surface2: 'rgba(255,255,255,0.72)',
    border: 'rgba(15,23,42,0.10)',
    text: '#0b1220',
    sub: 'rgba(15,23,42,0.72)',
    muted: 'rgba(15,23,42,0.52)',
    chipHover: 'rgba(15,23,42,0.075)',
    accent: '#2563eb',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    surface: 'rgba(15,23,42,0.92)',
    surface2: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.13)',
    text: 'rgba(255,255,255,0.96)',
    sub: 'rgba(255,255,255,0.72)',
    muted: 'rgba(255,255,255,0.58)',
    chipHover: 'rgba(255,255,255,0.11)',
    accent: '#38bdf8',
  },
];

const HEADER_LANG_OPTIONS: Array<{ code: NewsPulseLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
];

function getHeaderTheme(themeId: string): HeaderTheme {
  return HEADER_THEMES.find((theme) => theme.id === themeId) || HEADER_THEMES[0];
}

function readSavedStyleId(): HeaderThemeId | null {
  if (typeof window === 'undefined') return null;
  if (!hasStoredConsentForCategory('preferences')) return null;
  try {
    const raw = String(window.localStorage.getItem(STYLE_STORAGE_KEY) || '').trim().toLowerCase();
    return raw === 'midnight' ? 'midnight' : raw === 'aurora' ? 'aurora' : null;
  } catch {
    return null;
  }
}

function writeSavedStyleId(themeId: HeaderThemeId) {
  if (typeof window === 'undefined') return;
  if (!hasStoredConsentForCategory('preferences')) return;
  try {
    window.localStorage.setItem(STYLE_STORAGE_KEY, themeId);
  } catch {}
}

function normalizeLangCode(raw: unknown): NewsPulseLanguage | null {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'en' || value === 'hi' || value === 'gu' ? value : null;
}

function HeaderLanguagePicker({ theme }: { theme: HeaderTheme }) {
  const { t } = useI18n();
  const { language, setLanguage } = useLanguage();
  const { settings } = usePublicSettings();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const options = React.useMemo(() => {
    const raw = (settings as any)?.languageTheme?.languages;
    if (!Array.isArray(raw) || !raw.length) return HEADER_LANG_OPTIONS;
    const available = Array.from(new Set(raw.map(normalizeLangCode).filter(Boolean))) as NewsPulseLanguage[];
    const mapped = available
      .map((code) => HEADER_LANG_OPTIONS.find((option) => option.code === code))
      .filter(Boolean) as Array<{ code: NewsPulseLanguage; label: string }>;
    return mapped.length ? mapped : HEADER_LANG_OPTIONS;
  }, [settings]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const element = wrapRef.current;
      if (!element) return;
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = options.find((option) => option.code === language) || HEADER_LANG_OPTIONS[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Language"
        title="Language"
        className="inline-flex min-h-10 max-w-[44vw] items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold sm:max-w-none"
        style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
      >
        <span className="hidden md:inline">{t('common.language')}</span>
        <span className="truncate font-extrabold">{current.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: theme.muted }} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="absolute right-0 z-[120] mt-2 w-48 overflow-hidden rounded-3xl border shadow-xl"
            style={{ background: theme.surface, borderColor: theme.border }}
          >
            <div className="p-2">
              {options.map((option) => {
                const active = option.code === language;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      setLanguage(option.code);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold"
                    style={{
                      background: active ? theme.chipHover : theme.surface2,
                      borderColor: active ? theme.accent : theme.border,
                      color: theme.text,
                    }}
                  >
                    <span>{option.label}</span>
                    {active ? <Check className="h-4 w-4" style={{ color: theme.accent }} /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HeaderThemePicker({ theme, themeId, setThemeId }: { theme: HeaderTheme; themeId: HeaderThemeId; setThemeId: (themeId: HeaderThemeId) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const current = getHeaderTheme(themeId);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const element = wrapRef.current;
      if (!element) return;
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Style"
        title="Style"
        className="inline-flex min-h-10 max-w-[44vw] items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold sm:max-w-none"
        style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
      >
        <span className="hidden md:inline">{t('common.style')}</span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border" style={{ background: current.accent, borderColor: theme.border }} />
          <span className="truncate font-extrabold">{current.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: theme.muted }} />
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="absolute right-0 z-[120] mt-2 w-56 overflow-hidden rounded-3xl border shadow-xl"
            style={{ background: theme.surface, borderColor: theme.border }}
          >
            <div className="p-2">
              {HEADER_THEMES.map((option) => {
                const active = option.id === themeId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setThemeId(option.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold"
                    style={{
                      background: active ? theme.chipHover : theme.surface2,
                      borderColor: active ? theme.accent : theme.border,
                      color: theme.text,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border" style={{ background: option.accent, borderColor: theme.border }} />
                      {option.name}
                    </span>
                    {active ? <Check className="h-4 w-4" style={{ color: theme.accent }} /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function BrandTopHeader({ showMenuButton = true, onMenuClick }: BrandTopHeaderProps) {
  const { setMode } = useTheme();
  const { toggles: founderToggles } = usePublicFounderToggles();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [themeId, setThemeIdState] = React.useState<HeaderThemeId>('aurora');
  const theme = React.useMemo(() => getHeaderTheme(themeId), [themeId]);

  React.useEffect(() => {
    const saved = readSavedStyleId();
    if (!saved) return;
    setThemeIdState(saved);
    setMode(getHeaderTheme(saved).mode);
  }, [setMode]);

  const setThemeId = React.useCallback((next: HeaderThemeId) => {
    setThemeIdState(next);
    writeSavedStyleId(next);
    setMode(getHeaderTheme(next).mode);
  }, [setMode]);

  const openMenu = React.useCallback(() => {
    if (onMenuClick) {
      onMenuClick();
      return;
    }
    setMenuOpen(true);
  }, [onMenuClick]);

  return (
    <div data-news-pulse-top-header="true" className="np-public-top-header pt-4">
      <div className="w-full rounded-3xl border p-3 shadow-[0_18px_70px_-60px_rgba(0,0,0,0.40)]" style={{ background: theme.surface, borderColor: theme.border }}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center" style={{ gap: 12 }}>
        {showMenuButton ? (
          <button
            type="button"
                onClick={openMenu}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
            aria-label="Menu"
                title="Menu"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
          >
                <Menu className="h-5 w-5" />
          </button>
        ) : null}

        <HeaderLogo />
      </div>

          <div className="ml-auto flex min-w-0 basis-full items-center justify-end gap-2 sm:basis-auto">
            <HeaderLanguagePicker theme={theme} />
            <HeaderThemePicker theme={theme} themeId={themeId} setThemeId={setThemeId} />
          </div>
        </div>
      </div>

      <SharedMobileNavigationDrawer open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} founderToggles={founderToggles} />
      <style jsx>{`
        .np-public-top-header {
          box-sizing: border-box;
          width: min(calc(100% - 48px), 1480px);
          margin-left: auto;
          margin-right: auto;
        }
        @media (max-width: 1280px) {
          .np-public-top-header {
            width: min(calc(100% - 32px), 100%);
          }
        }
      `}</style>
    </div>
  );
}
