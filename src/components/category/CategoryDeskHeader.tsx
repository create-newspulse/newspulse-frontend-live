import React from 'react';

export type CategoryDeskHeaderProps = {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  accent?: 'default' | 'breaking';
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
  actionLayoutBreakpoint?: 'md' | 'lg';
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function CategoryDeskHeader({
  eyebrow,
  title,
  description,
  accent = 'default',
  actions,
  children,
  className,
  contentClassName,
  actionsClassName,
  actionLayoutBreakpoint = 'md',
}: CategoryDeskHeaderProps) {
  const isBreaking = accent === 'breaking';
  const rowClassName = actionLayoutBreakpoint === 'lg'
    ? 'flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between lg:gap-5'
    : 'flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-5';

  return (
    <div className={classNames('rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.28)] backdrop-blur', isBreaking && 'border-l-4 border-l-red-600 shadow-[0_18px_44px_-38px_rgba(220,38,38,0.42)]', className)}>
      <div className="p-4 sm:p-5">
        <div className={rowClassName}>
          <div className={classNames('min-w-0 flex-1 basis-auto md:min-w-[min(100%,24rem)]', contentClassName)}>
            <div className={classNames('flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em]', isBreaking ? 'text-red-700' : 'text-newsPulse-blue/80')}>
              {isBreaking ? <span className="inline-flex h-2 w-2 rounded-full bg-red-600" aria-hidden="true" /> : null}
              <span>{eyebrow}</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-newsPulse-navy sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-newsPulse-slate">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? <div className={classNames('w-full shrink-0 md:flex-[0_1_360px] md:max-w-[360px]', actionsClassName)}>{actions}</div> : null}
        </div>

        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}