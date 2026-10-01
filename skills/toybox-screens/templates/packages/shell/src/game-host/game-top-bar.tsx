// packages/shell/src/game-host/game-top-bar.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { GameTopBar as ToyboxGameTopBar } from '@e07/shell/ui/game-top-bar.tsx';

import type { GameKey } from '@e07/shell/ui/game-top-bar.tsx';
import type { ReactNode } from 'react';

/** An optional top-bar tool: null when the game does not support it (left out, never greyed). */
export type GameTool = {
  /** Translated accessibility label (the copy deck has no key yet: add one with the i18n work). */
  readonly label: string;
  /** False while the tool cannot be used right now: the key is drawn disabled. */
  readonly isAvailable: boolean;
  readonly onPress: () => void;
};

/** What the game host hands the S5 top bar (game-host-integration's topBarPropsOf builds it). */
export type GameTopBarProps = {
  /** "Level 12" (game-screen.mode.level), "Daily – 26 Sep" (game-screen.mode.daily) or common.mode.endless. */
  readonly modeText: string;
  /** The goal line: "Moves 5 / Par 7" or the game's own progress message. */
  readonly progressText: string;
  /** The live score, already formatted with the chosen digits. */
  readonly scoreText: string;
  readonly undo: GameTool | null;
  readonly hint: GameTool | null;
  readonly onPause: () => void;
  readonly isReducedMotion: boolean;
};

/**
 * What the Game screen draws: the host's top-bar props (topBarPropsOf) plus the game's hint fact.
 * A game without solver hints (GameHost.hasHints false, Line Siege) has no hint key at all.
 */
export type GameTopBarViewProps = GameTopBarProps & {
  /** GameHost.hasHints (hasHintsOf: rules.hints.kind 'solver'); false draws no hint key. */
  readonly hasHints: boolean;
};

function keyOf(tool: GameTool): GameKey {
  return { label: tool.label, onPress: tool.onPress, isDisabled: !tool.isAvailable };
}

/**
 * S5 game top bar: the Toybox GameTopBar with the Game screen's ids (testIDBase "game" derives
 * game.top-bar, game.pause-button, game.mode-label, game.progress-label, game.score,
 * game.undo-button, game.hint-button) and the translated Pause label. Pause 48, undo and hint 44.
 * The hint key exists only for a game with solver hints (hasHints), whatever the perk offer says.
 */
export function GameTopBar(props: GameTopBarViewProps): ReactNode {
  const t = useT();
  const { undo } = props;
  const hint = props.hasHints ? props.hint : null;
  return (
    <ToyboxGameTopBar
      testIDBase="game"
      pauseLabel={t('common.pause')}
      onPause={props.onPause}
      modeText={props.modeText}
      progressText={props.progressText}
      scoreText={props.scoreText}
      isReducedMotion={props.isReducedMotion}
      {...(undo === null ? {} : { undo: keyOf(undo) })}
      {...(hint === null ? {} : { hint: keyOf(hint) })}
    />
  );
}
