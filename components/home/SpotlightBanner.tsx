import React from "react";

import { useLanguage } from "../../src/i18n/language";

export default function SpotlightBanner() {
  const { t } = useLanguage();

  const chips = [
    t('categories.breaking'),
    t('categories.regional'),
    t('categories.national'),
    t('categories.international'),
    t('categories.business'),
    t('categories.scienceTechnology'),
  ].join(' • ');

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/35 backdrop-blur px-4 py-3 shadow-sm">
      <div className="min-h-[56px] md:min-h-[72px] flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <span className="text-[11px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            AD
          </span>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <div className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {t('brand.name')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t('brand.tagline')}
              </div>
            </div>

            <div className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
              {chips}
            </div>
          </div>
        </div>

        <a
          href="mailto:newspulse.ads@gmail.com?subject=Advertise%20on%20News%20Pulse"
          className="shrink-0 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold border border-slate-200 bg-white/90 text-slate-900 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-900/60"
        >
          {t('common.advertiseHere')}
        </a>
      </div>
    </div>
  );
}
