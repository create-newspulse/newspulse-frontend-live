import React from 'react';
import { Facebook, Link2, Linkedin, MessageCircle, Share2 } from 'lucide-react';
import { XProfileIcon } from '../src/config/socialProfiles';
import { useI18n } from '../src/i18n/LanguageProvider';
import { useOptionalCookieConsent } from '../src/consent/CookieConsentProvider';

type ArticleShareBarProps = {
  url: string;
  title: string;
};

export default function ArticleShareBar({ url, title }: ArticleShareBarProps) {
  const { t } = useI18n();
  const consent = useOptionalCookieConsent();
  const [feedback, setFeedback] = React.useState<'copied' | 'error' | null>(null);
  const canFloat = !consent || (consent.hasDecision && !consent.isPreferencesOpen);
  const links = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, Icon: MessageCircle, colour: '#15803d' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, Icon: Facebook, colour: '#1877f2' },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, Icon: XProfileIcon, colour: '#102a43' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: Linkedin, colour: '#0a66c2' },
  ];

  React.useEffect(() => setFeedback(null), [url]);

  const copyLink = async () => {
    setFeedback(null);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('copied');
    } catch {
      setFeedback('error');
    }
  };

  const shareThis = async () => {
    setFeedback(null);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
    await copyLink();
  };

  return (
    <div className="np-article-share" role="group" aria-label={t('articleShare.label')} data-floating={canFloat}>
      <div className="np-article-share__actions">
        {links.map(({ name, href, Icon, colour }) => (
          <a
            key={name}
            className="np-article-share__action"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('articleShare.shareOn', { platform: name })}
            title={t('articleShare.shareOn', { platform: name })}
          >
            <Icon width={20} height={20} style={{ color: colour }} aria-hidden="true" focusable="false" />
            <span className="np-article-share__text">{name}</span>
          </a>
        ))}
        <button type="button" className="np-article-share__action" onClick={copyLink} aria-label={t('articleShare.copyLink')} title={t('articleShare.copyLink')}>
          <Link2 size={20} aria-hidden="true" focusable="false" />
          <span className="np-article-share__text">{t('articleShare.copyLink')}</span>
        </button>
        <button type="button" className="np-article-share__action np-article-share__native" onClick={shareThis} aria-label={t('articleShare.nativeShare')} title={t('articleShare.nativeShare')}>
          <Share2 size={20} aria-hidden="true" focusable="false" />
          <span className="np-article-share__text">{t('common.share')}</span>
        </button>
      </div>
      <p className="np-article-share__feedback" role={feedback === 'error' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">
        {feedback ? t(`articleShare.${feedback}`) : ''}
      </p>
      <style jsx>{`
        .np-article-share {
          position: relative;
          max-width: 100%;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          color: #102a43;
        }

        .np-article-share__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
        }

        .np-article-share__action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          gap: 6px;
          min-width: 44px;
          min-height: 44px;
          padding: 8px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.4;
          text-decoration: none;
          cursor: pointer;
        }

        .np-article-share__action:hover {
          background: #f1f5f9;
        }

        .np-article-share__action:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .np-article-share__native {
          background: #eff6ff;
          color: #2563eb;
        }

        .np-article-share__feedback {
          margin: 4px 4px 0;
          font-size: 12px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .np-article-share__feedback:empty {
          margin: 0;
        }

        .np-article-share__feedback[role='alert'] {
          color: #b91c1c;
        }

        @media (max-width: 767px) {
          .np-article-share[data-floating='true'] {
            position: fixed;
            z-index: 40;
            inset-inline: max(8px, env(safe-area-inset-left, 0px)) max(8px, env(safe-area-inset-right, 0px));
            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            width: auto;
            max-width: 416px;
            margin-inline: auto;
            box-shadow: 0 8px 30px rgb(16 42 67 / 18%);
          }

          .np-article-share__actions {
            justify-content: space-between;
          }

          .np-article-share[data-floating='true'] .np-article-share__actions {
            flex-wrap: nowrap;
          }

          .np-article-share__action {
            padding: 8px;
          }

          .np-article-share__text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
