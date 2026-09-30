// packages/shell/src/services/save/save-store.ts
export type SlotName = 'current' | 'backup';

/** One row of save_slots: the whole save document as JSON plus its envelope. */
export type SlotRecord = {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly writtenAtMs: number;
  readonly writeCount: number;
  /** FNV-1a 32 of payload, 8 hex chars. */
  readonly checksum: string;
  readonly payload: string;
};

/** Storage port for the save document. Knows rows, not documents. */
export type SaveStore = {
  readonly read: (slot: SlotName) => SlotRecord | null;
  /** Writes the given slots in ONE transaction. */
  readonly write: (slots: { readonly current?: SlotRecord; readonly backup?: SlotRecord }) => void;
  /** Copies a slot row into save_quarantine (kept for the debug export), bounded to 10 rows. */
  readonly quarantine: (slot: SlotName, reason: string, atMs: number) => void;
  /** PRAGMA wal_checkpoint(TRUNCATE): called when the app goes to the background. */
  readonly checkpoint: () => void;
  /**
   * The table version (PRAGMA user_version) when save.db was made by a newer app, else null.
   * Such a store reads nothing and writes nothing: the load plan turns it into the read-only
   * `newer-version` outcome (spec 8.14: never a crash loop, never overwrite a newer save).
   */
  readonly newerStructureVersion: () => number | null;
};
