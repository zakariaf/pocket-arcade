// packages/shell/src/screens/result/result-win-actions.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';

import type { WinResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultWinActionsProps = { readonly model: WinResult };

const styles = StyleSheet.create({
  column: { gap: 14 },
  // Replay / Levels share a row (isInRow: grow from a 120 pt basis) and wrap at 200 % text.
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nudge: { alignSelf: 'center' },
});

/** The win screen's buttons: hero Next level, then Replay + Levels (gap 12), then the nudge. */
export function ResultWinActions({ model }: ResultWinActionsProps): ReactNode {
  const t = useT();
  const { actions, isReducedMotion } = model;
  return (
    <View style={styles.column}>
      <Button
        testID="result.next-button"
        label={t('result.win.next-button')}
        onPress={actions.onNext}
        kind="primary"
        size="hero"
        iconEnd="forward"
        isBlock
        isReducedMotion={isReducedMotion}
      />
      <View style={styles.pair}>
        <Button
          testID="result.replay-button"
          label={t('result.win.replay-button')}
          onPress={actions.onReplay}
          icon="restore"
          isInRow
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="result.levels-button"
          label={t('common.levels')}
          onPress={actions.onLevels}
          icon="grid"
          isInRow
          isReducedMotion={isReducedMotion}
        />
      </View>
      {model.nudgePriceText === null ? null : (
        <View style={styles.nudge}>
          <Button
            testID="result.premium-button"
            label={t('result.premium-nudge', { priceText: model.nudgePriceText })}
            onPress={actions.onOpenPremium}
            kind="quiet"
            icon="crown"
            isReducedMotion={isReducedMotion}
          />
        </View>
      )}
    </View>
  );
}
