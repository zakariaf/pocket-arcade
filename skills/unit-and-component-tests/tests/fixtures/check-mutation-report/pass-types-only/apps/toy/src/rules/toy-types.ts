// apps/toy/src/rules/toy-types.ts
// Types only: Stryker makes no mutant here, so the report leaves the file out.
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

export type ToyState = {
  readonly score: number;
  readonly rng: RngState;
};

/** The one move of the toy. */
export type ToyMove = { readonly kind: 'press'; readonly cell: number };
