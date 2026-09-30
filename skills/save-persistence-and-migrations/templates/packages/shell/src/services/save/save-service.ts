// packages/shell/src/services/save/save-service.ts
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { LoadPlan } from '@e07/shell/services/save/load-plan.ts';
import type { SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** Premium only turns off with an explicit revocation date (never by reset or absence). */
export function keepPremiumUnlessRevoked(previous: SaveDoc, next: SaveDoc): SaveDoc {
  const isLost = previous.premium.owned && !next.premium.owned;
  return isLost && next.premium.revokedAtMs === null
    ? { ...next, premium: previous.premium }
    : next;
}

export type SaveServiceDeps = {
  readonly store: SaveStore;
  /** Only the write time is read (written_at, quarantined_at). */
  readonly clock: Pick<ClockPort, 'nowMs'>;
  readonly errorLog: ErrorLogPort;
  readonly appVersion: string;
  /** Test variant: an invalid document throws (fail loudly in Jest and E2E). */
  readonly isStrict: boolean;
};

/** The single writer of the save document. Stores call update(); nothing else writes. */
export type SaveService = {
  readonly doc: () => SaveDoc;
  /** Validate -> write `current` in one transaction. With refreshBackup: `backup` too. */
  readonly update: (
    recipe: (doc: SaveDoc) => SaveDoc,
    options?: { readonly refreshBackup: boolean },
  ) => void;
  readonly applyLoadWrites: () => void;
  readonly checkpoint: () => void;
  readonly isReadOnly: () => boolean;
};

/**
 * Validates, encodes and writes; the write counter keeps rising across launches. Returns false
 * (after logging, or throwing in test builds) when the document is invalid and nothing was written.
 */
function createWriter(
  deps: SaveServiceDeps,
  writeCountBase: number,
): (next: SaveDoc, isBoth: boolean) => boolean {
  let writeCount = writeCountBase;
  return (next, isBoth) => {
    const checked = validateSaveDoc(next);
    if ('error' in checked) {
      const error = new Error(`invalid save document not written: ${checked.error}`);
      deps.errorLog.record('save', error);
      if (deps.isStrict) throw error;
      return false;
    }
    writeCount += 1;
    const meta = { appVersion: deps.appVersion, writtenAtMs: deps.clock.nowMs(), writeCount };
    const record = encodeSaveDoc(checked.doc, meta);
    deps.store.write(isBoth ? { current: record, backup: record } : { current: record });
    return true;
  };
}

export function createSaveService(
  deps: SaveServiceDeps,
  plan: LoadPlan,
  writeCountBase: number,
): SaveService {
  let doc = plan.doc;
  const persist = createWriter(deps, writeCountBase);
  return {
    doc: () => doc,
    update: (recipe, options) => {
      const next = keepPremiumUnlessRevoked(doc, recipe(doc));
      // A rejected document never becomes the one in memory: the app keeps the last valid one.
      if (plan.isReadOnly || persist(next, options?.refreshBackup === true)) doc = next;
    },
    applyLoadWrites: () => {
      for (const write of plan.writes) {
        if (write.kind === 'quarantine') {
          deps.store.quarantine(write.slot, write.reason, deps.clock.nowMs());
        } else {
          persist(doc, true);
        }
      }
    },
    checkpoint: () => {
      deps.store.checkpoint();
    },
    isReadOnly: () => plan.isReadOnly,
  };
}
