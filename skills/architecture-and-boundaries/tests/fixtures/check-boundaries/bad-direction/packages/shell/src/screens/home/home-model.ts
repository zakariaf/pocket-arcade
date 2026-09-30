// packages/shell/src/screens/home/home-model.ts
import { applyMove } from '@demo/tile-drop/rules/apply-move.ts';
import { inspectSave } from '@demo/tooling/save/inspect-save.ts';

/** Home model. */
export function homeModel(): unknown {
  return [applyMove, inspectSave];
}
