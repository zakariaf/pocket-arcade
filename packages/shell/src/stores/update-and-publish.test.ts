// packages/shell/src/stores/update-and-publish.test.ts
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { recordLevelResult } from '@e07/shell/stores/progress-reducer.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WIN = { level: 1, stars: 3, score: 500, moves: 7, date: '2026-09-26' } as const;

function runEnd(doc: SaveDoc): SaveDoc {
  return {
    ...doc,
    run: null,
    progress: recordLevelResult(doc.progress, WIN),
    stats: { ...doc.stats, gamesPlayed: doc.stats.gamesPlayed + 1, wins: doc.stats.wins + 1 },
  };
}

describe('updateAndPublish', () => {
  it('writes several sections in one update, then every store re-reads them', () => {
    const { save, readSlot, store } = createTestSave();
    const stores = createShellStores(save);
    const before = store.read('current')?.writeCount ?? 0;
    updateAndPublish(save, stores, { recipe: runEnd, refreshBackup: true });
    expect(store.read('current')?.writeCount).toBe(before + 1);
    expect(readSlot('backup').progress.levels['1']?.stars).toBe(3);
    expect(stores.progress.getState().progress.levels['1']?.stars).toBe(3);
    expect(stores.stats.getState().stats.wins).toBe(1);
  });

  it('publishes nothing new when the write throws', () => {
    const { save, store } = createTestSave();
    const stores = createShellStores(save);
    store.failNextWrite = true;
    expect(() => {
      updateAndPublish(save, stores, { recipe: runEnd, refreshBackup: true });
    }).toThrow('simulated crash before COMMIT');
    expect(stores.stats.getState().stats.wins).toBe(0);
  });
});
