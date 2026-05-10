import React from 'react';
import HeaderLogo from './HeaderLogo';

export type SimpleTopHeaderProps = {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
};

export default function SimpleTopHeader({ showMenuButton = false, onMenuClick }: SimpleTopHeaderProps) {
  return (
    <div className="w-full border-b border-newsPulse-slate/25 bg-newsPulse-white">
      <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-3 md:px-6" style={{ gap: 12 }}>
        {showMenuButton ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-newsPulse-slate/25 text-newsPulse-navy hover:bg-newsPulse-slate/10"
            aria-label="Menu"
          >
            <span aria-hidden>☰</span>
          </button>
        ) : null}

        <HeaderLogo />
      </div>
    </div>
  );
}
