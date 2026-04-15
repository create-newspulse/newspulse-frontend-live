import React from 'react';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export type DistrictPickerItem = {
  slug: string;
  name: string;
};

export type DistrictPickerProps = {
  open: boolean;
  title?: string;
  closeLabel?: string;
  closeAriaLabel?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  noResultsLabel?: string;
  districts: DistrictPickerItem[];
  onClose: () => void;
  onPickAll: () => void;
  onPickDistrict: (slug: string) => void;
};

export default function DistrictPicker({
  open,
  title = 'Choose a District',
  closeLabel = 'Close',
  closeAriaLabel = 'Close',
  searchPlaceholder = 'Type to search…',
  allLabel = 'All Gujarat',
  noResultsLabel = 'No districts found.',
  districts,
  onClose,
  onPickAll,
  onPickDistrict,
}: DistrictPickerProps) {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter((d) => d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q));
  }, [districts, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={closeAriaLabel}
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl md:inset-0 md:my-10 md:bottom-auto md:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
          >
            {closeLabel}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />

          <div className={classNames('max-h-[55vh] overflow-auto rounded-2xl border border-slate-200')}>
            <button
              type="button"
              className="w-full border-b border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onPickAll();
                onClose();
              }}
            >
              {allLabel}
            </button>

            {filtered.map((d) => (
              <button
                type="button"
                key={d.slug}
                className="w-full border-b border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onPickDistrict(d.slug);
                  onClose();
                }}
              >
                {d.name}
              </button>
            ))}

            {!filtered.length && (
              <div className="px-4 py-6 text-sm text-slate-500">{noResultsLabel}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
