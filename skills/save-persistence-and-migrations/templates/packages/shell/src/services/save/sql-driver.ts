// packages/shell/src/services/save/sql-driver.ts
/** Values we bind: no blobs, no booleans (store 0/1), no undefined. */
export type SqlValue = string | number | null;

/** A result row; values are unknown until a guard narrows them. */
export type SqlRow = Readonly<Record<string, unknown>>;

/**
 * The whole SQL surface of the app. Two implementations:
 * expo-sqlite-sql-driver.ts (device) and node-sqlite-sql-driver.ts (Jest, tooling).
 */
export type SqlDriver = {
  /** DDL and PRAGMAs; may contain several statements; no parameters. */
  readonly exec: (sql: string) => void;
  readonly run: (sql: string, params: readonly SqlValue[]) => void;
  /** First row or null. */
  readonly get: (sql: string, params: readonly SqlValue[]) => SqlRow | null;
  /** BEGIN; work(); COMMIT. On throw: ROLLBACK and rethrow. */
  readonly transaction: (work: () => void) => void;
};

/** What the driver factories return; the app never closes its main connection. */
export type ClosableSqlDriver = SqlDriver & { readonly close: () => void };
