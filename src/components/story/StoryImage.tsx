import React from 'react';
import { COVER_PLACEHOLDER_SRC, resolveImageFitMode, type CoverFitMode } from '../../../lib/coverImages';

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
  storyId?: string | null;
  src?: string | null;
  alt: string;
  variant: StoryImageVariant;
  fitMode?: CoverFitMode | 'auto' | null;
  priority?: boolean;
  className?: string;
  fallbackSrc?: string;
};

export function StoryImage({
  storyId,
  src,
  alt,
  variant,
  fitMode,
  priority = false,
  className,
  fallbackSrc = COVER_PLACEHOLDER_SRC,
}: StoryImageProps) {
  const safeStoryId = String(storyId || '').trim();
  const safeSrc = String(src || '').trim();
  const safeFallbackSrc = String(fallbackSrc || '').trim();
  const safeFitMode = String(fitMode || '').trim();

  const preferredSrc = safeSrc || safeFallbackSrc;

  const [currentSrc, setCurrentSrc] = React.useState<string>(preferredSrc);
  const [currentFitMode, setCurrentFitMode] = React.useState<CoverFitMode>(
    resolveImageFitMode({ fitMode: safeFitMode, src: preferredSrc, altText: alt })
  );

  React.useEffect(() => {
    setCurrentSrc(preferredSrc);
    setCurrentFitMode(resolveImageFitMode({ fitMode: safeFitMode, src: preferredSrc, altText: alt }));
  }, [alt, preferredSrc, safeFallbackSrc, safeFitMode, safeSrc, safeStoryId]);

  const showImage = Boolean(currentSrc);

  return (
    <div
      className={cx(
        'group/story-image relative overflow-hidden rounded-2xl shrink-0 bg-slate-100',
        VARIANT_SIZES[variant],
        className
      )}
      data-fit-mode={currentFitMode}
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
          key={safeStoryId || safeSrc || safeFallbackSrc || alt}
          src={currentSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          className={cx(
            'absolute inset-0 h-full w-full object-center',
            currentFitMode === 'contain' ? 'object-contain p-2 sm:p-3' : 'object-cover',
            'transition-transform duration-500 ease-out will-change-transform',
            'hover:scale-[1.06] group-hover/story-image:scale-[1.06]'
          )}
          onLoad={(event) => {
            const img = event.currentTarget;
            setCurrentFitMode((prev) => {
              const next = resolveImageFitMode({
                fitMode: safeFitMode,
                src: currentSrc,
                altText: alt,
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
              return prev === next ? prev : next;
            });
          }}
          onError={() => {
            if (safeFallbackSrc && currentSrc !== safeFallbackSrc) {
              setCurrentSrc(safeFallbackSrc);
              setCurrentFitMode(resolveImageFitMode({ fitMode: safeFitMode, src: safeFallbackSrc, altText: alt }));
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
