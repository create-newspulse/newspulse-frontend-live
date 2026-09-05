import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BookOpen,
  Briefcase,
  ChevronRight,
  Cpu,
  Flag,
  Flame,
  Globe,
  GraduationCap,
  Home,
  Leaf,
  MapPin,
  PenLine,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/LanguageProvider';
import { useLanguage, type NewsPulseLanguage } from '../../../utils/LanguageContext';
import { DEFAULT_PUBLIC_FOUNDER_TOGGLES, type PublicFounderToggles } from '../../../lib/publicFounderToggles';

type SharedDrawerTheme = {
  mode?: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  sub: string;
};

type SharedMobileNavigationDrawerProps = {
  open: boolean;
  onClose: () => void;
  theme: SharedDrawerTheme;
  activeCategoryKey?: string;
  onCategoryPick?: (key: string) => void;
  founderToggles?: PublicFounderToggles;
  lang?: NewsPulseLanguage;
};

const MENU_QUICK_THEME: Record<'home' | 'videos' | 'search', { base: string; hover: string; ring: string }> = {
  home: {
    base: 'bg-gradient-to-r from-sky-50 to-indigo-50 border-sky-200 text-sky-700',
    hover: 'hover:from-sky-100 hover:to-indigo-100 hover:border-sky-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-sky-300/50',
  },
  videos: {
    base: 'bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200 text-emerald-700',
    hover: 'hover:from-emerald-100 hover:to-lime-100 hover:border-emerald-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-emerald-300/50',
  },
  search: {
    base: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-800',
    hover: 'hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-amber-300/50',
  },
};

const CATEGORY_THEME: Record<string, { icon: string; ring: string }> = {
  breaking: { icon: 'bg-newsPulse-red/10 border-newsPulse-red/25 text-newsPulse-red', ring: 'focus-visible:ring-2 focus-visible:ring-newsPulse-red/30' },
  regional: { icon: 'bg-emerald-100 border-emerald-200 text-emerald-700', ring: 'focus-visible:ring-2 focus-visible:ring-emerald-300/50' },
  national: { icon: 'bg-orange-100 border-orange-200 text-orange-700', ring: 'focus-visible:ring-2 focus-visible:ring-orange-300/50' },
  international: { icon: 'bg-purple-100 border-purple-200 text-purple-700', ring: 'focus-visible:ring-2 focus-visible:ring-purple-300/50' },
  business: { icon: 'bg-blue-100 border-blue-200 text-blue-700', ring: 'focus-visible:ring-2 focus-visible:ring-blue-300/50' },
  'science-technology': { icon: 'bg-cyan-100 border-cyan-200 text-cyan-700', ring: 'focus-visible:ring-2 focus-visible:ring-cyan-300/50' },
  sports: { icon: 'bg-green-100 border-green-200 text-green-700', ring: 'focus-visible:ring-2 focus-visible:ring-green-300/50' },
  lifestyle: { icon: 'bg-pink-100 border-pink-200 text-pink-700', ring: 'focus-visible:ring-2 focus-visible:ring-pink-300/50' },
  glamour: { icon: 'bg-rose-100 border-rose-200 text-rose-700', ring: 'focus-visible:ring-2 focus-visible:ring-rose-300/50' },
  'web-stories': { icon: 'bg-slate-100 border-slate-200 text-slate-700', ring: 'focus-visible:ring-2 focus-visible:ring-slate-300/50' },
  'viral-videos': { icon: 'bg-emerald-100 border-emerald-200 text-emerald-700', ring: 'focus-visible:ring-2 focus-visible:ring-emerald-300/50' },
  editorial: { icon: 'bg-indigo-100 border-indigo-200 text-indigo-700', ring: 'focus-visible:ring-2 focus-visible:ring-indigo-300/50' },
  youth: { icon: 'bg-sky-100 border-sky-200 text-sky-700', ring: 'focus-visible:ring-2 focus-visible:ring-sky-300/50' },
  inspiration: { icon: 'bg-teal-100 border-teal-200 text-teal-700', ring: 'focus-visible:ring-2 focus-visible:ring-teal-300/50' },
  community: { icon: 'bg-orange-100 border-orange-200 text-orange-700', ring: 'focus-visible:ring-2 focus-visible:ring-orange-300/50' },
  __default: { icon: 'bg-slate-100 border-slate-200 text-slate-700', ring: 'focus-visible:ring-2 focus-visible:ring-slate-300/50' },
};

const CATEGORIES = [
  { key: 'breaking', routeKey: 'breaking', labelKey: 'categories.breaking', href: '/breaking', Icon: Flame },
  { key: 'regional', routeKey: 'regional', labelKey: 'categories.regional', href: '/regional/gujarat', Icon: MapPin },
  { key: 'national', routeKey: 'national', labelKey: 'categories.national', href: '/national', Icon: Flag },
  { key: 'international', routeKey: 'international', labelKey: 'categories.international', href: '/international', Icon: Globe },
  { key: 'business', routeKey: 'business', labelKey: 'categories.business', href: '/business', Icon: Briefcase },
  { key: 'science-technology', routeKey: 'science-technology', labelKey: 'categories.scienceTechnology', href: '/science-technology', Icon: Cpu },
  { key: 'sports', routeKey: 'sports', labelKey: 'categories.sports', href: '/sports', Icon: Trophy },
  { key: 'lifestyle', routeKey: 'lifestyle', labelKey: 'categories.lifestyle', href: '/lifestyle', Icon: Leaf },
  { key: 'glamour', routeKey: 'glamour', labelKey: 'categories.glamour', href: '/glamour', Icon: Sparkles },
  { key: 'web-stories', routeKey: 'web-stories', labelKey: 'categories.webStories', href: '/web-stories', Icon: BookOpen },
  { key: 'viral-videos', routeKey: 'viral-videos', labelKey: 'categories.viralVideos', href: '/viral-videos', Icon: Video },
  { key: 'editorial', routeKey: 'editorial', labelKey: 'categories.editorial', href: '/editorial', Icon: PenLine },
  { key: 'youth', routeKey: 'youth-pulse', labelKey: 'categories.youthPulse', href: '/youth-pulse', Icon: GraduationCap, badge: 'NEW' },
  { key: 'inspiration', routeKey: 'inspiration-hub', labelKey: 'categories.inspirationHub', href: '/inspiration-hub', Icon: Sparkles },
  { key: 'community', routeKey: 'community-reporter', labelKey: 'categories.communityReporter', href: '/community-reporter', Icon: Users },
] as const;

const LANGUAGE_ITEMS = [
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'Hindi' },
  { key: 'gu', label: 'Gujarati' },
] as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function stripLocalePrefix(path: string): string {
  const raw = String(path || '/');
  const beforeHash = raw.split('#')[0] || '/';
  const beforeQuery = beforeHash.split('?')[0] || '/';
  const normalized = beforeQuery.startsWith('/') ? beforeQuery : `/${beforeQuery}`;
  const withoutPrefix = normalized.replace(/^\/(en|hi|gu)(?=\/|$)/i, '');
  return withoutPrefix || '/';
}

function activeCategoryFromPath(path: string): string {
  const unprefixed = stripLocalePrefix(path).toLowerCase().replace(/\/+$/, '') || '/';
  const first = unprefixed.split('/').filter(Boolean)[0] || '';
  if (first === 'regional') return 'regional';
  if (first === 'youth-pulse') return 'youth';
  if (first === 'inspiration-hub') return 'inspiration';
  if (first === 'community-reporter') return 'community';
  return first;
}

function localizePath(path: string, lang: NewsPulseLanguage) {
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '/')}`;
  return lang === 'en' ? normalized : `/${lang}${normalized === '/' ? '' : normalized}`;
}

function localizedBreakingHref(tab: 'breaking' | 'live', lang: NewsPulseLanguage) {
  return `${localizePath('/breaking', lang)}?tab=${encodeURIComponent(tab)}`;
}

function visibleCategories(founderToggles: PublicFounderToggles) {
  return CATEGORIES.filter((category) => {
    if (category.key === 'community' && founderToggles.communityReporterClosed) return false;
    if (category.key === 'viral-videos' && founderToggles.viralVideosFrontendEnabled === false) return false;
    return true;
  });
}

function Surface({ theme, className, children }: { theme: SharedDrawerTheme; className?: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-3xl border shadow-[0_18px_70px_-60px_rgba(0,0,0,0.40)]', className)} style={{ background: theme.surface, borderColor: theme.border }}>
      {children}
    </div>
  );
}

function IconButton({ theme, onClick, label, children }: { theme: SharedDrawerTheme; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
      style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
    >
      {children}
    </button>
  );
}

export default function SharedMobileNavigationDrawer({
  open,
  onClose,
  theme,
  activeCategoryKey,
  onCategoryPick,
  founderToggles = DEFAULT_PUBLIC_FOUNDER_TOGGLES,
  lang: langProp,
}: SharedMobileNavigationDrawerProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { language, setLanguage } = useLanguage();
  const lang = langProp || language || 'en';
  const currentPath = stripLocalePrefix(router.asPath || '/');
  const activeKey = activeCategoryKey || activeCategoryFromPath(currentPath);
  const viralVideosFrontendEnabled = founderToggles.viralVideosFrontendEnabled !== false;

  React.useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnRouteChange = () => onClose();

    document.body.style.overflow = 'hidden';
    router.events.on('routeChangeStart', closeOnRouteChange);

    return () => {
      router.events.off('routeChangeStart', closeOnRouteChange);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open, router.events]);

  const topActions = [
    { key: 'home', label: t('common.home'), href: localizePath('/', lang), Icon: Home, themeKey: 'home' as const, active: currentPath === '/' },
    { key: 'videos', label: t('common.videos'), href: localizePath('/viral-videos', lang), Icon: Video, themeKey: 'videos' as const, active: currentPath.startsWith('/viral-videos'), hidden: !viralVideosFrontendEnabled },
    { key: 'search', label: t('common.search'), href: localizePath('/search', lang), Icon: Search, themeKey: 'search' as const, active: currentPath.startsWith('/search') },
  ].filter((item) => !item.hidden);

  const quickAccess = [
    { key: 'latest', label: `${t('home.latest')} News`, href: localizePath('/latest', lang), Icon: Bell },
    { key: 'breaking', label: 'Breaking News', href: localizedBreakingHref('breaking', lang), Icon: Flame },
    { key: 'live', label: 'Live Updates', href: localizedBreakingHref('live', lang), Icon: Radio },
    { key: 'top-stories', label: 'Top Stories', href: `${localizePath('/', lang)}#top-story`, Icon: Flag },
    { key: 'advertise', label: t('footer.advertiseWithUs'), href: localizePath('/advertise-with-us', lang), Icon: Briefcase },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 h-dvh overflow-hidden"
            onClick={onClose}
            style={{ background: 'rgba(0,0,0,0.35)' }}
          />
          <motion.div
            initial={{ x: -420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed inset-y-0 left-0 z-[60] h-dvh w-[420px] max-w-[92vw]"
          >
            <div className="flex h-full p-3">
              <Surface theme={theme} className="flex min-h-0 w-full flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.border }}>
                  <div className="text-sm font-extrabold" style={{ color: theme.text }}>
                    {t('common.menu')}
                  </div>
                  <IconButton theme={theme} onClick={onClose} label="Close">
                    <X className="h-5 w-5" />
                  </IconButton>
                </div>

                <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
                  <div className="grid gap-5">
                    <div className="grid gap-3">
                      <div className="grid grid-cols-3 gap-2" data-shared-drawer-shortcuts="true">
                        {topActions.map((item) => {
                          const quickTheme = MENU_QUICK_THEME[item.themeKey];

                          return (
                            <Link
                              key={item.key}
                              href={item.href}
                              onClick={onClose}
                              className={cx(
                                'inline-flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-xs font-bold transition-all duration-200 focus-visible:outline-none',
                                quickTheme.base,
                                quickTheme.hover,
                                quickTheme.ring,
                                item.active && 'ring-2 ring-offset-0'
                              )}
                            >
                              <item.Icon className="h-4 w-4" />
                              <span className="leading-tight">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>

                      <div className="rounded-[26px] border p-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
                        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: theme.sub }}>
                          Quick Access
                        </div>
                        <div className="grid gap-2">
                          {quickAccess.map((item) => (
                            <Link
                              key={item.key}
                              href={item.href}
                              onClick={onClose}
                              className="inline-flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-white/60"
                              style={{ borderColor: theme.border, color: theme.text, background: theme.surface }}
                            >
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: theme.border, background: theme.surface2 }}>
                                <item.Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{item.label}</span>
                              <ChevronRight className="ml-auto h-4 w-4" style={{ color: theme.sub }} />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[26px] border p-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: theme.sub }}>
                        <Globe className="h-4 w-4" />
                        {t('common.categories')}
                      </div>

                      <div className="grid gap-2" data-shared-drawer-categories="true">
                        {visibleCategories(founderToggles).map((category) => {
                          const tone = CATEGORY_THEME[category.key] || CATEGORY_THEME.__default;
                          const active = activeKey === category.key || activeKey === category.routeKey;
                          const label = t(category.labelKey);

                          return (
                            <Link
                              key={category.key}
                              href={localizePath(category.href, lang)}
                              onClick={() => {
                                onCategoryPick?.(category.key);
                                onClose();
                              }}
                            >
                              <div
                                data-drawer-category-key={category.key}
                                data-active={active ? 'true' : 'false'}
                                className={cx(
                                  'flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none',
                                  'bg-white/70 hover:bg-white/95',
                                  tone.ring,
                                  active && 'shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]'
                                )}
                                style={{ borderColor: active ? theme.text : theme.border, color: theme.text }}
                              >
                                <span className={cx('inline-flex h-9 w-9 items-center justify-center rounded-2xl border', tone.icon)}>
                                  <category.Icon className="h-4 w-4" />
                                </span>
                                <span className="truncate">{label}</span>
                                {'badge' in category && category.badge ? (
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]" style={{ borderColor: theme.border, color: theme.sub, background: theme.surface2 }}>
                                    {category.badge}
                                  </span>
                                ) : null}
                                <ChevronRight className="ml-auto h-4 w-4" style={{ color: theme.sub }} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[26px] border p-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
                      <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: theme.sub }}>
                        {t('common.language')}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {LANGUAGE_ITEMS.map((item) => {
                          const active = lang === item.key;
                          return (
                            <Link
                              key={item.key}
                              href={localizePath('/', item.key)}
                              onClick={() => {
                                setLanguage(item.key, { path: '/' });
                                onClose();
                              }}
                              className="inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-bold transition-colors duration-200"
                              style={{
                                borderColor: active ? theme.text : theme.border,
                                color: active ? theme.text : theme.sub,
                                background: active ? theme.surface : theme.surface2,
                              }}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}