// apps/tile-drop/src/rules/tile-drop-types.ts
export type TileDropEvent = { readonly kind: 'blockPlaced' | 'block-moved' };
export const FIRST_EVENT = { kind: 'ColumnCleared' } as const;
export type TileDropAction = { readonly type: 'SET_THEME' };
