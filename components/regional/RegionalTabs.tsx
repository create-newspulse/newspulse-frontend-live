import React from 'react';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export type RegionalTabKey = 'Feed' | 'Districts' | 'Civic' | 'Map';

export type RegionalTabsProps = {
  value: RegionalTabKey;
  onChange: (tab: RegionalTabKey) => void;
  className?: string;
};

function TabChip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition',
        active ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  );
}

export default function RegionalTabs({ value, onChange, className }: RegionalTabsProps) {
  const tabs: RegionalTabKey[] = ['Feed', 'Districts', 'Civic', 'Map'];

  return (
    <div className={classNames('flex items-center gap-2 overflow-x-auto pb-1', className)}>
      {tabs.map((t) => (
        <TabChip key={t} active={value === t} onClick={() => onChange(t)}>
          {t}
        </TabChip>
      ))}
    </div>
  );
}
