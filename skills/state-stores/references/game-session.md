# The GameSession: one run as pure data

A run (one level, the daily, an endless run or the tutorial) is a `GameSession`: the game engine's state plus what the Shell tracks around it (undo history, move log, counters, status). It is changed only by the pure `gameSessionReducer`, held in a per-run vanilla store, and written to the save's `run` section before anything animates. `scripts/check-reducers.mjs` runs the reducer against the rules below.

## Contents

- The game contract parts a session uses
- The session type and actions
- What each action does
- Design choices
- The per-run store: reduce, persist, publish
- When the run is written
- Saved run: write and restore
- Tests every game adds
- Files

## The game contract parts a session uses

From `@e07/game-kit/contract/` (the game-rules work owns these types; the session only picks from them):

```ts
type Outcome =
  | { readonly kind: 'playing' }
  | { readonly kind: 'won'; readonly score: number }
  | { readonly kind: 'lost'; readonly reasonKey: string };
type ApplyResult<TState, TEvent> = { readonly state: TState; readonly events: readonly TEvent[] };
// GameEngine: create(seed, difficulty), applyMove(state, move) -> ApplyResult, outcome(state), ...
type UndoPolicy = { kind: 'none' } | { kind: 'unlimited' } | { kind: 'limited'; perLevel: number };
type ContinuePolicy<TState, TEvent> =
  | { kind: 'none' }
  | { kind: 'once'; descriptionId: MessageId; apply: (lost: TState) => ApplyResult<TState, TEvent> };
// PersistenceSpec: stateVersion, parseState(json), parseMove(json), migrateState(json, from), savePolicy
type SavePolicy =
  | { kind: 'after-every-move' }
  | { kind: 'save-points'; points: readonly ('wave-end' | 'turn-end' | 'pause' | 'background' | 'level-end')[] };
```

`SessionRules<TState, TMove, TEvent>` is `Pick<GameEngine, 'create' | 'applyMove' | 'outcome'> & Pick<GameRules, 'undo' | 'continueRun'>`, so tests pass a tiny rules object (the counter game in `testing/counter-game.ts`).

## The session type and actions

```ts
type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';
type RunLogEntry<TMove> = { kind: 'move'; move: TMove } | { kind: 'continue' };

type GameSession<TState, TMove, TEvent> = {
  ref: RunRef;              // { kind: 'level', level } | { kind: 'daily', date } | { kind: 'endless' } | { kind: 'tutorial' }
  seed: number; difficulty: number;
  state: TState;
  past: readonly TState[];  // states before each undoable move (memory only)
  log: readonly RunLogEntry<TMove>[];
  status: SessionStatus; outcome: Outcome;
  moveCount: number; undoCount: number; hintsUsed: number; continuesUsed: number; playMs: number;
  lastEvents: readonly TEvent[]; eventSeq: number;  // the board host animates when eventSeq changes
};

type SessionAction<TMove> =
  | { type: 'apply-move'; move: TMove } | { type: 'undo' } | { type: 'use-continue' }
  | { type: 'use-hint' } | { type: 'pause' } | { type: 'resume' } | { type: 'add-play-time'; ms: number };
```

All fields are `readonly` in the real file (`game-session-types.ts`). `startGameSession(rules, { ref, seed, difficulty })` creates the first session: `state = rules.create(seed, difficulty)`, empty history, status from `rules.outcome(state)`.

## What each action does

| Action | When it changes the session | Result |
|---|---|---|
| `apply-move` | only while `playing` | state from `applyMove`, `past` + the previous state, `log` + `{ kind: 'move' }`, `moveCount + 1`, `lastEvents` = events, `eventSeq + 1`, status from the new outcome |
| `undo` | while `playing`, the last log entry is a move, and the policy allows it (`none`: never; `unlimited`: always; `limited`: `undoCount < perLevel`) | previous state back, `past` and `log` shortened by one, `moveCount - 1`, `undoCount + 1`, `lastEvents` empty, `eventSeq + 1` |
| `use-continue` | only when `lost`, the policy is `once` and `continuesUsed` is 0 (spec 8.10: one continue per run) | the policy's `apply(state)`, `log` + `{ kind: 'continue' }`, `past` cleared, `continuesUsed = 1` |
| `pause` | only from `playing` | `status: 'paused'` |
| `resume` | only from `paused` | `status: 'playing'` |
| `use-hint` | always (the host decides whether a hint is allowed and which move it shows) | `hintsUsed + 1` |
| `add-play-time` | only while `playing` | `playMs + ms` |

Every refused action returns the same session object, so the store skips the write and the render.

## Design choices

- **Undo keeps states, the save keeps moves.** In memory `past` holds full states for instant undo; the save stores the move `log` plus the current `state` snapshot, and a relaunch rebuilds `past` by replaying the log. A long run stays a few kilobytes on disk.
- **A continue clears the undo history.** A continue is a one-time rescue, not a way to rewind further.
- **The reducer trusts its moves.** It only receives moves the engine produced as legal (`intentToMove` results, which a contract test checks are in `listMoves`). A move while paused or finished is ignored.
- **Hints are counted here;** the hint move comes from the game's hint policy, and the budget from the progress store (one free hint per day), a rewarded ad, or Premium.
- **Play time accumulates only while playing,** from frame-clock or AppState deltas the host clamps, so a clock jump never adds hours.

## The per-run store: reduce, persist, publish

```ts
const store = createGameSessionStore({
  rules,
  initial: startGameSession(rules, start),        // or restoreRun(...).session for a saved run
  persist: createRunWriter(save, game.persistence),
});
// dispatch: next = gameSessionReducer(rules, current, action); if (next === current) return;
//           persist(next, action); set({ session: next });
```

- One store per run, created by the game host; never a module singleton.
- `persist` runs before `set`, so the new session is on disk before the board animates its events (a kill during an animation loses nothing).
- Components read it with a selector: `useGameSession(store, (state) => state.session.moveCount)`.

## When the run is written

| Moment | Write | Backup refreshed |
|---|---|---|
| `apply-move`, `undo`, `use-continue`, `use-hint` in a turn-based game (`after-every-move`) | `run` with `resumeOnLaunch: true` | no |
| Pause, app to background, Game screen loses focus | `run` with the current `playMs` | no |
| Pause, then Home | `run` with `resumeOnLaunch: false` (`writeRunForHome`) | no |
| Real-time save point (wave end, pause, background) | `run` from the real-time snapshot plus its `(tick, command)` log (the real-time loop's writer) | no |
| Run ends (won or lost; for a daily, the first finished attempt) | `run: null` plus level result, statistics, daily result and ad history, in ONE update | yes |
| Restart level | `run` for the new session | no |

`shouldWriteRun(action, savePolicy, status)` encodes the first rows: `pause` always writes; a `save-points` game writes nothing per move; won and lost sessions are left to the run-end write; `resume` and `add-play-time` alone never write. The run-end write happens before the result screen (S7: "stars and statistics are saved BEFORE this screen appears") and before the result animation.

## Saved run: write and restore

```ts
toSavedRun(session, persistence.stateVersion, shouldResumeOnLaunch): SaveRun
// { ref, seed, difficulty, stateVersion, state, log, moveCount, undoCount, hintsUsed,
//   continuesUsed, playMs, resumeOnLaunch }   -- `past` is never stored

restoreRun(rules, persistence, saved):
  | { kind: 'restored'; session; hasHistory }
  | { kind: 'dropped'; reason: 'state-invalid' | 'state-not-migratable' }
```

- The snapshot is the truth. `restoreRun` parses the state (`parseState` for the same `stateVersion`, `migrateState` for an older one); `null` drops the run alone, never the save.
- With the same `stateVersion`, the log is parsed (`parseMove`) and replayed from `create(seed, difficulty)` to rebuild `past`. If the replay does not reproduce the snapshot exactly (a determinism bug, or rules changed without a `stateVersion` bump), the snapshot is kept, only the undo history is dropped (`hasHistory: false`), and the host logs it to the error log (source `'save'`). The player keeps their position.
- A restored run that is still playing starts `paused`: relaunching inside a level shows the Pause menu (spec S5), never a running game.
- `resumeOnLaunch: true` makes the boot land on Game (paused) above Home; `false` (Pause, then Home) lands on Home with "Continue - Level 12".

## Tests every game adds

- Property: after any legal move sequence, undoing k moves (within the undo policy) equals the state k moves earlier.
- Property: replaying the saved log from `create(seed, difficulty)` reproduces the snapshot (`restoreRun(...).hasHistory` is true).
- The Shell's own tests (templates) cover the reducer with the counter game: a move is recorded, undo stops at `perLevel`, a paused run ignores moves, exactly one continue after a loss, restore paused with history, snapshot kept when the replay disagrees, dropped runs, `shouldWriteRun` for every action and policy, `createRunWriter` writes the current slot only, and Pause-then-Home keeps the run with `resumeOnLaunch: false`.

## Files

| App path | Role |
|---|---|
| `packages/shell/src/game-host/game-session-types.ts` | types above |
| `packages/shell/src/game-host/game-session-reducer.ts` | `startGameSession`, `canUndo`, `gameSessionReducer` |
| `packages/shell/src/game-host/game-session-store.ts` | `createGameSessionStore`, `useGameSession` |
| `packages/shell/src/game-host/saved-run.ts` | `toSavedRun`, `restoreRun` |
| `packages/shell/src/game-host/run-writer.ts` | `shouldWriteRun`, `createRunWriter`, `writeRunForHome` |
| `packages/shell/src/testing/counter-game.ts` | tiny rules and persistence for tests |
