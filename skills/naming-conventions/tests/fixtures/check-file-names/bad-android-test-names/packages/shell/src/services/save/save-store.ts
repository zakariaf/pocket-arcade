// packages/shell/src/services/save/save-store.ts
/** Storage port for the save document. */
export type SaveStore = { readonly checkpoint: () => void };
