import Link from 'next/link';
import React from 'react';

type Props = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function PortalRouteState({ title, description, actionHref, actionLabel }: Props) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Link href={actionHref} className="inline-flex rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}