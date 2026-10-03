// packages/shell/src/ui/game-top-bar.tsx
import { StyleSheet, View } from 'react-native';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';
import { IconButton } from './icon-button.tsx';

import type { ReactNode } from 'react';

const TOP_PADDING = 4;
const BOTTOM_PADDING = 8;
const GAP = 10;

export type GameKey = {
  /** Translated ("Undo", "Hint"). */
  readonly label: string;
  readonly onPress: () => void;
  readonly isDisabled?: boolean;
};

export type GameTopBarProps = {
  /** Scope of the ids: 'game' gives game.top-bar, game.pause-button, game.mode-label ... */
  readonly testIDBase: string;
  /** Translated "Pause". */
  readonly pauseLabel: string;
  readonly onPause: () => void;
  /** "Level 12", "Daily challenge" or "Endless". */
  readonly modeText: string;
  /** The game's progress line ("3 of 10 monsters defeated"). */
  readonly progressText: string;
  /** The live score, formatted in the chosen digits. */
  readonly scoreText: string;
  readonly undo?: GameKey;
  readonly hint?: GameKey;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  bar: {
    paddingTop: TOP_PADDING,
    paddingBottom: BOTTOM_PADDING,
    paddingInline: LAYOUT.gameTopBarPaddingInline,
    gap: GAP,
    flexDirection: 'row',
    alignItems: 'center',
  },
  middle: { flex: 1 },
});

function smallKey(
  key: GameKey | undefined,
  icon: 'undo' | 'hint',
  props: GameTopBarProps,
): ReactNode {
  if (key === undefined) return null;
  return (
    <IconButton
      icon={icon}
      label={key.label}
      onPress={key.onPress}
      size="small"
      testID={`${props.testIDBase}.${icon}-button`}
      isReducedMotion={props.isReducedMotion}
      {...(key.isDisabled === true ? { isDisabled: true } : {})}
    />
  );
}

/** The Shell part of the game screen: pause, mode and progress, score, undo and hint. */
export function GameTopBar(props: GameTopBarProps): ReactNode {
  const base = props.testIDBase;
  return (
    <View style={styles.bar} testID={`${base}.top-bar`}>
      <IconButton
        icon="pause"
        label={props.pauseLabel}
        onPress={props.onPause}
        testID={`${base}.pause-button`}
        isReducedMotion={props.isReducedMotion}
      />
      <View style={styles.middle}>
        <AppText text={props.modeText} variant="gameTopBarLevel" testID={`${base}.mode-label`} />
        <AppText
          text={props.progressText}
          variant="gameTopBarProgress"
          tone="muted"
          testID={`${base}.progress-label`}
        />
      </View>
      <AppText text={props.scoreText} variant="gameTopBarScore" testID={`${base}.score`} />
      {smallKey(props.undo, 'undo', props)}
      {smallKey(props.hint, 'hint', props)}
    </View>
  );
}
