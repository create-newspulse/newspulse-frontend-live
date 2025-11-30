import React, { useEffect, useState } from 'react';
import Link from 'next/link';

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
      className={`w-full border-b border-slate-800/60 bg-slate-900 text-slate-50 backdrop-blur px-4 py-2 text-xs sm:text-sm ${className || ''}`}
    >
      <div className="mx-auto max-w-6xl flex items-start sm:items-center gap-3">
        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 leading-snug">
          <div className="font-semibold flex items-center gap-2">
            <span aria-hidden="true">✨</span>
            <span>News Pulse – Preview Edition</span>
          </div>
          <p className="text-[11px] sm:text-xs md:text-sm text-slate-200">
            You’re viewing the preview edition of News Pulse. Some sections and features are still being refined and new updates are rolling out step by step.
          </p>
        </div>
        <div className="flex items-center gap-3 pl-2">
          <Link href="/about" className="text-[11px] font-medium underline-offset-2 hover:underline text-sky-300">
            Learn more
          </Link>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Dismiss announcement"
            className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default AnnouncementBar;
