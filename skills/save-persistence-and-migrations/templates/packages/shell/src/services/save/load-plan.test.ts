// packages/shell/src/services/save/load-plan.test.ts
import fc from 'fast-check';

import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { lastWriteCount, planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1, writeCount: 1 };
const GOOD = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
const BROKEN = { ...GOOD, payload: `${GOOD.payload} ` };
const NEWER = { ...GOOD, schemaVersion: 99 };
const OUTCOME_KINDS = [
  'fresh',
  'loaded',
  'migrated',
  'restored-from-backup',
  'reset-after-damage',
  'newer-version',
];

/** Any row a phone could hold: good, bit-rotted, hand-edited, foreign or from another version. */
const rowArb = fc
  .record({
    schemaVersion: fc.integer({ min: -1, max: 3 }),
    writeCount: fc.nat(),
    payload: fc.oneof(
      fc.constant(GOOD.payload),
      fc.constant(BROKEN.payload),
      fc.string(),
      fc.jsonValue().map((value) => JSON.stringify(value)),
    ),
    hasRightChecksum: fc.boolean(),
  })
  .map(({ schemaVersion, writeCount, payload, hasRightChecksum }) => ({
    ...GOOD,
    schemaVersion,
    writeCount,
    payload,
    checksum: hasRightChecksum ? fnv1a32(payload) : 'ffffffff',
  }));
const slotArb = fc.option(rowArb, { nil: null });

describe('planLoad', () => {
  // spec 8.6: "The previous good copy is kept as a backup. A damaged save falls back to it
  // (S14)." S14: "A new version of the saved data was found ... keep it, do not touch it,
  // and ask the player to update." / "Damaged save: ... A backup copy was restored. Never a
  // crash."
  it('starts fresh on first launch and writes both slots', () => {
    const plan = planLoad({ current: null, backup: null, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'fresh' });
    expect(plan.writes).toStrictEqual([{ kind: 'write-both' }]);
  });

  it('loads a valid current and refreshes the backup', () => {
    const plan = planLoad({ current: GOOD, backup: null, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'loaded' });
    expect(plan.writes).toStrictEqual([{ kind: 'write-both' }]);
  });

  it('restores the backup and quarantines a damaged current', () => {
    const plan = planLoad({ current: BROKEN, backup: GOOD, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'restored-from-backup', reason: 'checksum' });
    expect(plan.writes[0]).toStrictEqual({
      kind: 'quarantine',
      slot: 'current',
      reason: 'checksum',
    });
  });

  it('writes nothing when the save comes from a newer app', () => {
    const plan = planLoad({ current: NEWER, backup: GOOD, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'newer-version', found: 99 });
    expect(plan.writes).toStrictEqual([]);
    expect(plan.isReadOnly).toBe(true);
  });

  it('plays read-only when save.db tables come from a newer app, whatever the rows say', () => {
    const plan = planLoad({ current: null, backup: null, gameId: 'line-siege', newerStructure: 2 });
    expect(plan.outcome).toStrictEqual({ kind: 'newer-version', found: 2 });
    expect(plan.writes).toStrictEqual([]);
    expect(plan.isReadOnly).toBe(true);
  });

  it('resets after both slots are damaged and keeps both bad copies', () => {
    const plan = planLoad({ current: BROKEN, backup: BROKEN, gameId: 'line-siege' });
    expect(plan.outcome.kind).toBe('reset-after-damage');
    expect(plan.writes.filter((write) => write.kind === 'quarantine')).toHaveLength(2);
  });

  it('treats a save of another game as damaged', () => {
    const plan = planLoad({ current: GOOD, backup: null, gameId: 'flock-tilt' });
    expect(plan.outcome).toStrictEqual({ kind: 'reset-after-damage', reason: 'game-id' });
  });

  it('restores the backup without a quarantine when current was never written', () => {
    const plan = planLoad({ current: null, backup: GOOD, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'restored-from-backup', reason: 'missing' });
    expect(plan.writes).toStrictEqual([{ kind: 'write-both' }]);
  });

  it('plays read-only when current is damaged and the backup comes from a newer app', () => {
    const plan = planLoad({ current: BROKEN, backup: NEWER, gameId: 'line-siege' });
    expect(plan.outcome).toStrictEqual({ kind: 'newer-version', found: 99 });
    expect(plan.isReadOnly).toBe(true);
  });

  // spec 8.14: "recovers where possible ... never a crash loop."
  it('yields a valid document and never throws for any two rows (spec 8.14)', () => {
    fc.assert(
      fc.property(
        slotArb,
        slotArb,
        fc.option(fc.integer({ min: 2, max: 9 }), { nil: null }),
        (current, backup, newerStructure) => {
          const plan = planLoad({ current, backup, gameId: 'line-siege', newerStructure });

          expect(validateSaveDoc(plan.doc)).toStrictEqual({ doc: plan.doc });
          expect(OUTCOME_KINDS).toContain(plan.outcome.kind);
        },
      ),
    );
  });
});

describe('lastWriteCount', () => {
  it('keeps the write counter rising from the highest count of both rows', () => {
    expect(lastWriteCount({ current: null, backup: null, gameId: 'line-siege' })).toBe(0);
    expect(
      lastWriteCount({
        current: { ...GOOD, writeCount: 7 },
        backup: { ...GOOD, writeCount: 9 },
        gameId: 'line-siege',
      }),
    ).toBe(9);
    expect(
      lastWriteCount({ current: { ...GOOD, writeCount: 4 }, backup: null, gameId: 'line-siege' }),
    ).toBe(4);
  });
});
