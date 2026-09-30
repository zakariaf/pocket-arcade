// packages/shell/src/services/save/load-plan.ts
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { DecodeResult } from '@e07/shell/services/save/save-codec.ts';
import type { SlotName, SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** What the player is told (S14) and what the debug menu shows. */
export type LoadOutcome =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'migrated'; readonly from: number }
  | { readonly kind: 'restored-from-backup'; readonly reason: string }
  | { readonly kind: 'reset-after-damage'; readonly reason: string }
  /** `found`: the newer schema_version, or the newer save.db table version (user_version). */
  | { readonly kind: 'newer-version'; readonly found: number };

export type PlannedWrite =
  | { readonly kind: 'quarantine'; readonly slot: SlotName; readonly reason: string }
  /** Write plan.doc into current and backup in one transaction. */
  | { readonly kind: 'write-both' };

/** Pure result of reading both slots. Writes run later, after the direction check. */
export type LoadPlan = {
  readonly doc: SaveDoc;
  readonly outcome: LoadOutcome;
  readonly writes: readonly PlannedWrite[];
  /** true for a newer-version save: nothing is ever written this session. */
  readonly isReadOnly: boolean;
};

/** Highest write_count seen, so the counter keeps rising across launches. */
export function lastWriteCount(input: LoadInput): number {
  return Math.max(input.current?.writeCount ?? 0, input.backup?.writeCount ?? 0);
}

export type LoadInput = {
  readonly current: SlotRecord | null;
  readonly backup: SlotRecord | null;
  readonly gameId: string;
  /** SaveStore.newerStructureVersion(): save.db's tables come from a newer app. */
  readonly newerStructure?: number | null;
};

const MISSING: DecodeResult = { kind: 'damaged', reason: 'missing' };

function fromOk(decoded: Extract<DecodeResult, { kind: 'ok' }>): LoadPlan {
  const outcome: LoadOutcome =
    decoded.migratedFrom === null
      ? { kind: 'loaded' }
      : { kind: 'migrated', from: decoded.migratedFrom };
  return { doc: decoded.doc, outcome, writes: [{ kind: 'write-both' }], isReadOnly: false };
}

function readOnly(gameId: string, found: number): LoadPlan {
  return {
    doc: createDefaultSaveDoc(gameId),
    outcome: { kind: 'newer-version', found },
    writes: [],
    isReadOnly: true,
  };
}

function quarantines(input: LoadInput, reason: string): PlannedWrite[] {
  const slots: SlotName[] = [];
  if (input.current !== null) slots.push('current');
  if (input.backup !== null) slots.push('backup');
  return slots.map((slot) => ({ kind: 'quarantine', slot, reason }));
}

/** Decides what to load from the two rows. */
function planSlots(input: LoadInput): LoadPlan {
  const current = input.current === null ? MISSING : decodeSlot(input.current, input.gameId);
  if (current.kind === 'ok') return fromOk(current);
  if (current.kind === 'newer') return readOnly(input.gameId, current.version);
  const backup = input.backup === null ? MISSING : decodeSlot(input.backup, input.gameId);
  if (backup.kind === 'newer') return readOnly(input.gameId, backup.version);
  if (backup.kind === 'ok') {
    const restored = fromOk(backup);
    const bad: PlannedWrite[] =
      input.current === null
        ? []
        : [{ kind: 'quarantine', slot: 'current', reason: current.reason }];
    return {
      ...restored,
      outcome: { kind: 'restored-from-backup', reason: current.reason },
      writes: [...bad, ...restored.writes],
    };
  }
  const isFirstLaunch = input.current === null && input.backup === null;
  return {
    doc: createDefaultSaveDoc(input.gameId),
    outcome: isFirstLaunch
      ? { kind: 'fresh' }
      : { kind: 'reset-after-damage', reason: current.reason },
    writes: [...quarantines(input, current.reason), { kind: 'write-both' }],
    isReadOnly: false,
  };
}

/** Decides what to load. Every branch is covered by load-plan.test.ts. */
export function planLoad(input: LoadInput): LoadPlan {
  const newerStructure = input.newerStructure ?? null;
  return newerStructure === null ? planSlots(input) : readOnly(input.gameId, newerStructure);
}
