// packages/shell/src/screens/premium/premium-state-body.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { NotePanel } from '@e07/shell/ui/note-panel.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import { PremiumSuccess } from './premium-success.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { ReactNode } from 'react';

export type PremiumStateBodyProps = { readonly model: PremiumModel };

const styles = StyleSheet.create({
  sticker: { alignSelf: 'flex-start' },
});

/**
 * The content of each S12 state above the grow spacer (the hero key and Restore come after it).
 * Loading and purchasing keep the subtitle readable; the other states show their message.
 */
export function PremiumStateBody({ model }: PremiumStateBodyProps): ReactNode {
  const t = useT();
  const activeSticker = (
    <View style={styles.sticker}>
      <Sticker
        testID="premium.active-sticker"
        text={t('premium.active')}
        icon="crown"
        tiltDeg={-3}
        slapDelayMs={0}
        isReducedMotion={model.isReducedMotion}
      />
    </View>
  );
  switch (model.view) {
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
      return <PremiumSuccess isReducedMotion={model.isReducedMotion} />;
    case 'error':
      return (
        <NotePanel testID="premium.error-note" icon="alert" isError text={t('premium.error')} />
      );
    case 'already-owned':
      return (
        <>
          {activeSticker}
          <AppText
            text={t('premium.owned.body', { gameName: model.gameName })}
            variant="lead"
            testID="premium.owned-body"
          />
        </>
      );
    case 'loading-price':
    case 'purchase-in-progress':
    case 'ready':
    case 'restoring':
    case 'restore-empty':
    case 'restore-failed':
      return (
        <AppText
          text={t('premium.subtitle', { gameName: model.gameName })}
          tone="muted"
          testID="premium.subtitle"
        />
      );
  }
}
