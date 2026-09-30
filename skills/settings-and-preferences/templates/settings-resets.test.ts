// packages/shell/src/screens/settings/settings-resets.test.ts
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { recordLevelResult } from '@e07/shell/stores/progress-reducer.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { createSettingsResets } from './settings-resets.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WIN = { level: 1, stars: 3, score: 500, moves: 7, date: '2026-09-26' } as const;

function playedOnce(doc: SaveDoc): SaveDoc {
  return {
    ...doc,
    progress: recordLevelResult(doc.progress, WIN),
    stats: { ...doc.stats, gamesPlayed: doc.stats.gamesPlayed + 1, wins: doc.stats.wins + 1 },
  };
}

function setup() {
  const test = createTestSave();
  const stores = createShellStores(test.save);
  stores.settings.getState().dispatch({ type: 'set-theme', theme: 'dark' });
  updateAndPublish(test.save, stores, { recipe: playedOnce, refreshBackup: true });
  return { ...test, stores, resets: createSettingsResets({ save: test.save, stores }) };
}

describe('createSettingsResets', () => {
  it('resets statistics in both slots and in the stats store, keeping progress', () => {
    const { resets, stores, readSlot } = setup();
    resets.onConfirmResetStats();
    expect(stores.stats.getState().stats.wins).toBe(0);
    expect(readSlot('backup').stats.wins).toBe(0);
    expect(stores.progress.getState().progress.levels['1']?.stars).toBe(3);
  });

  it('resets all progress for every store at once, keeping settings and Premium', () => {
    const { resets, stores, readSlot, save } = setup();
    const premiumBefore = save.doc().premium;
    resets.onConfirmResetProgress();
    expect(stores.progress.getState().progress.levels['1']).toBeUndefined();
    expect(stores.stats.getState().stats.gamesPlayed).toBe(0);
    expect(readSlot('backup').progress.levels['1']).toBeUndefined();
    expect(stores.settings.getState().settings.theme).toBe('dark');
    expect(readSlot('current').premium).toStrictEqual(premiumBefore);
  });
});
