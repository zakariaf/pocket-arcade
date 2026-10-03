// apps/toy/src/rules/toy-score.ts
import type { ToyState } from './toy-types.ts';

/** Runtime code: Stryker has mutants to make here, so the file must be in the report. */
export function scoreOf(state: ToyState): number {
  return state.score;
}
