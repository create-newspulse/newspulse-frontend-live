import React from 'react';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export type DistrictChip = {
  slug: string;
  name: string;
};

export type DistrictChipBarProps = {
  districts: DistrictChip[];
  selectedDistrictSlug: string | null; // null means "All Gujarat"
  onSelectAll: () => void;
  onSelectDistrict: (slug: string) => void;
  onMore: () => void;
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

export default function DistrictChipBar({
  districts,
  selectedDistrictSlug,
  onSelectAll,
  onSelectDistrict,
  onMore,
  className,
}: DistrictChipBarProps) {
  const preview = districts.slice(0, 9);

  return (
    <div className={classNames('flex items-center gap-2 overflow-x-auto pb-1', className)}>
      <Chip active={!selectedDistrictSlug} onClick={onSelectAll}>
        All Gujarat
      </Chip>
      {preview.map((d) => (
        <Chip key={d.slug} active={selectedDistrictSlug === d.slug} onClick={() => onSelectDistrict(d.slug)}>
          {d.name}
        </Chip>
      ))}
      <Chip onClick={onMore}>More</Chip>
    </div>
  );
}
