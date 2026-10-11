// packages/shell/src/screens/premium/premium-success.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Confetti } from '@e07/shell/ui/confetti.tsx';

import { PremiumActiveSticker } from './premium-active-sticker.tsx';

import type { ReactNode } from 'react';

export type PremiumSuccessProps = {
  readonly isReducedMotion: boolean;
  /** The saved Reduce motion setting: it hides the confetti (a parity capture keeps it, at rest). */
  readonly isConfettiHidden: boolean;
};

/**
 * S12 success: confetti (hidden under Reduce motion), "Thank you!", the lead, and the slapped
 * "Premium – active" sticker. Ads vanish everywhere at once because every banner reads the store.
 */
export function PremiumSuccess({
  isReducedMotion,
  isConfettiHidden,
}: PremiumSuccessProps): ReactNode {
  const t = useT();
  return (
    <>
      <Confetti
        testID="premium.confetti"
        isReducedMotion={isReducedMotion}
        isHiddenBySetting={isConfettiHidden}
      />
      <AppText
        text={t('premium.success.title')}
        variant="display"
        isHeader
        testID="premium.success-title"
      />
      <AppText text={t('premium.success.body')} variant="lead" testID="premium.success-body" />
      <PremiumActiveSticker isReducedMotion={isReducedMotion} />
    </>
  );
}
