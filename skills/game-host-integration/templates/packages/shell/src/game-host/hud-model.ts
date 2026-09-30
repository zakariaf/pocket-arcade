// packages/shell/src/game-host/hud-model.ts
import type { Hud } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';
import type { Message } from '@e07/game-kit/contract/messages.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/**
 * The goal/progress line of the S5 top bar. Par-rated levels show the Shell's "Moves 5 / Par 7"
 * (game-screen.progress.moves-par); every other run shows the game's own hud().goal message.
 */
export type GoalLine =
  | { readonly kind: 'moves-par'; readonly moves: number; readonly par: number }
  | { readonly kind: 'game'; readonly message: Message };

/** Plain data for the top bar; the screen turns it into text with t(). */
export type HudView = {
  /** The S5 mode label: Level 12 / Daily - 26 Sep / Endless (the tutorial shows none). */
  readonly mode: RunRef;
  readonly goal: GoalLine;
  readonly score: number;
};

export type HudInput = {
  readonly ref: RunRef;
  readonly moveCount: number;
  readonly hud: Hud;
  /** The level's table entry (for par); null for daily, endless and tutorial runs. */
  readonly entry: LevelEntry | null;
};

/** Everything the top bar shows, from the session, the game's hud() and the level entry. */
export function hudView(input: HudInput): HudView {
  const { entry } = input;
  const goal: GoalLine =
    input.ref.kind === 'level' && entry?.stars.kind === 'par'
      ? { kind: 'moves-par', moves: input.moveCount, par: entry.stars.par }
      : { kind: 'game', message: input.hud.goal };
  return { mode: input.ref, goal, score: input.hud.score };
}

/** Shell catalog keys of the mode label, one per run kind (the tutorial shows no label). */
export const MODE_LABEL_KEYS = {
  level: 'game-screen.mode.level',
  daily: 'game-screen.mode.daily',
  endless: 'common.mode.endless',
  tutorial: null,
} as const;
