// packages/shell/src/i18n/direction-guard.ts
import type { Direction } from './languages.ts';

// Remembers "we are reloading to reach this direction" across one JS reload.
export type DirectionGuard = {
  readonly readPending: () => Direction | null;
  readonly writePending: (direction: Direction | null) => void;
};
