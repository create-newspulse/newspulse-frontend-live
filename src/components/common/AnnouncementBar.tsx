import React, { useEffect, useState } from 'react';

export type AnnouncementBarProps = {
  className?: string;
};

// LocalStorage key for dismissal persistence
const DISMISS_KEY = 'np_preview_notice_dismissed_v1';

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ className }) => {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Client-side check for persisted dismissal
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (v === '1') setDismissed(true);
    } catch {}
    setMounted(true);
  }, []);

  const handleClose = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  if (!mounted) {
    // Avoid SSR hydration mismatch; render placeholder height if needed
    return <div className="h-0" aria-hidden="true" />;
  }
  if (dismissed) return null;

  return (
    <section
      role="status"
      aria-label="Site announcement"
      className={`
        w-full border-b border-slate-300 dark:border-slate-700
        bg-slate-900 text-slate-50 dark:bg-slate-800/90 backdrop-blur
        px-4 py-2 text-sm
        flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-4
        ${className || ''}`.replace(/\s+/g,' ').trim()}
    >
      <div className="flex items-start md:items-center gap-2">
        <span className="text-lg md:text-base" aria-hidden="true">✨</span>
        <div className="leading-snug">
          <strong className="font-semibold block md:inline">News Pulse – Preview Edition</strong>
          <span className="block md:inline md:ml-2 text-[13px] md:text-sm text-slate-200">
            You’re viewing the preview edition of News Pulse. Some sections and features are still being refined and new updates are rolling out step by step.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-auto">
        <a
          href="/about"
          className="text-xs md:text-sm font-medium text-sky-300 hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
        >
          Learn more
        </a>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss announcement"
          className="text-slate-300 hover:text-white text-sm px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          ×
        </button>
      </div>
    </section>
  );
};

export default AnnouncementBar;
