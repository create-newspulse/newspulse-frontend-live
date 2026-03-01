import Link from 'next/link';
import React from 'react';

export type SimpleTopHeaderProps = {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
};

export default function SimpleTopHeader({ showMenuButton = false, onMenuClick }: SimpleTopHeaderProps) {
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        {showMenuButton ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50"
            aria-label="Menu"
          >
            <span aria-hidden>☰</span>
          </button>
        ) : null}

        <div className="min-w-0">
          <Link href="/" className="block text-base font-extrabold tracking-tight text-slate-900">
            News Pulse
          </Link>
          <div className="text-xs font-semibold text-slate-600">Your pulse on the world’s latest news</div>
        </div>
      </div>
    </div>
  );
}
