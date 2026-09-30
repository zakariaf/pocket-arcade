// packages/shell/src/services/save/migrations/v1-to-v2.test.ts
import fc from 'fast-check';

import saveV1Full from '@e07/shell/services/save/fixtures/save-v1.full.json';
import saveV1Minimal from '@e07/shell/services/save/fixtures/save-v1.minimal.json';
import { migrateToLatest } from '@e07/shell/services/save/migrations/save-migrations.ts';
import { V1_TO_V2 } from '@e07/shell/services/save/migrations/v1-to-v2.ts';
import { validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';

describe('V1_TO_V2', () => {
  it('adds settings.textScale 100 and changes nothing else', () => {
    expect(V1_TO_V2.migrate(saveV1Minimal)).toStrictEqual({
      ...saveV1Minimal,
      settings: { ...saveV1Minimal.settings, textScale: 100 },
    });
  });

  it('turns the full v1 fixture into a valid v2 document', () => {
    const migrated = migrateToLatest(saveV1Full, 1);
    expect(validateSaveDoc(migrated)).toStrictEqual({
      doc: {
        ...saveV1Full,
        schemaVersion: 2,
        settings: { ...saveV1Full.settings, textScale: 100 },
      },
    });
  });

  it('turns every valid v1 settings section into a valid v2 document', () => {
    const settings = fc.record({
      language: fc.constantFrom(null, 'en', 'de', 'fa', 'ckb'),
      digits: fc.constantFrom('automatic', 'latin', 'local'),
      soundEnabled: fc.boolean(),
      soundVolume: fc.integer({ min: 0, max: 100 }),
      musicEnabled: fc.boolean(),
      musicVolume: fc.integer({ min: 0, max: 100 }),
      vibrationEnabled: fc.boolean(),
      theme: fc.constantFrom('system', 'light', 'dark'),
      colorBlind: fc.boolean(),
      reduceMotion: fc.constantFrom('system', 'on', 'off'),
      hintsDuringPlay: fc.boolean(),
    });
    fc.assert(
      fc.property(settings, (v1Settings) => {
        const migrated = migrateToLatest({ ...saveV1Full, settings: v1Settings }, 1);
        expect('doc' in validateSaveDoc(migrated)).toBe(true);
      }),
    );
  });
});
