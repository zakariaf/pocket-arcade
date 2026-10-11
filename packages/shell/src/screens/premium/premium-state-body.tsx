// packages/shell/src/screens/premium/premium-state-body.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { NotePanel } from '@e07/shell/ui/note-panel.tsx';

import { PremiumActiveSticker } from './premium-active-sticker.tsx';
import { PremiumSuccess } from './premium-success.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumStateView } from './premium-views.ts';
import type { ReactNode } from 'react';

export type PremiumStateBodyProps = {
  readonly model: PremiumModel;
  /** model.view, narrowed: the normal page draws the offer instead (isOfferView). */
  readonly view: PremiumStateView;
};

/**
 * The content of each S12 state above the grow spacer (the hero key and Restore come after it).
 * Loading and purchasing keep the subtitle readable; the other states show their message.
 */
export function PremiumStateBody({ model, view }: PremiumStateBodyProps): ReactNode {
  const t = useT();
  switch (view) {
    case 'store-unavailable':
      return (
        <NotePanel
          testID="premium.unavailable-note"
          icon="wifi-off"
          text={t('premium.store-unavailable')}
        />
      );
    case 'pending':
      return (
        <>
          <NotePanel
            testID="premium.pending-note"
            icon="clock"
            text={t('premium.pending')}
            isStrong
          />
          <AppText
            text={t('premium.pending-detail')}
            tone="muted"
            testID="premium.pending-detail"
          />
        </>
      );
    case 'success':
      return (
        <PremiumSuccess
          isReducedMotion={model.isReducedMotion}
          isConfettiHidden={model.isConfettiHidden}
        />
      );
    case 'error':
      return (
        <NotePanel testID="premium.error-note" icon="alert" isError text={t('premium.error')} />
      );
    case 'already-owned':
      return (
        <>
          <PremiumActiveSticker isReducedMotion={model.isReducedMotion} />
          <AppText
            text={t('premium.owned.body', { gameName: model.gameName })}
            variant="lead"
            testID="premium.owned-body"
          />
        </>
      );
    case 'loading-price':
    case 'purchase-in-progress':
      return (
        <AppText
          text={t('premium.subtitle', { gameName: model.gameName })}
          tone="muted"
          testID="premium.subtitle"
        />
      );
  }
}
