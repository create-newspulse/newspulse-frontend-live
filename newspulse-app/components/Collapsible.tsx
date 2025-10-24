import { useState, PropsWithChildren } from 'react';

export default function Collapsible({ title, children }: PropsWithChildren<{ title: string }>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-300 rounded-md p-4 my-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full font-semibold text-left"
      >
        <span>{title}</span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && <div className="mt-3 pl-4 text-gray-600">{children}</div>}
    </div>
  );
}
