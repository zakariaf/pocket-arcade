# intentToMove: from intent to a legal move

`intentToMove(state, intent) → Move | null` is the one place where a game decides what a touch means. Read this before writing a game's `apps/<game-id>/src/rules/intent-to-move.ts`.

## Contents

- Rules for intentToMove
- The rules types the template assumes (Tap Flip)
- Pattern: tap to act
- Pattern: drag to place, with a lift
- Pattern: tap-then-tap (select, then target)
- Pattern: swipe to slide
- Pattern: aim to shoot
- Pattern: long-press to flag
- Tests

## Rules for intentToMove

- **Pure and deterministic.** It lives in `rules/` (the pure, deterministic zone): no React, React Native, Expo, Skia or Shell imports, no clock, no `Math.random`, no transcendental `Math.*`, no `**`.
- **Legality is "listMoves(state) lists it", nothing else.** Build the candidate move from the intent, then return it only if an equal move is in `listMoves(state)`. `listMoves` is empty once the run is over (won or lost), so a tap on a finished board gives `null` without a separate `outcome` check, and gestures, bots, the solver and the engine contract test share one definition of legal. The engine contract test (game-kit's `engineContractProblems`) fails any move `intentToMove` returns that `listMoves` does not list.
- **Exhaustive over intent kinds.** A `switch (intent.kind)` with every kind listed (`tap`, `long-press`, `swipe`, `drag-end`, `aim`); kinds the game ignores return `null` explicitly. The lint rule `switch-exhaustiveness-check` then catches a new kind.
- **Check the region id** (`target.regionId === 'board'`) before building a move from a target.
- **Never add a finger offset.** The drag lift is applied once, in the gesture layer (`dragLiftPt`); `intent.to` already is the lifted cell, the same cell the ghost was drawn on.
- **Never read or return a selection move.** A tap-then-tap selection is UI state the board host keeps; it arrives as `intent.selected` (next patterns).
- **Quantise floats before they enter state.** An aim vector becomes integers (thousandths of a unit vector) so saves are compact and replays exact.
- **Moves are data** with a kebab-case `kind` (`'flip'`, `'place-block'`, `'tilt'`, `'shoot'`), JSON-serialisable, and they go through `applyMove` like any other move (saved first, then animated).

## The rules types the template assumes (Tap Flip)

Every template of the game skills targets one template game, Tap Flip, so the rules templates (`game-rules-engine`), the board templates (`board-rendering-skia`) and this input template compile together in one app. The template imports `__GAME_PASCAL__State` and `__GAME_PASCAL__Move` from `apps/<game-id>/src/rules/<game-id>-types.ts`, and `listMoves` from `./list-moves.ts`:

```ts
export type Cell = 0 | 1;                         // 0 = dark, 1 = lit
export type TapFlipState = {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly Cell[];               // row-major: index = row * cols + col
  readonly moves: number;
  readonly maxMoves: number;
};
export type TapFlipMove = { readonly kind: 'flip'; readonly col: number; readonly row: number };
export type TapFlipEvent =
  | { readonly kind: 'cells-flipped'; readonly cells: readonly number[] }
  | { readonly kind: 'board-cleared' }
  | { readonly kind: 'moves-added'; readonly count: number };
```

Its test builds states with `create(seed, difficulty)` from `./create.ts`. A real game renames the types and replaces `candidate()`; the `listMoves` guard stays.

## Pattern: tap to act

The template (`templates/game/rules/intent-to-move.ts`): a tap on a board cell is a flip of that cell.

```ts
function candidate(intent: InputIntent): TapFlipMove | null {
  switch (intent.kind) {
    case 'tap':
      return intent.target.regionId === 'board' ? { kind: 'flip', col: intent.target.col, row: intent.target.row } : null;
    case 'long-press': case 'swipe': case 'drag-end': case 'aim':
      return null;
  }
}
export function intentToMove(state: TapFlipState, intent: InputIntent): TapFlipMove | null {
  const move = candidate(intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => listed.col === move.col && listed.row === move.row) ? move : null;
}
```

A game with several move kinds compares the whole move (`JSON.stringify(listed) === JSON.stringify(move)`, as Line Siege does).

## Pattern: drag to place, with a lift

Line Siege (`examples/line-siege/rules/intent-to-move.ts`, the verified original): a drag from a tray slot to a board cell places that slot's block with its top-start (anchor) cell on the released cell, `{ kind: 'place-block', trayIndex, col, row }`. The engine declares `panMode: 'drag'`.

- The gesture layer reports `{ kind: 'drag-end', from, to }`: `from` is where the finger went down (never lifted), `to` is the hit-test of the **lifted** release point (`dragLiftPt` above the finger, 0 by default). The ghost is drawn from the same lifted pointer, so the ghost cell equals the placed cell. `intentToMove` uses `intent.to` as it is.
- A board with a lift keeps at least `dragLiftPt` of canvas below its last row (Line Siege: the tray area in portrait, a free strip of `DRAG_LIFT_PT` below the board when the tray stands beside it), so every edge row stays reachable. `examples/line-siege/board/drag-lift.test.ts` proves "the ghost cell is the placed cell", and `hit-targets.test.ts` proves every edge row is reachable in portrait and wide layouts.
- The tray lies in one row in portrait and in one column when wide, so the slot is `target.col + target.row`.

## Pattern: tap-then-tap (select, then target)

Line Siege's primary control is "tap a block, then tap the grid"; Jump Chain works the same way (tap a piece, then its target). The selection is **UI state held by the board host**. It is never game state and never a move, so bots, sims, the witness solver, par, undo and the move counters never see it.

- The engine declares the regions whose taps select instead of act: `GameEngine.selectRegions` (Line Siege: `['tray']`; most games: `[]`).
- The gesture layer always sends `{ kind: 'tap', target, selected: null }`. The host fills `selected` in: a tap inside a select region toggles the selection (tapping the same target again clears it) and is announced to VoiceOver; any other tap is passed to `intentToMove(state, { ...intent, selected })`. A non-null move is applied and clears the selection; the selection also clears on undo, restart, run end and a tap outside every region (the gesture layer's `onMiss`: a successful tap whose `hitTest` is `null` calls it instead of sending an intent), and a drag-end ignores it and clears it.
- `intentToMove` returns `null` for a tap inside a select region (it only selects), and builds the move from `intent.selected` plus `intent.target` for the second tap:

```ts
case 'tap':
  return placeMove(intent.selected, intent.target);   // null when nothing is selected or the target is not a board cell
case 'drag-end':
  return placeMove(intent.from, intent.to);           // the one-gesture shortcut to the same move
```

- The board draws the selection from `frame.highlight.selected` (Line Siege rings the selected tray slot) and the hinted move from `frame.highlight.hinted` (the host passes `board.targetsOfMove(state, controller.hintedMove())`).
- The engine contract test checks both sides: taps inside `selectRegions` return `null`, and moves made from taps with a selection are listed.

## Pattern: swipe to slide

Flock Tilt, Merge Siege, Dock Slide: the swipe's physical direction is the move; the start cell does not matter. See the skill's `examples/flock-tilt/intent-to-move.ts`. Return `null` when the tilt would change nothing (no piece can move), so a wasted swipe does not cost a move.

## Pattern: aim to shoot

Bank Shot: pull back and release; the launch goes opposite to the drag. Ignore short drags (a dead zone of about 20 pt), normalise with `Math.sqrt` (exact under IEEE 754), and quantise to integers. See the skill's `examples/bank-shot/intent-to-move.ts`.

## Pattern: long-press to flag

Dig Site, Floodline, Deep Sweep: `long-press` → `{ kind: 'flag', col, row }`, `tap` → `{ kind: 'reveal', col, row }`. Offer the same action without a hold for VoiceOver users (a flag-mode toggle in the Game screen that turns taps into flags).

## Tests

`templates/game/rules/intent-to-move.test.ts` shows the minimum:

- each intent kind the game uses maps to the right move;
- illegal targets (a cell off the grid, another region, a drop off the board) give `null`;
- a finished run gives `null`: one test on a won state and one on a lost state (`listMoves` is empty for both);
- intents the game ignores give `null`;
- a fast-check property with a fixed seed: every non-null move is one `listMoves(state)` lists.

Games with tap-then-tap add: a tap in a select region gives `null`, a board tap without a selection gives `null`, and a board tap with a selection gives the listed move (the Line Siege example test).
