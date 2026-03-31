import React from 'react';
import { COVER_PLACEHOLDER_SRC } from '../../../lib/coverImages';

export type StoryImageVariant = 'card' | 'list' | 'top' | 'mini';

const VARIANT_SIZES: Record<StoryImageVariant, string> = {
  card: 'w-[140px] h-[90px] sm:w-[180px] sm:h-[110px] md:w-[220px] md:h-[130px]',
  list: 'w-[120px] h-[80px] sm:w-[160px] sm:h-[100px]',
  top: 'w-full h-[220px] sm:h-[280px] md:h-[320px]',
  mini: 'w-[96px] h-[64px]',
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

export type StoryImageProps = {
  src?: string | null;
  alt: string;
  variant: StoryImageVariant;
  priority?: boolean;
  className?: string;
  fallbackSrc?: string;
};

export function StoryImage({
  src,
  alt,
  variant,
  priority = false,
  className,
  fallbackSrc = COVER_PLACEHOLDER_SRC,
}: StoryImageProps) {
  const safeSrc = String(src || '').trim();
  const safeFallbackSrc = String(fallbackSrc || '').trim();

  const preferredSrc = safeSrc || safeFallbackSrc;

  const [currentSrc, setCurrentSrc] = React.useState<string>(preferredSrc);

  React.useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

  const showImage = Boolean(currentSrc);

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl shrink-0',
        VARIANT_SIZES[variant],
        // Hover (desktop): lift + subtle scale + pop above neighbors
        'transition-[transform,box-shadow] duration-300 ease-out',
        'group-hover:z-50 group-hover:-translate-y-[2px] group-hover:scale-[1.01] group-hover:shadow-lg',
        // Mobile tap (and desktop active): subtle press
        'hover:scale-[0.98] active:scale-[0.98]',
        className
      )}
    >
      {/* Placeholder (always present to avoid layout shift) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 to-slate-900/10" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-[11px] font-extrabold tracking-tight text-slate-600/80 select-none">
          News <span className="text-slate-800/80">Pulse</span>
        </div>
      </div>

      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          className={cx(
            'absolute inset-0 h-full w-full object-cover',
            'transition-transform duration-300 ease-out',
            'group-hover:scale-110'
          )}
          onError={() => {
            if (safeFallbackSrc && currentSrc !== safeFallbackSrc) {
              setCurrentSrc(safeFallbackSrc);
              return;
            }

            setCurrentSrc('');
          }}
        />
      ) : null}
    </div>
  );
}

export default StoryImage;
