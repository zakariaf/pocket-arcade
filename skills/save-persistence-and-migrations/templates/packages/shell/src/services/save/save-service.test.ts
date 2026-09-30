// packages/shell/src/services/save/save-service.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { LoadPlan } from '@e07/shell/services/save/load-plan.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const GAME = 'line-siege';
const CLOCK = { nowMs: () => 1_790_000_000_000, today: () => '2026-09-26' };

function setup(options: { readonly isStrict: boolean; readonly plan?: LoadPlan }) {
  const store = createFakeSaveStore();
  const errors: unknown[] = [];
  const errorLog = {
    record: (_source: string, error: unknown) => errors.push(error),
    entries: () => [],
  };
  const plan = options.plan ?? planLoad({ current: null, backup: null, gameId: GAME });
  const deps = { store, clock: CLOCK, errorLog, appVersion: '1.0.0', isStrict: options.isStrict };
  const save: SaveService = createSaveService(deps, plan, 41);
  save.applyLoadWrites();
  return { store, errors, save };
}

const loud = (doc: SaveDoc): SaveDoc => ({
  ...doc,
  settings: { ...doc.settings, soundVolume: 150 },
});

describe('createSaveService', () => {
  it('keeps the write counter rising from the highest count found at load', () => {
    const { store } = setup({ isStrict: true });
    expect(store.read('current')?.writeCount).toBe(42);
    expect(store.read('backup')?.writeCount).toBe(42);
  });

  it('writes only the current slot unless the backup is refreshed', () => {
    const { store, save } = setup({ isStrict: true });
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }));
    expect(store.read('current')?.writeCount).toBe(43);
    expect(store.read('backup')?.writeCount).toBe(42);
    save.update((doc) => doc, { refreshBackup: true });
    expect(store.read('backup')?.writeCount).toBe(44);
  });

  it('throws on an invalid document in test builds and writes nothing', () => {
    const { store, save } = setup({ isStrict: true });
    expect(() => {
      save.update(loud);
    }).toThrow('invalid save document not written: settings.soundVolume');
    expect(store.read('current')?.writeCount).toBe(42);
    expect(save.doc().settings.soundVolume).not.toBe(150);
  });

  it('logs an invalid document in store builds, writes nothing and keeps the valid one', () => {
    const { store, save, errors } = setup({ isStrict: false });
    const before = save.doc();
    save.update(loud);
    expect(errors).toHaveLength(1);
    expect(store.read('current')?.writeCount).toBe(42);
    expect(save.doc()).toBe(before);
  });

  it('keeps Premium on unless a revocation date comes with the change', () => {
    const { save } = setup({ isStrict: true });
    const owned = { owned: true, ownedSinceMs: 1, lastCheckedAtMs: null, revokedAtMs: null };
    save.update((doc) => ({ ...doc, premium: owned }));
    save.update((doc) => ({ ...doc, premium: { ...doc.premium, owned: false } }));
    expect(save.doc().premium.owned).toBe(true);
    save.update((doc) => ({ ...doc, premium: { ...doc.premium, owned: false, revokedAtMs: 9 } }));
    expect(save.doc().premium.owned).toBe(false);
  });

  it('plays in memory and writes nothing when the save came from a newer app', () => {
    const newer = {
      ...encodeSaveDoc(createDefaultSaveDoc(GAME), {
        appVersion: '9',
        writtenAtMs: 1,
        writeCount: 7,
      }),
      schemaVersion: 99,
    };
    const plan = planLoad({ current: newer, backup: null, gameId: GAME });
    const { store, save } = setup({ isStrict: true, plan });
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }));
    expect(save.isReadOnly()).toBe(true);
    expect(save.doc().settings.theme).toBe('dark');
    expect(store.slots.size).toBe(0);
  });

  it('quarantines a damaged current at load, restores the backup, and checkpoints on request', () => {
    const good = encodeSaveDoc(createDefaultSaveDoc(GAME), {
      appVersion: '1.0.0',
      writtenAtMs: 1,
      writeCount: 7,
    });
    const plan = planLoad({
      current: { ...good, payload: `${good.payload} ` },
      backup: good,
      gameId: GAME,
    });
    const { store, save } = setup({ isStrict: true, plan });
    const checkpoint = jest.spyOn(store, 'checkpoint');
    save.checkpoint();
    expect(store.quarantined).toStrictEqual([{ slot: 'current', reason: 'checksum' }]);
    expect(store.read('current')?.payload).toBe(good.payload);
    expect(checkpoint).toHaveBeenCalledTimes(1);
  });
});
