// packages/shell/src/app/perf/large-save-doc.ts
// The largest realistic save document (90 levels, 60 daily results, a 200-move run), validated by
// the save schema: the Jest save-write guard and the debug menu's save benchmark both write it,
// so the device number and the Jest number measure the same bytes.
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const TODAY = '2026-09-26';
const META = { appVersion: '1.0.0', writtenAtMs: 1_790_000_000_000, writeCount: 1 };

function largeCandidate(gameId: string): unknown {
  const base = createDefaultSaveDoc(gameId);
  const levels = Object.fromEntries(
    Array.from({ length: 90 }, (_, i) => [
      String(i + 1),
      { stars: 3, bestScore: 1000 + i, bestMoves: 7, completions: 2, firstCompletedOn: TODAY },
    ]),
  );
  const results = Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [
      addDays(TODAY, -i),
      { won: i % 3 !== 0, score: i * 7, moves: 11, playMs: 120_000 },
    ]),
  );
  const log = Array.from({ length: 200 }, (_, i) => ({ kind: 'move', move: { column: i % 7 } }));
  const run = {
    ...{ ref: { kind: 'level', level: 12 }, seed: 42, difficulty: 12, stateVersion: 1 },
    ...{ state: { columns: [3, 1, 4, 1, 5, 9, 2], score: 4210 }, log, moveCount: 200 },
    ...{ undoCount: 0, hintsUsed: 0, continuesUsed: 0, playMs: 900_000, resumeOnLaunch: true },
  };
  return {
    ...base,
    progress: { ...base.progress, levels },
    daily: { ...base.daily, results },
    run,
  };
}

/** The worst realistic document for `gameId`; throws if the save schema no longer accepts it. */
export function largestRealisticSaveDoc(gameId: string): SaveDoc {
  const checked = validateSaveDoc(largeCandidate(gameId));
  if ('error' in checked) throw new Error(`large save document is invalid: ${checked.error}`);
  return checked.doc;
}

/** The same document as the slot row a per-move write stores. */
export function largestRealisticSaveRecord(gameId: string): SlotRecord {
  return encodeSaveDoc(largestRealisticSaveDoc(gameId), META);
}
