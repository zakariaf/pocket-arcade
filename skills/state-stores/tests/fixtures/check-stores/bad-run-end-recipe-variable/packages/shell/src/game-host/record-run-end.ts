// packages/shell/src/game-host/record-run-end.ts
// Planted bug: the run-end recipe is built first and then written with save.update, so the
// progress and stats stores never re-read the document (updateAndPublish is never called).
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { RunEnd } from '@e07/shell/stores/run-end.ts';

export function recordRunEnd(save: SaveService, end: RunEnd, today: DateKey): void {
  const recipe = (doc: SaveDoc): SaveDoc => applyRunEnd(doc, end, today);
  save.update(recipe, { refreshBackup: true });
}
