// packages/shell/src/screens/premium/premium-page.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import { premiumHeroFor } from './premium-hero.ts';
import { PremiumOffer } from './premium-offer.tsx';
import { PremiumRestore } from './premium-restore.tsx';
import { PremiumStateBody } from './premium-state-body.tsx';
import { PremiumToast } from './premium-toast.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';
import type { ReactNode } from 'react';

export type PremiumPageProps = { readonly model: PremiumModel };

/** The state marker E2E flows wait for; the normal page (and its restore toasts) has none. */
const STATE_MARKERS: Readonly<Record<PremiumView, string | null>> = {
  ready: null,
  restoring: null,
  'restore-empty': null,
  'restore-failed': null,
  'loading-price': 'premium.state.loading',
  'store-unavailable': 'premium.state.unavailable',
  'purchase-in-progress': 'premium.state.purchasing',
  pending: 'premium.state.pending',
  success: 'premium.state.success',
  error: 'premium.state.error',
  'already-owned': 'premium.state.owned',
};

const SMALL_PRINT_VIEWS: ReadonlySet<PremiumView> = new Set<PremiumView>([
  'ready',
  'restoring',
  'restore-empty',
  'restore-failed',
  'loading-price',
  'purchase-in-progress',
]);

const styles = StyleSheet.create({
  // The body's block gap (14): header, benefits, Buy, Restore and the small print (S12 design).
  column: { flexGrow: 1, gap: LAYOUT.blockGap },
  grow: { flexGrow: 1 },
});

/**
 * S12 Premium: the honest offer (art, benefits, one Buy key with the store's price, Restore,
 * small print) and every purchase state from the premium store. Never a banner, never a pop-up.
 */
export function PremiumPage({ model }: PremiumPageProps): ReactNode {
  const t = useT();
  const hero = premiumHeroFor(model, t);
  const marker = STATE_MARKERS[model.view];
  return (
    // Under the home indicator: a key at the bottom (Restore on the owned page) keeps its hard
    // shadow, which the scroll view's edge clipped at the safe-area bottom.
    <ScreenFrame testID="premium.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="premium.top-bar"
        title={t('common.premium')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.column} {...(marker === null ? {} : { testID: marker })}>
          {marker === null ? <PremiumOffer model={model} /> : <PremiumStateBody model={model} />}
          <View style={styles.grow} />
          {hero === null ? null : (
            <Button
              {...hero}
              kind="primary"
              size="hero"
              isBlock
              isReducedMotion={model.isReducedMotion}
            />
          )}
          <PremiumRestore model={model} />
          {SMALL_PRINT_VIEWS.has(model.view) ? (
            <AppText
              text={t('premium.small-print')}
              variant="caption"
              tone="muted"
              testID="premium.small-print"
            />
          ) : null}
        </View>
      </ScreenBody>
      <PremiumToast model={model} />
    </ScreenFrame>
  );
}
