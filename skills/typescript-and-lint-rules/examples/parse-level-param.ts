// packages/shell/src/screens/debug/parse-level-param.ts
// Example (a shape to imitate): an expected failure returned as a Result. Parsing outside input
// (a link parameter, a save field) fails in expected ways, so the caller must handle each kind.
// Game rules are different: the engine contract makes applyMove throw a RangeError for a move
// listMoves does not list, because that is a programming error (game-rules-engine).
import { err, ok } from '@e07/game-kit/contract/result.ts';

import type { Result } from '@e07/game-kit/contract/result.ts';

export type LevelParamError =
  | { readonly kind: 'not-a-number'; readonly raw: string }
  | { readonly kind: 'out-of-range'; readonly level: number; readonly levelCount: number };

const WHOLE_NUMBER = /^\d{1,4}$/;

/** Reads a 1-based level number ("level=12") for a game that ships levelCount levels. */
export function parseLevelParam(raw: string, levelCount: number): Result<number, LevelParamError> {
  if (!WHOLE_NUMBER.test(raw)) return err({ kind: 'not-a-number', raw });
  const level = Number(raw);
  if (level < 1 || level > levelCount) return err({ kind: 'out-of-range', level, levelCount });
  return ok(level);
}
