// packages/shell/src/screens/first-run/tutorial-view.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import type { TutorialModel } from './use-tutorial-model.ts';
import type { ReactNode } from 'react';

export type TutorialViewProps = { readonly model: TutorialModel };

const styles = StyleSheet.create({
  header: { minHeight: 48, flexDirection: 'row', justifyContent: 'flex-end', paddingInline: 14 },
  board: { flex: 1, marginTop: 4, marginInline: 14 },
  coach: { gap: 12, paddingInline: 14, paddingBottom: 12 },
});

/**
 * The tutorial level (spec S13, route Tutorial): the game's board in tutorial mode with one short
 * sentence at a time under it, Skip from the second step, and a continue key while paused or once
 * the script is over. Not drawn in Toybox; its root and Skip carry the map's chosen testIDs.
 */
export function TutorialView({ model }: TutorialViewProps): ReactNode {
  const { BoardHost, skipKey, continueKey } = model;
  return (
    <ScreenFrame testID="tutorial.screen">
      <View style={styles.header}>
        {skipKey === null ? null : (
          <Button
            testID="tutorial.skip-button"
            label={skipKey.label}
            onPress={skipKey.onPress}
            kind="quiet"
            isReducedMotion={model.isReducedMotion}
          />
        )}
      </View>
      <View style={styles.board} testID="tutorial.board">
        {BoardHost === null ? null : (
          <BoardHost testID="game.board-canvas" coachTargets={model.coachTargets} />
        )}
      </View>
      <View style={styles.coach}>
        <Panel testID="tutorial.coach">
          {model.welcomeText === null ? null : (
            <AppText text={model.welcomeText} variant="heading" testID="tutorial.welcome" />
          )}
          <AppText text={model.coachText} testID="tutorial.coach-text" />
        </Panel>
        {continueKey === null ? null : (
          <Button
            testID="tutorial.continue-button"
            label={continueKey.label}
            onPress={continueKey.onPress}
            kind="primary"
            iconEnd="forward"
            isBlock
            isReducedMotion={model.isReducedMotion}
          />
        )}
      </View>
    </ScreenFrame>
  );
}
