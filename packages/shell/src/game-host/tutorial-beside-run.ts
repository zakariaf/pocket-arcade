// packages/shell/src/game-host/tutorial-beside-run.ts
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SectionWrite } from '@e07/shell/stores/update-and-publish.ts';

/** The two writers a run's controller gets from the host: the run section and the run end. */
export type RunWrites = {
  readonly save: SaveService;
  readonly writeRunEnd: (write: SectionWrite) => void;
};

/**
 * N10: a tutorial opened while the save holds another run (S13's "Play the tutorial again", from
 * Pause or with Continue on Home) plays beside it, in memory only: the save holds one run, and a
 * tutorial must never replace a level, daily or endless run the player can still continue. A
 * tutorial in an empty slot (the first launch) or over an older tutorial is saved as usual.
 */
export function isTutorialBesideRun(save: Pick<SaveService, 'doc'>, ref: RunRef): boolean {
  if (ref.kind !== 'tutorial') return false;
  const saved = save.doc().run;
  return saved !== null && saved.ref.kind !== 'tutorial';
}

/**
 * The save as a tutorial beside a run sees it: it reads the document and writes nothing, so its
 * moves, pause, leave and end leave the other run in the save (update answers false: the change
 * did not reach the disk).
 */
export function saveWithoutWrites(save: SaveService): SaveService {
  return { ...save, update: () => false };
}

/** The host's writers for a run of `ref`; a tutorial beside a saved run gets ones that write nothing. */
export function runWritesOf(writes: RunWrites, ref: RunRef): RunWrites {
  if (!isTutorialBesideRun(writes.save, ref)) return writes;
  return { save: saveWithoutWrites(writes.save), writeRunEnd: () => undefined };
}
