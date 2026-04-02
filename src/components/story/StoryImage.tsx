import Image from 'next/image';
import React from 'react';
import { COVER_PLACEHOLDER_SRC, resolveImageFitMode, type CoverFitMode } from '../../../lib/coverImages';

export type StoryImageVariant = 'card' | 'list' | 'top' | 'mini';

const VARIANT_FRAME_CLASSES: Record<StoryImageVariant, string> = {
  card: 'w-full aspect-[16/10]',
  list: 'w-[120px] aspect-[16/10] sm:w-[160px]',
  top: 'w-full aspect-[16/9]',
  mini: 'w-[96px] aspect-[4/3] sm:w-[116px]',
};

const VARIANT_IMAGE_SIZES: Record<StoryImageVariant, string> = {
  card: '(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw',
  list: '(min-width: 640px) 160px, 100vw',
  top: '(min-width: 1280px) 960px, (min-width: 768px) 92vw, 100vw',
  mini: '(min-width: 640px) 116px, 96px',
};

const VARIANT_IMAGE_QUALITY: Record<StoryImageVariant, number> = {
  card: 78,
  list: 76,
  top: 90,
  mini: 74,
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

  const [loadedSize, setLoadedSize] = React.useState<{ width: number; height: number } | null>(null);
  const [isUsingFallback, setIsUsingFallback] = React.useState(false);
  const [isBroken, setIsBroken] = React.useState(false);

  React.useEffect(() => {
    setLoadedSize(null);
    setIsUsingFallback(false);
    setIsBroken(false);
  }, [alt, preferredSrc, safeFallbackSrc, safeFitMode, safeSrc, safeStoryId]);

  const currentSrc = React.useMemo(() => {
    if (isBroken) return '';
    if (isUsingFallback && safeFallbackSrc) return safeFallbackSrc;
    return preferredSrc;
  }, [isBroken, isUsingFallback, preferredSrc, safeFallbackSrc]);

  const currentFitMode = React.useMemo(
    () =>
      resolveImageFitMode({
        fitMode: safeFitMode,
        src: currentSrc || preferredSrc,
        altText: alt,
        width: loadedSize?.width,
        height: loadedSize?.height,
      }),
    [alt, currentSrc, loadedSize?.height, loadedSize?.width, preferredSrc, safeFitMode]
  );

  const shouldAvoidUpscale = React.useMemo(() => {
    if (variant !== 'top') return false;
    if (!loadedSize?.width || !loadedSize?.height) return false;
    return loadedSize.width < 1200 || loadedSize.height < 675;
  }, [loadedSize?.height, loadedSize?.width, variant]);

  const effectiveFitMode: CoverFitMode = shouldAvoidUpscale && currentFitMode === 'cover' ? 'contain' : currentFitMode;

  const isUnoptimizedSource = React.useMemo(() => /\.svg($|\?)/i.test(currentSrc), [currentSrc]);

  const showImage = Boolean(currentSrc);

  return (
    <div
      className={cx(
        'group/story-image relative overflow-hidden rounded-2xl shrink-0 bg-slate-100',
        VARIANT_FRAME_CLASSES[variant],
        className
      )}
      data-variant={variant}
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
        <Image
          key={[safeStoryId, currentSrc, alt].filter(Boolean).join('|')}
          src={currentSrc}
          alt={alt}
          fill
          priority={priority}
          sizes={VARIANT_IMAGE_SIZES[variant]}
          quality={VARIANT_IMAGE_QUALITY[variant]}
          unoptimized={isUnoptimizedSource}
          style={{ objectPosition: effectiveFitMode === 'cover' && variant === 'top' ? 'center 28%' : 'center' }}
          className={cx(
            'absolute inset-0 h-full w-full object-center transform-gpu',
            effectiveFitMode === 'contain'
              ? 'object-contain p-2 sm:p-3'
              : variant === 'top'
                ? 'object-cover'
                : 'object-cover',
            'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out will-change-transform',
            'motion-safe:hover:scale-[1.04] motion-safe:group-hover/story-image:scale-[1.04]',
            'motion-reduce:transform-none motion-reduce:transition-none'
          )}
          onLoad={(event) => {
            const img = event.currentTarget as HTMLImageElement;
            const width = Number(img.naturalWidth) || 0;
            const height = Number(img.naturalHeight) || 0;
            setLoadedSize((prev) => {
              if (prev?.width === width && prev?.height === height) return prev;
              return { width, height };
            });
          }}
          onError={() => {
            setLoadedSize(null);

            if (safeFallbackSrc && currentSrc !== safeFallbackSrc) {
              setIsUsingFallback(true);
              return;
            }

            setIsBroken(true);
          }}
        />
      ) : null}
    </div>
  );
}

export default StoryImage;
