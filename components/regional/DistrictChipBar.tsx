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
  allLabel?: string;
  moreLabel?: string;
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

const DESKTOP_PRIMARY_DISTRICT_SLUGS = new Set(['ahmedabad', 'surat', 'vadodara', 'rajkot', 'gandhinagar']);

export default function DistrictChipBar({
  districts,
  selectedDistrictSlug,
  onSelectAll,
  onSelectDistrict,
  onMore,
  allLabel = 'All Gujarat',
  moreLabel = 'More',
  className,
}: DistrictChipBarProps) {
  const preview = districts.slice(0, 9);
  const desktopPreview = districts.filter((d) => DESKTOP_PRIMARY_DISTRICT_SLUGS.has(d.slug));
  const selectedDistrict = selectedDistrictSlug
    ? districts.find((d) => d.slug === selectedDistrictSlug && !DESKTOP_PRIMARY_DISTRICT_SLUGS.has(d.slug))
    : null;
  const desktopItems = selectedDistrict ? [...desktopPreview, selectedDistrict] : desktopPreview;

  return (
    <div className={classNames('min-w-0', className)}>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
        <Chip active={!selectedDistrictSlug} onClick={onSelectAll}>
          {allLabel}
        </Chip>
        {preview.map((d) => (
          <Chip key={d.slug} active={selectedDistrictSlug === d.slug} onClick={() => onSelectDistrict(d.slug)}>
            {d.name}
          </Chip>
        ))}
        <Chip onClick={onMore}>{moreLabel}</Chip>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Chip active={!selectedDistrictSlug} onClick={onSelectAll}>
          {allLabel}
        </Chip>
        {desktopItems.map((d) => (
          <Chip key={d.slug} active={selectedDistrictSlug === d.slug} onClick={() => onSelectDistrict(d.slug)}>
            {d.name}
          </Chip>
        ))}
        <Chip onClick={onMore}>{moreLabel}</Chip>
      </div>
    </div>
  );
}
