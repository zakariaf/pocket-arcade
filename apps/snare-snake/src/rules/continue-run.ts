// apps/snare-snake/src/rules/continue-run.ts
// Spec 8.10: "Games may allow one continue per level or run". Snare Snake's continue (design
// notes, rule 9) rescues both ways of losing: the snake gets continueMoves more moves, and when it
// is boxed in (no allowed move, whatever the lose reason: a snake tangled by its last allowed move
// loses out of moves) it also steps back one cell (its head segment is removed, so the cell the
// head came from is free again and the old neck has a way out). Pure, like applyMove; one per run.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { outcome } from './outcome.ts';
import { TUNING } from './snare-snake-tuning.ts';
import { openDirections } from './steering.ts';

import type { SnareSnakeEvent, SnareSnakeResult, SnareSnakeState } from './snare-snake-types.ts';

/** rules.continueRun.apply: a lost run made playable again, with the events that explain it. */
export function continueAfterLoss(lost: SnareSnakeState): SnareSnakeResult {
  const result = outcome(lost);
  if (result.kind !== 'lost' || lost.hasContinued) {
    throw new RangeError('a continue needs a lost run that has not continued yet (spec 8.10)');
  }
  const events: SnareSnakeEvent[] = [];
  let snake = lost.snake;
  if (openDirections(lost).length === 0) {
    // A tangled snake always has a neck: one segment never tangles, because the cell it came from
    // stays free (critters never hop next to the snake).
    snake = lost.snake.slice(1);
    events.push({
      kind: 'snake-stepped-back',
      from: pickAt(lost.snake, 0),
      to: pickAt(snake, 0),
      length: snake.length,
    });
  }
  events.push({ kind: 'moves-added', count: TUNING.continueMoves });
  const maxMoves = Math.max(lost.maxMoves, lost.moves) + TUNING.continueMoves;
  return { state: { ...lost, snake, maxMoves, hasContinued: true }, events };
}
