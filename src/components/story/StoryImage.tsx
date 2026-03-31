import React from 'react';
import {
  COVER_PLACEHOLDER_SRC,
  inferAutoCoverFitMode,
  type CoverFitMode,
  type CoverFitModePreference,
} from '../../../lib/coverImages';

export type StoryImageVariant = 'card' | 'list' | 'top' | 'mini';
export type StoryImageDisplayMode = 'default' | 'detailHero';

const VARIANT_SIZES: Record<StoryImageVariant, string> = {
  card: 'w-[140px] h-[90px] sm:w-[180px] sm:h-[110px] md:w-[220px] md:h-[130px]',
  list: 'w-[120px] h-[80px] sm:w-[160px] sm:h-[100px]',
  top: 'w-full h-[220px] sm:h-[280px] md:h-[320px]',
  mini: 'w-[96px] h-[64px]',
};

const DETAIL_HERO_SIZE = 'w-full h-[250px] sm:h-[320px] lg:h-[380px]';

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
  displayMode?: StoryImageDisplayMode;
  coverFitMode?: CoverFitModePreference;
};

export function StoryImage({
  src,
  alt,
  variant,
  priority = false,
  className,
  fallbackSrc = COVER_PLACEHOLDER_SRC,
  displayMode = 'default',
  coverFitMode = 'auto',
}: StoryImageProps) {
  const safeSrc = String(src || '').trim();
  const safeFallbackSrc = String(fallbackSrc || '').trim();

  const preferredSrc = safeSrc || safeFallbackSrc;

  const [currentSrc, setCurrentSrc] = React.useState<string>(preferredSrc);

  React.useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

  const [autoFitMode, setAutoFitMode] = React.useState<CoverFitMode>('photo');

  React.useEffect(() => {
    setAutoFitMode(coverFitMode === 'graphic' ? 'graphic' : 'photo');
  }, [coverFitMode, preferredSrc]);

  const renderSrc = React.useMemo(() => {
    if (!currentSrc) return preferredSrc;
    if (currentSrc === preferredSrc) return currentSrc;
    if (safeFallbackSrc && currentSrc === safeFallbackSrc) return currentSrc;
    return preferredSrc;
  }, [currentSrc, preferredSrc, safeFallbackSrc]);

  const showImage = Boolean(renderSrc);
  const isDetailHero = displayMode === 'detailHero';
  const resolvedCoverFitMode = coverFitMode === 'auto' ? autoFitMode : coverFitMode;
  const isGraphicDetailHero = isDetailHero && resolvedCoverFitMode === 'graphic';
  const sizeClassName = isDetailHero ? DETAIL_HERO_SIZE : VARIANT_SIZES[variant];
  const foregroundImageClassName = isGraphicDetailHero
    ? 'absolute inset-0 z-10 h-full w-full object-contain p-3 sm:p-4 md:p-5'
    : isDetailHero
      ? 'absolute inset-0 h-full w-full object-cover'
    : 'absolute inset-0 h-full w-full object-cover';
  const imageMotionClassName = isGraphicDetailHero
    ? 'transition-opacity duration-300 ease-out'
    : isDetailHero
      ? 'transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.035]'
      : 'transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.045]';
  const detailHeroContainerClassName = isGraphicDetailHero
    ? 'rounded-[28px] border border-slate-200 bg-slate-50 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.18)]'
    : isDetailHero
      ? 'rounded-[28px] border border-slate-200 bg-slate-100 shadow-[0_20px_46px_-32px_rgba(15,23,42,0.24)]'
      : 'rounded-2xl';
  const placeholderClassName = isGraphicDetailHero
    ? 'bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,1))]'
    : isDetailHero
      ? 'bg-[linear-gradient(180deg,rgba(226,232,240,0.72),rgba(203,213,225,0.9))]'
      : 'bg-gradient-to-br from-slate-900/5 to-slate-900/10';

  return (
    <div
      className={cx(
        'group relative overflow-hidden shrink-0',
        detailHeroContainerClassName,
        sizeClassName,
        // Hover (desktop): lift + subtle scale + pop above neighbors
        'transition-[transform,box-shadow] duration-300 ease-out',
        isDetailHero ? null : 'group-hover:z-50 group-hover:-translate-y-[2px] group-hover:scale-[1.01] group-hover:shadow-lg',
        // Mobile tap (and desktop active): subtle press
        isDetailHero ? null : 'hover:scale-[0.98] active:scale-[0.98]',
        className
      )}
    >
      {/* Placeholder (always present to avoid layout shift) */}
      <div className={cx('absolute inset-0', placeholderClassName)} />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-[11px] font-extrabold tracking-tight text-slate-600/80 select-none">
          News <span className="text-slate-800/80">Pulse</span>
        </div>
      </div>

      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={renderSrc || 'story-image-empty'}
            src={renderSrc}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            className={cx(foregroundImageClassName, imageMotionClassName)}
            onLoad={(event) => {
              if (coverFitMode !== 'auto') return;

              const nextMode = inferAutoCoverFitMode({
                src: renderSrc,
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
              setAutoFitMode(nextMode);
            }}
            onError={() => {
              if (safeFallbackSrc && currentSrc !== safeFallbackSrc) {
                setCurrentSrc(safeFallbackSrc);
                return;
              }

              setCurrentSrc('');
            }}
          />
        </>
      ) : null}
    </div>
  );
}

export default StoryImage;
