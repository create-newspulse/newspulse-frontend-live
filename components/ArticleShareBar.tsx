import React from 'react';
import { Link2, MoreHorizontal, Share2 } from 'lucide-react';
import { XProfileIcon } from '../src/config/socialProfiles';
import { useI18n } from '../src/i18n/LanguageProvider';
import { useOptionalCookieConsent } from '../src/consent/CookieConsentProvider';
import { FacebookShareIcon, LinkedInShareIcon, TelegramShareIcon, WhatsAppShareIcon } from './ArticleShareIcons';

type ArticleShareBarProps = {
  url: string;
  title: string;
};

export default function ArticleShareBar({ url, title }: ArticleShareBarProps) {
  const { t } = useI18n();
  const consent = useOptionalCookieConsent();
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<'copied' | 'error' | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();
  const canFloat = !consent || (consent.hasDecision && !consent.isPreferencesOpen);
  const links = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, Icon: FacebookShareIcon, colour: '#0866ff', background: '#fff', size: 44 },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, Icon: XProfileIcon, colour: '#fff', background: '#0f1419', size: 22 },
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, Icon: WhatsAppShareIcon, colour: '#fff', background: '#128c7e', size: 26 },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: LinkedInShareIcon, colour: '#fff', background: '#0a66c2', size: 24 },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, Icon: TelegramShareIcon, colour: '#26a5e4', background: '#fff', size: 44 },
  ];

  React.useEffect(() => {
    setFeedback(null);
    setOpen(false);
  }, [url]);

  React.useEffect(() => {
    if (consent?.isPreferencesOpen) setOpen(false);
  }, [consent?.isPreferencesOpen]);

  React.useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!root || !menu || !trigger) return;

    const placeMenu = () => {
      menu.style.maxHeight = '';
      root.dataset.side = 'below';
      if (window.innerWidth < 768) return;
      const bounds = trigger.getBoundingClientRect();
      const below = window.innerHeight - bounds.bottom - 20;
      const above = bounds.top - 20;
      const flip = below < menu.scrollHeight && above > below;
      root.dataset.side = flip ? 'above' : 'below';
      menu.style.maxHeight = `${Math.max(44, flip ? above : below)}px`;
    };
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.focus({ preventScroll: true });
    };

    placeMenu();
    menu.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    window.addEventListener('resize', placeMenu);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
      window.removeEventListener('resize', placeMenu);
    };
  }, [open]);

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
    <div ref={rootRef} className="np-article-share" role="group" aria-label={t('articleShare.label')} data-floating={canFloat}>
      <button
        ref={triggerRef}
        type="button"
        className="np-article-share__trigger"
        aria-label={t('articleShare.label')}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Share2 size={18} aria-hidden="true" focusable="false" />
        <span>{t('common.share')}</span>
      </button>
      <div ref={menuRef} id={menuId} className="np-article-share__menu" role="dialog" aria-label={t('articleShare.label')} hidden={!open}>
        <div className="np-article-share__brands">
          {links.map(({ name, href, Icon, colour, background, size }) => (
            <a
              key={name}
              className="np-article-share__brand"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colour, background }}
              aria-label={t('articleShare.shareOn', { platform: name })}
              title={t('articleShare.shareOn', { platform: name })}
            >
              <Icon width={size} height={size} aria-hidden="true" focusable="false" />
            </a>
          ))}
        </div>
        <button type="button" className="np-article-share__row" onClick={copyLink}>
          <Link2 size={18} aria-hidden="true" focusable="false" />
          <span>{t('articleShare.copyLink')}</span>
        </button>
        <button type="button" className="np-article-share__row" onClick={shareThis}>
          <MoreHorizontal size={20} aria-hidden="true" focusable="false" />
          <span>{t('articleShare.nativeShare')}</span>
        </button>
        <p className="np-article-share__feedback" role={feedback === 'error' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">
          {feedback ? t(`articleShare.${feedback}`) : ''}
        </p>
      </div>
      <style jsx>{`
        .np-article-share {
          position: relative;
          width: fit-content;
          max-width: 100%;
          align-self: flex-start;
          color: #102a43;
        }

        .np-article-share__trigger,
        .np-article-share__row,
        .np-article-share__brand {
          display: inline-flex;
          align-items: center;
          min-width: 44px;
          min-height: 44px;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          cursor: pointer;
        }

        .np-article-share__trigger {
          gap: 8px;
          min-height: 48px;
          padding: 10px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #fff;
          color: #1d4ed8;
        }

        .np-article-share__menu {
          position: absolute;
          z-index: 41;
          top: calc(100% + 8px);
          left: 0;
          width: 296px;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 12px 36px rgb(16 42 67 / 16%);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .np-article-share__menu[hidden] {
          display: none;
        }

        .np-article-share[data-side='above'] .np-article-share__menu {
          top: auto;
          bottom: calc(100% + 8px);
        }

        .np-article-share__brands {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          padding-block: 4px 12px;
        }

        .np-article-share__brand {
          justify-content: center;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          text-decoration: none;
        }

        .np-article-share__row {
          width: 100%;
          gap: 10px;
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: inherit;
          text-align: start;
        }

        .np-article-share__row + .np-article-share__row {
          margin-top: 4px;
        }

        .np-article-share__row:hover,
        .np-article-share__trigger:hover {
          background: #f1f5f9;
        }

        .np-article-share__brand:hover {
          opacity: .85;
        }

        .np-article-share :where(a, button):focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 3px;
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
            right: max(12px, env(safe-area-inset-right, 0px));
            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          }

          .np-article-share[data-floating='true'] .np-article-share__trigger {
            box-shadow: 0 8px 30px rgb(16 42 67 / 18%);
          }

          .np-article-share[data-floating='true'] .np-article-share__menu {
            top: auto;
            bottom: calc(100% + 8px);
            left: auto;
            right: 0;
            width: min(296px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
            max-height: calc(100dvh - 92px - env(safe-area-inset-bottom, 0px));
          }

          .np-article-share[data-floating='false'] .np-article-share__menu {
            position: static;
            max-width: 100%;
            max-height: 50dvh;
            margin-top: 8px;
          }

        }
      `}</style>
    </div>
  );
}
