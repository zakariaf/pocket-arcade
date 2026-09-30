// packages/shell/src/screens/pause/pause-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';
import { Scrim } from '@e07/shell/ui/scrim.tsx';

import { PauseToggles } from './pause-toggles.tsx';

import type { PauseModel } from './pause-model.ts';
import type { ReactNode } from 'react';

export type PauseViewProps = {
  readonly model: PauseModel;
  readonly onResume: () => void;
  readonly onHome: () => void;
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  home: { alignSelf: 'center' },
});

/**
 * S6 Pause, drawn over the dimmed Game screen: title and mode line, the hero Resume, Restart
 * level, How to play, the three toggle keys, and the quiet Home link. Never an ad here.
 */
export function PauseView({ model, onResume, onHome }: PauseViewProps): ReactNode {
  const t = useT();
  const { isReducedMotion } = model;
  return (
    <Scrim testID="pause.scrim">
      {/* The Pause card is pause.dialog (not <base>.card) and brings its own header. */}
      <DialogCard testIDBase="pause" cardTestID="pause.dialog" variant="pause">
        <View style={styles.header}>
          <AppText text={t('pause.title')} variant="title" isHeader testID="pause.title" />
          <AppText text={model.modeText} tone="muted" testID="pause.mode-label" />
        </View>
        <Button
          testID="pause.resume-button"
          label={t('pause.resume-button')}
          onPress={onResume}
          kind="primary"
          size="hero"
          cap="play"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="pause.restart-button"
          label={t('pause.restart-button')}
          onPress={model.onRestart}
          icon="restore"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="pause.how-to-play-button"
          label={t('common.how-to-play')}
          onPress={model.onHowToPlay}
          icon="book"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <PauseToggles model={model} />
        <View style={styles.home}>
          <Button
            testID="pause.home-button"
            label={t('common.home')}
            onPress={onHome}
            kind="quiet"
            icon="home"
            isReducedMotion={isReducedMotion}
          />
        </View>
      </DialogCard>
    </Scrim>
  );
}
