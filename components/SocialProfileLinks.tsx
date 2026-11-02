import React from 'react';
import { SOCIAL_PROFILES, type SocialProfile } from '../src/config/socialProfiles';
import { useI18n } from '../src/i18n/LanguageProvider';

type SocialProfileLinksProps = {
  variant: 'card' | 'footer';
  profiles?: readonly SocialProfile[];
  style?: React.CSSProperties;
  linkStyle?: React.CSSProperties;
};

export default function SocialProfileLinks({ variant, profiles = SOCIAL_PROFILES, style, linkStyle }: SocialProfileLinksProps) {
  const { t } = useI18n();
  const visibleProfiles = profiles.filter((profile) => profile.enabled);
  if (!visibleProfiles.length) return null;

  const isFooter = variant === 'footer';

  return (
    <section
      aria-label={t('social.followTitle')}
      className={isFooter ? 'mt-6' : 'min-w-0 rounded-[28px] border p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.30)]'}
      style={style}
    >
      {!isFooter ? <h2 className="mb-3 text-sm font-black tracking-tight">{t('social.followTitle')}</h2> : null}
      <ul className={isFooter ? 'flex flex-wrap items-center gap-3' : 'grid grid-cols-2 gap-2'}>
        {visibleProfiles.map(({ id, label, url, icon: Icon }) => {
          const accessibleLabel = t('social.followOn', { platform: label });
          return (
            <li key={id} className="min-w-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={accessibleLabel}
                title={accessibleLabel}
                className={`flex items-center justify-center rounded-2xl border transition hover:opacity-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${isFooter ? 'h-12 w-12' : 'min-h-[44px] gap-2 px-3 py-2 text-xs font-semibold'}`}
                style={linkStyle}
              >
                <Icon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                {!isFooter ? <span className="min-w-0 break-words">{label}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
