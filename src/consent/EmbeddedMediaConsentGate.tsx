import React from 'react';
import { Play, ShieldCheck } from 'lucide-react';

import { useI18n } from '../i18n/LanguageProvider';
import { useOptionalCookieConsent } from './CookieConsentProvider';
import { hasStoredConsentForCategory } from './cookieConsent';

type EmbeddedMediaConsentGateProps = {
  title?: string;
  className?: string;
  placeholderClassName?: string;
  children: React.ReactNode;
};

function useSafeLabels() {
  try {
    const { t } = useI18n();
    return {
      title: t('cookieConsent.embeddedMediaPlaceholder.title'),
      text: t('cookieConsent.embeddedMediaPlaceholder.text'),
      action: t('cookieConsent.embeddedMediaPlaceholder.action'),
    };
  } catch {
    return {
      title: 'Embedded media is blocked',
      text: 'Allow embedded media to load YouTube, YouTube Live or social embeds from third-party providers.',
      action: 'Allow Embedded Media',
    };
  }
}

export default function EmbeddedMediaConsentGate({ title, className = '', placeholderClassName = '', children }: EmbeddedMediaConsentGateProps) {
  const consentContext = useOptionalCookieConsent();
  const labels = useSafeLabels();
  const hasMediaConsent = consentContext ? consentContext.categories.embeddedMedia : hasStoredConsentForCategory('embeddedMedia');

  if (hasMediaConsent) return <>{children}</>;

  const allowMedia = () => {
    if (!consentContext) return;
    consentContext.savePreferences({
      preferences: consentContext.categories.preferences,
      analytics: consentContext.categories.analytics,
      advertising: consentContext.categories.advertising,
      embeddedMedia: true,
    });
  };

  return (
    <div className={className || 'absolute inset-0'}>
      <div className={`flex h-full w-full items-center justify-center bg-slate-950 px-4 py-6 text-center text-white ${placeholderClassName}`} data-testid="embedded-media-placeholder">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/10 text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="mt-4 text-base font-black tracking-tight">{title || labels.title}</div>
          <p className="mt-2 text-sm leading-6 text-white/72">{labels.text}</p>
          <button
            type="button"
            onClick={allowMedia}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            {labels.action}
          </button>
        </div>
      </div>
    </div>
  );
}