// packages/shell/src/screens/how-to-play/how-to-play-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { HowToStage } from '@e07/shell/ui/how-to-stage.tsx';
import { PagerDots } from '@e07/shell/ui/pager-dots.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { ReactNode } from 'react';

export type HowToPlayModel = {
  /** games.<id>.goal. */
  readonly goal: string;
  /** games.<id>.howToPlay: 3 to 5 short steps. */
  readonly steps: readonly string[];
  /** 0-based: step 2 shows steps[1]. */
  readonly stepIndex: number;
  /** The game draws each step's picture in code. */
  readonly renderPicture: (stepIndex: number) => ReactNode;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  /** After the last step: back to where the player came from. */
  readonly onDone: () => void;
  /** navigate('Game', { start: 'new', ref: { kind: 'tutorial' } }). */
  readonly onReplayTutorial: () => void;
};

export type HowToPlayViewProps = { readonly model: HowToPlayModel };

const styles = StyleSheet.create({
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  grow: { flexGrow: 1 },
  // Previous / Next share a row (isInRow: grow from a 120 pt basis) and wrap at 200 % text.
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nudge: { alignSelf: 'center' },
});

/**
 * S13 How to play: the goal, the stage with the step picture, "Step 2 / 4" and the pager dots,
 * the step sentence, Previous / Next, and "Play the tutorial again". Swipes mirror in RTL.
 */
export function HowToPlayView({ model }: HowToPlayViewProps): ReactNode {
  const t = useT();
  const total = model.steps.length;
  const stepText = model.steps[model.stepIndex] ?? '';
  const isLast = model.stepIndex >= total - 1;
  return (
    <ScreenFrame testID="how-to-play.screen">
      <TopBar
        testID="how-to-play.top-bar"
        title={t('common.how-to-play')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody>
        <AppText text={model.goal} tone="muted" testID="how-to-play.goal" />
        <HowToStage testID="how-to-play.stage">
          {/* The picture is one labelled image for VoiceOver: the step sentence describes it. */}
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={stepText}
            testID="how-to-play.picture"
          >
            {model.renderPicture(model.stepIndex)}
          </View>
        </HowToStage>
        <View style={styles.pager} testID="how-to-play.pager">
          <Chip
            testID="how-to-play.step-chip"
            text={t('how-to-play.step-counter', { step: model.stepIndex + 1, total })}
          />
          <PagerDots testID="how-to-play.pager-dots" count={total} index={model.stepIndex} />
        </View>
        <AppText text={stepText} variant="heading" testID="how-to-play.step-text" />
        <View style={styles.grow} />
        <View style={styles.buttons}>
          <Button
            testID="how-to-play.previous-button"
            label={t('common.previous')}
            onPress={model.onPrevious}
            icon="back"
            isDisabled={model.stepIndex === 0}
            isInRow
            isReducedMotion={model.isReducedMotion}
          />
          <Button
            testID="how-to-play.next-button"
            label={t(isLast ? 'common.got-it' : 'common.next')}
            onPress={isLast ? model.onDone : model.onNext}
            kind="primary"
            iconEnd="forward"
            isInRow
            isReducedMotion={model.isReducedMotion}
          />
        </View>
        <View style={styles.nudge}>
          <Button
            testID="how-to-play.replay-tutorial-button"
            label={t('how-to-play.replay-tutorial')}
            onPress={model.onReplayTutorial}
            kind="quiet"
            icon="restore"
            isReducedMotion={model.isReducedMotion}
          />
        </View>
      </ScreenBody>
    </ScreenFrame>
  );
}
