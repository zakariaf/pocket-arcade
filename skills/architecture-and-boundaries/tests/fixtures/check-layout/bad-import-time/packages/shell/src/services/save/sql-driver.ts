// packages/shell/src/services/save/sql-driver.ts
/** The whole SQL surface of the app. */
export type SqlDriver = { readonly exec: (sql: string) => void };
