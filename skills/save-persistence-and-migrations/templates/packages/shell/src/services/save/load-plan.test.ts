// packages/shell/src/services/save/load-plan.test.ts
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1, writeCount: 1 };
const GOOD = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
const BROKEN = { ...GOOD, payload: `${GOOD.payload} ` };
const NEWER = { ...GOOD, schemaVersion: 99 };

describe('planLoad', () => {
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
});
