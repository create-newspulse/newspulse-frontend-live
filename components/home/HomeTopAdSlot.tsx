import React, { useState } from 'react';

import { usePublicAdSlot, type UsePublicAdSlotResult } from '../../hooks/usePublicAdSlot';
import { ResolvedAdSlot } from '../../src/components/ads/AdSlot';
import { useLanguage } from '../../src/i18n/language';

const PREMIUM_SLOT = 'TOP_HOME_BILLBOARD_970x250';
const STANDARD_SLOT = 'HOME_728x90';
const CLASS_NAME = 'home-shell mx-auto mt-3';
const LOADING_STATE: UsePublicAdSlotResult = {
  enabled: true,
  ad: null,
  isLoading: true,
  hasResolved: false,
};

function SharedTopHomeAd({ language }: { language: string }) {
  const premium = usePublicAdSlot({ slot: PREMIUM_SLOT, language });
  const standard = usePublicAdSlot({ slot: STANDARD_SLOT, language });
  const [failedPremiumImage, setFailedPremiumImage] = useState<string | null>(null);
  const premiumImage = premium.ad?.imageUrl?.trim() || '';

  // Public image ads are eligible inventory; house fallback is frontend-only (ad: null).
  if (premium.hasResolved && premium.enabled && premiumImage && premiumImage !== failedPremiumImage) {
    return (
      <ResolvedAdSlot
        key={`${PREMIUM_SLOT}:${premiumImage}`}
        slot={PREMIUM_SLOT}
        variant="billboard970x250"
        className={CLASS_NAME}
        state={premium}
        hideWhenEmpty
        onImageError={() => setFailedPremiumImage(premiumImage)}
      />
    );
  }

  // Do not flash standard inventory before the initial premium decision is known.
  if (!premium.hasResolved || !standard.hasResolved) {
    return (
      <ResolvedAdSlot
        key="loading"
        slot={STANDARD_SLOT}
        variant="homeBanner"
        className={CLASS_NAME}
        state={LOADING_STATE}
      />
    );
  }

  return (
    <ResolvedAdSlot
      key={STANDARD_SLOT}
      slot={STANDARD_SLOT}
      variant="homeBanner"
      className={CLASS_NAME}
      state={standard}
    />
  );
}

export default function HomeTopAdSlot() {
  const { language } = useLanguage();
  return <SharedTopHomeAd key={language} language={language} />;
}
