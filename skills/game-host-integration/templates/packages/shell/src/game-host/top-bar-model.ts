// packages/shell/src/game-host/top-bar-model.ts
import { MODE_LABEL_KEYS } from '@e07/shell/game-host/hud-model.ts';
import { formatDayMonth } from '@e07/shell/i18n/format-date.ts';

import type { Message } from '@e07/game-kit/contract/messages.ts';
import type { GameTool, GameTopBarProps } from '@e07/shell/game-host/game-top-bar.tsx';
import type { GoalLine } from '@e07/shell/game-host/hud-model.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { NumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/** How run data becomes text: the Shell's t(), the chosen digits, and the game's own messages. */
export type RunText = {
  readonly t: TFunction;
  readonly formatNumber: NumberFormatter;
  /** A message the game module handed over (hud goal, lose reason), in the player's language. */
  readonly gameText: (message: Message) => string;
};

/** The mode line of S5, S6 and S7: "Level 12", "Daily – 26 Sep", "Endless"; none in the tutorial. */
export function modeTextOf(ref: RunRef, text: RunText): string {
  switch (ref.kind) {
    case 'level':
      return text.t(MODE_LABEL_KEYS.level, { level: ref.level });
    case 'daily':
      return text.t(MODE_LABEL_KEYS.daily, { dateText: formatDayMonth(ref.date, text.t) });
    case 'endless':
      return text.t(MODE_LABEL_KEYS.endless);
    case 'tutorial':
      return '';
  }
}

/** The goal line: the Shell's "Moves 5 / Par 7" on par levels, else the game's own message. */
export function progressTextOf(goal: GoalLine, text: RunText): string {
  return goal.kind === 'moves-par'
    ? text.t('game-screen.progress.moves-par', { moves: goal.moves, par: goal.par })
    : text.gameText(goal.message);
}

export type TopBarInput = {
  readonly view: SessionView;
  /**
   * perkOffer(useHintPerk(today), ...) from the ads layer: the free hints left come from
   * selectFreeHintsLeft(progress, today, extra.hints.freePerDay), so a game whose config gives no
   * free hint shows the key only when a rewarded ad can pay for it.
   */
  readonly hintOffer: PerkOffer;
  readonly text: RunText;
  /** Translated accessibility labels of the undo and hint buttons. */
  readonly labels: { readonly undo: string; readonly hint: string };
  readonly isReducedMotion: boolean;
  readonly onUndo: () => void;
  /** Pays for the hint (free allowance, Premium or a rewarded ad), then sends { type: 'hint' }. */
  readonly onHint: () => void;
  readonly onPause: () => void;
};

/** Undo is left out when the game has none, and disabled while no move can be undone. */
function undoTool(input: TopBarInput): GameTool | null {
  const { view } = input;
  if (!view.isUndoSupported) return null;
  return { label: input.labels.undo, isAvailable: view.canUndo, onPress: input.onUndo };
}

/** Hint: left out without solver hints or without a way to pay (spec 8.8: hidden, not broken). */
function hintTool(input: TopBarInput): GameTool | null {
  const { view } = input;
  if (!view.isHintSupported || input.hintOffer === 'hidden') return null;
  const isAvailable = view.status === 'playing' && !view.isHintShown;
  return { label: input.labels.hint, isAvailable, onPress: input.onHint };
}

/** Everything the S5 top bar (GameTopBar) shows, from the session view. */
export function topBarPropsOf(input: TopBarInput): GameTopBarProps {
  const { hud } = input.view;
  return {
    modeText: modeTextOf(hud.mode, input.text),
    progressText: progressTextOf(hud.goal, input.text),
    scoreText: input.text.formatNumber(hud.score),
    undo: undoTool(input),
    hint: hintTool(input),
    onPause: input.onPause,
    isReducedMotion: input.isReducedMotion,
  };
}
