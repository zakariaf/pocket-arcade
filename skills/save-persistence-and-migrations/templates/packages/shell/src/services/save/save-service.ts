// packages/shell/src/services/save/save-service.ts
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { LoadPlan } from '@e07/shell/services/save/load-plan.ts';
import type { SaveStore, SlotName } from '@e07/shell/services/save/save-store.ts';
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
  /**
   * true after the store refused the last write (SQLITE_FULL, I/O error): the error is in the
   * error log and the session plays on in memory; false again once a write lands. The UI may read
   * it to say progress is not being saved.
   */
  readonly didLastWriteFail: () => boolean;
};

type Writer = {
  /**
   * Validates, encodes and writes; the write counter keeps rising across launches. Returns false
   * (after logging, or throwing in test builds) when the document is invalid and nothing was
   * written; a refused write still returns true, so the session plays on in memory. A backup
   * refresh that did not land stays due: every later write includes the backup until one lands.
   */
  readonly persist: (next: SaveDoc, isBoth: boolean) => boolean;
  /** Copies a damaged slot to quarantine; a refused copy stays pending and blocks every write. */
  readonly quarantine: (slot: SlotName, reason: string) => void;
  readonly didLastWriteFail: () => boolean;
};

type Attempt = (write: () => void) => boolean;

/**
 * N10: a quarantine copy is the only copy of a damaged slot, so no slot is written while one is
 * still pending. flush() retries every pending copy and is true when none is left.
 */
function createQuarantineQueue(deps: SaveServiceDeps, attempt: Attempt) {
  let pending: readonly { readonly slot: SlotName; readonly reason: string }[] = [];
  const flush = (): boolean => {
    pending = pending.filter(
      (copy) =>
        !attempt(() => {
          deps.store.quarantine(copy.slot, copy.reason, deps.clock.nowMs());
        }),
    );
    return pending.length === 0;
  };
  const add = (slot: SlotName, reason: string): void => {
    pending = [...pending, { slot, reason }];
    flush();
  };
  return { flush, add };
}

function createWriter(deps: SaveServiceDeps, writeCountBase: number): Writer {
  let writeCount = writeCountBase;
  let didFail = false;
  // N10: a run end, reset or Premium change must reach the backup even if its own write failed.
  let isBackupDue = false;
  const attempt: Attempt = (write) => {
    try {
      write();
      return true;
    } catch (error) {
      // Spec 8.14: never a crash loop. Boot writes run on every launch, so a throw here would
      // stop every launch on a full disk; the next write that lands clears the flag.
      didFail = true;
      deps.errorLog.record('save', error);
      return false;
    }
  };
  const quarantines = createQuarantineQueue(deps, attempt);
  const persist = (next: SaveDoc, isBoth: boolean): boolean => {
    const checked = validateSaveDoc(next);
    if ('error' in checked) {
      const error = new Error(`invalid save document not written: ${checked.error}`);
      deps.errorLog.record('save', error);
      if (deps.isStrict) throw error;
      return false;
    }
    isBackupDue = isBackupDue || isBoth;
    if (!quarantines.flush()) return true;
    writeCount += 1;
    const meta = { appVersion: deps.appVersion, writtenAtMs: deps.clock.nowMs(), writeCount };
    const record = encodeSaveDoc(checked.doc, meta);
    const isWritten = attempt(() => {
      deps.store.write(isBackupDue ? { current: record, backup: record } : { current: record });
    });
    if (isWritten) {
      didFail = false;
      isBackupDue = false;
    }
    return true;
  };
  return { persist, quarantine: quarantines.add, didLastWriteFail: () => didFail };
}

export function createSaveService(
  deps: SaveServiceDeps,
  plan: LoadPlan,
  writeCountBase: number,
): SaveService {
  // Capture only what the closures read, so the loaded document is not kept alive all session.
  const { isReadOnly, writes } = plan;
  let doc = plan.doc;
  const { persist, quarantine, didLastWriteFail } = createWriter(deps, writeCountBase);
  return {
    doc: () => doc,
    update: (recipe, options) => {
      const next = keepPremiumUnlessRevoked(doc, recipe(doc));
      // A rejected document never becomes the one in memory: the app keeps the last valid one.
      if (isReadOnly || persist(next, options?.refreshBackup === true)) doc = next;
    },
    applyLoadWrites: () => {
      for (const write of writes) {
        if (write.kind === 'quarantine') {
          quarantine(write.slot, write.reason);
        } else {
          persist(doc, true);
        }
      }
    },
    checkpoint: () => {
      deps.store.checkpoint();
    },
    isReadOnly: () => isReadOnly,
    didLastWriteFail,
  };
}
