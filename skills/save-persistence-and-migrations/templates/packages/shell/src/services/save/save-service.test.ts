// packages/shell/src/services/save/save-service.test.ts
import fc from 'fast-check';

import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import {
  createSaveService,
  keepPremiumUnlessRevoked,
} from '@e07/shell/services/save/save-service.ts';
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
  // spec 8.6: "Saved after every move and every settings change. Writes are "safe writes":
  // write the new copy, then swap, so a crash mid-write never corrupts the save." N10:
  // "Losing a player's progress is the worst bug the Shell can have."
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

  it('records a rejected document under the save area in store builds', () => {
    const errorLog = createFakeErrorLog();
    const deps = {
      store: createFakeSaveStore(),
      clock: CLOCK,
      errorLog,
      appVersion: '1.0.0',
      isStrict: false,
    };
    const save = createSaveService(
      deps,
      planLoad({ current: null, backup: null, gameId: GAME }),
      0,
    );
    save.update(loud);
    expect(errorLog.entries().map((entry) => entry.source)).toStrictEqual(['save']);
  });

  // spec 8.14: "The Shell keeps a small local error log (the debug menu can show it) and
  // recovers where possible ... never a crash loop."
  it('logs a refused write, keeps playing on the new document and reports it until a write lands', () => {
    const { store, save, errors } = setup({ isStrict: true });
    store.failNextWrite = true; // a full disk: SQLITE_FULL from the COMMIT
    expect(() => {
      save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }));
    }).not.toThrow();
    expect(errors).toStrictEqual([new Error('simulated crash before COMMIT')]);
    expect(save.doc().settings.theme).toBe('dark');
    expect(save.didLastWriteFail()).toBe(true);
    expect(store.read('current')?.writeCount).toBe(42);
    save.update((doc) => doc);
    expect(save.didLastWriteFail()).toBe(false);
    expect(store.read('current')?.payload).toContain('"theme":"dark"');
  });

  // spec 8.6: "The previous good copy is kept as a backup. A damaged save falls back to it (S14)."
  it('keeps a refused backup refresh due until a write with the backup lands', () => {
    const { store, save } = setup({ isStrict: true });
    store.failNextWrite = true;
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }), {
      refreshBackup: true,
    });
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, soundVolume: 40 } }));
    expect(save.didLastWriteFail()).toBe(false);
    expect(store.read('backup')?.payload).toBe(store.read('current')?.payload);
    expect(store.read('backup')?.writeCount).toBe(44);
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, soundVolume: 50 } }));
    expect(store.read('backup')?.writeCount).toBe(44);
    expect(store.read('current')?.writeCount).toBe(45);
  });

  it('keeps booting without a throw when the disk refuses the planned writes', () => {
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
    const errorLog = createFakeErrorLog();
    const refusing = {
      ...createFakeSaveStore(),
      write: () => {
        throw new Error('SQLITE_FULL');
      },
      quarantine: () => {
        throw new Error('SQLITE_FULL');
      },
    };
    const deps = { store: refusing, clock: CLOCK, errorLog, appVersion: '1.0.0', isStrict: true };
    const save = createSaveService(deps, plan, 7);
    expect(() => {
      save.applyLoadWrites();
    }).not.toThrow();
    expect(errorLog.entries().map((entry) => entry.message)).toStrictEqual([
      'SQLITE_FULL',
      'SQLITE_FULL',
    ]);
    expect(save.doc()).toStrictEqual(createDefaultSaveDoc(GAME));
    expect(save.didLastWriteFail()).toBe(true);
  });

  // N10: the quarantine copy is the only copy of a damaged save; nothing may overwrite it first.
  it('keeps a damaged save until its quarantine copy lands', () => {
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
    let isDiskFull = true;
    const written: unknown[] = [];
    const store = {
      ...createFakeSaveStore(),
      write: (rows: unknown) => {
        written.push(rows);
      },
      quarantine: () => {
        if (isDiskFull) throw new Error('SQLITE_FULL');
      },
    };
    const errorLog = createFakeErrorLog();
    const deps = { store, clock: CLOCK, errorLog, appVersion: '1.0.0', isStrict: true };
    const save = createSaveService(deps, plan, 7);
    save.applyLoadWrites();
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }));
    expect(written).toStrictEqual([]);
    expect(save.didLastWriteFail()).toBe(true);
    isDiskFull = false;
    save.update((doc) => doc);
    expect(written).toHaveLength(1);
    expect(save.didLastWriteFail()).toBe(false);
  });

  it('writes the backup the boot planned once a blocking quarantine copy lands', () => {
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
    let isDiskFull = true;
    const store = createFakeSaveStore();
    const deps = {
      store: {
        ...store,
        quarantine: () => {
          if (isDiskFull) throw new Error('SQLITE_FULL');
        },
      },
      clock: CLOCK,
      errorLog: createFakeErrorLog(),
      appVersion: '1.0.0',
      isStrict: true,
    };
    const save = createSaveService(deps, plan, 7);
    save.applyLoadWrites();
    isDiskFull = false;
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }));
    expect(store.read('backup')?.writeCount).toBe(8);
    expect(store.read('backup')?.payload).toContain('"theme":"dark"');
  });
});

const nullableMs = fc.option(fc.nat(), { nil: null });
const premiumArb = fc.record({
  owned: fc.boolean(),
  ownedSinceMs: nullableMs,
  lastCheckedAtMs: nullableMs,
  revokedAtMs: nullableMs,
});

describe('keepPremiumUnlessRevoked', () => {
  it('keeps owned Premium for any change that brings no revocation date', () => {
    fc.assert(
      fc.property(premiumArb, premiumArb, (before, after) => {
        const doc = createDefaultSaveDoc(GAME);
        const previous = { ...doc, premium: before };
        const next = { ...doc, premium: after };
        const kept = keepPremiumUnlessRevoked(previous, next);
        const isGuarded = before.owned && !after.owned && after.revokedAtMs === null;

        expect(kept).toStrictEqual(isGuarded ? previous : next);
      }),
    );
  });
});
