import React from 'react';

import { useI18n } from '../src/i18n/LanguageProvider';

export default function OriginalTag({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={
        `inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/70 ${className}`.trim()
      }
      title={t('content.original')}
    >
      {t('content.original')}
    </span>
  );
}
