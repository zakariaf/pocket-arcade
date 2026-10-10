// packages/shell/src/screens/result/continue-offer.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { OfferBox } from '@e07/shell/ui/offer-box.tsx';

import type { LoseResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ContinueOfferProps = { readonly model: LoseResult };

/**
 * S7 lose offer box (dashed 3 pt frame, no fill): the pop "Continue – watch an ad" button,
 * or "Continue – free with Premium" with a play icon for owners, and the once-per-level note.
 * While the rewarded ad loads ('ad-loading', L11) it is the same offer with the ad key busy: the
 * label stays, the three hopping blocks replace the ad icon, the key is pushed in, VoiceOver hears
 * it busy and a press does nothing; no new text. Nothing is drawn only when no continue can come.
 */
export function ContinueOffer({ model }: ContinueOfferProps): ReactNode {
  const t = useT();
  if (model.continueOffer === null) return null;
  const isPremium = model.continueOffer === 'premium';
  return (
    <OfferBox testID="result.continue-offer">
      <Button
        testID={isPremium ? 'result.continue-premium-button' : 'result.continue-ad-button'}
        label={t(isPremium ? 'result.lose.continue-premium' : 'result.lose.continue-ad')}
        onPress={model.actions.onContinue}
        kind="pop"
        icon={isPremium ? 'play' : 'ad'}
        isBusy={model.continueOffer === 'ad-loading'}
        isBlock
        isReducedMotion={model.isReducedMotion}
      />
      <AppText
        text={t('result.lose.continue-note')}
        variant="caption"
        tone="muted"
        testID="result.continue-note"
      />
    </OfferBox>
  );
}
