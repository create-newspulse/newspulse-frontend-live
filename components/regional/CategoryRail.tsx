import React from 'react';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export type CategoryRailProps = {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  className?: string;
};

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
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

export default function CategoryRail({ categories, selected, onSelect, className }: CategoryRailProps) {
  return (
    <div className={classNames('flex items-center gap-2 overflow-x-auto pb-1', className)}>
      {categories.map((c) => (
        <Chip key={c} active={selected === c} onClick={() => onSelect(c)}>
          {c}
        </Chip>
      ))}
    </div>
  );
}
