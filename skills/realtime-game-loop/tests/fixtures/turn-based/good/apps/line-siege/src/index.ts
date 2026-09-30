// apps/line-siege/src/index.ts
import { LINE_SIEGE_ENGINE } from './rules/line-siege-engine.ts';

/** The game module (other members omitted in this fixture): a turn-based game has no real-time spec. */
export const LINE_SIEGE_MODULE = {
  engine: LINE_SIEGE_ENGINE,
  realtime: null,
} as const;
