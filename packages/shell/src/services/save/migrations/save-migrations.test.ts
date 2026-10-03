// packages/shell/src/services/save/migrations/save-migrations.test.ts
import {
  migrateToLatest,
  runMigrations,
  SAVE_MIGRATIONS,
} from '@e07/shell/services/save/migrations/save-migrations.ts';
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

describe('save migrations', () => {
  it('has exactly one step for every version below the latest, in order', () => {
    expect(SAVE_MIGRATIONS.map((step) => step.from)).toStrictEqual(
      Array.from({ length: LATEST_SAVE_VERSION - 1 }, (_, index) => index + 1),
    );
  });

  it('leaves a latest document unchanged', () => {
    const doc = { schemaVersion: LATEST_SAVE_VERSION, gameId: 'line-siege' };
    expect(migrateToLatest(doc, LATEST_SAVE_VERSION)).toBe(doc);
  });

  it('gives up (null) on a version it has no step for', () => {
    expect(migrateToLatest({ schemaVersion: 0 }, 0)).toBeNull();
  });

  it('runs the steps in order and stamps each new version', () => {
    const steps = [
      { from: 1, migrate: (doc: Readonly<Record<string, unknown>>) => ({ ...doc, a: 1 }) },
      { from: 2, migrate: (doc: Readonly<Record<string, unknown>>) => ({ ...doc, b: 2 }) },
    ];
    expect(runMigrations(steps, { schemaVersion: 1 }, { from: 1, latest: 3 })).toStrictEqual({
      schemaVersion: 3,
      a: 1,
      b: 2,
    });
  });

  it('turns a throwing step into null (a damaged slot), never a crash', () => {
    const steps = [
      {
        from: 1,
        migrate: (): Record<string, unknown> => {
          throw new Error('bad step');
        },
      },
    ];
    expect(runMigrations(steps, { schemaVersion: 1 }, { from: 1, latest: 2 })).toBeNull();
  });
});
