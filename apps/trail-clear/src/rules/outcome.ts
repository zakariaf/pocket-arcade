// apps/trail-clear/src/rules/outcome.ts
// Trail Clear v1, checked in this order: a level whose bag is empty is won (the last tile was
// placed, whatever the score; never in the endless run, whose bag never empties); an offered tile
// that fits nowhere is lost ('no room'); otherwise playing.
import { hasRoomFor } from './placement.ts';

import type { TrailClearState } from './trail-clear-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The offered tile fits nowhere on the board. */
export const NO_ROOM_KEY = 'trail-clear.lose.no-room';

export function outcome(state: TrailClearState): Outcome {
  if (state.offered === null) return { kind: 'won', score: state.score };
  return hasRoomFor(state.cells, state.offered)
    ? { kind: 'playing' }
    : { kind: 'lost', reasonKey: NO_ROOM_KEY };
}
