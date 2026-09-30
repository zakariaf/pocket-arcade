// packages/tooling/src/save/inspect-save.ts
import { readFileSync } from 'node:fs';

import { ok } from '@demo/game-kit/contract/result.ts';

/** Prints a save file. */
export function inspectSave(path: string): unknown {
  return ok(readFileSync(path, 'utf8'));
}
