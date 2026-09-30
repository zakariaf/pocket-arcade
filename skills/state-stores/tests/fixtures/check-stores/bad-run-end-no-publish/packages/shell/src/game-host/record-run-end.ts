// packages/shell/src/game-host/record-run-end.ts
// Planted bug: the run end is written with save.update, so the progress and stats stores never
// re-read the document and Home keeps showing the old stars until the next app start.
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { RunEnd } from '@e07/shell/stores/run-end.ts';

export function recordRunEnd(save: SaveService, end: RunEnd, today: DateKey): void {
  save.update((doc) => applyRunEnd(doc, end, today), { refreshBackup: true });
}
