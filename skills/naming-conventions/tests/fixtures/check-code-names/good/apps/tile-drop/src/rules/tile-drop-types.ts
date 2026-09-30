// apps/tile-drop/src/rules/tile-drop-types.ts
export type TileDropMove =
  | { readonly kind: 'drop-tile'; readonly column: number }
  | { readonly kind: 'rotate-tile' };

export type TileDropEvent = { readonly kind: 'tile-dropped' | 'row-cleared'; readonly column: number };

export type TileDropMoveError = { readonly kind: 'column-out-of-range'; readonly column: number };

/** Left and right are fine as data inside rules. */
export type SwipeSide = 'left' | 'right';
