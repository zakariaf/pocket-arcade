# kind values, testIDs and i18n keys

The three string grammars that saves, E2E flows and translations depend on: the `kind`/`type` discriminants of data unions and actions, the `testID` of every element a flow touches, and the semantic keys of the message catalogs. Read this before adding a move, event, action, testID, catalog key or placeholder.

## Contents

- kind and type values
- Rules that follow from the grammar
- testIDs
- Maestro selectors
- i18n keys
- Placeholders

## kind and type values

Every data union uses a `kind` discriminant, and every reducer action a `type` discriminant, whose value is a kebab-case string literal (`[a-z0-9-]` only; `kind-value`). The grammar tells which union a value belongs to:

| Union | Grammar of `kind` | Examples |
|---|---|---|
| `…Move` (player command, input to `applyMove`) | imperative verb or verb-noun | `'place-block'`, `'flip'`, `'tilt'`, `'shove'`, `'draw-card'` |
| `…Event` (fact, output of `applyMove`) | past-tense noun-verbed | `'block-placed'`, `'column-cleared'`, `'beam-fired'`, `'monster-defeated'`, `'wall-breached'`, `'cells-flipped'`, `'sheep-penned'` |
| `InputIntent` (from `useBoardGestures`) | gesture noun | `'tap'`, `'long-press'`, `'swipe'`, `'drag-end'` |
| `Track` (animation, from `buildTimeline`) | visual primitive noun | `'tween'`, `'burst'`, `'shake'`, `'flash'` |
| `Outcome` (from `outcome`) | state word | `'playing'`, `'won'`, `'lost'` |
| `…Error` (inside a `Result`) | what went wrong, noun phrase | `'newer-schema'`, `'store-unavailable'` (an illegal move is not an error value: `applyMove` throws a `RangeError`) |
| Reducer action (`type`, not `kind`) | imperative request | `'apply-move'`, `'undo'`, `'set-theme'` |

`examples/line-siege-types.ts` is Line Siege v1's real types file (synced from the library's one canonical copy): the state, the one move `'place-block'` with `trayIndex`, `col` and `row`, and fifteen past-tense events from `'block-placed'` to `'rows-emptied'`, each carrying the ids and from/to values the board and the counters need. A new game names its own the same way: `<Game>State`, `<Game>Move`, `<Game>Event`, `<Game>Result` in `apps/<game-id>/src/rules/<game-id>-types.ts` (the template game Tap Flip: `{ kind: 'flip', col, row }` and the events `'cells-flipped'`, `'board-cleared'`, `'moves-added'`).

## Rules that follow from the grammar

- One event per visible thing that happened; the name says what happened, not what to animate (`'column-cleared'`, never `'play-clear-animation'`). Sounds, haptics and counters map from events.
- `kind` values, stat-counter ids and sound ids are persisted (saves, replays, run logs, exported state). Treat them as a public format: renaming one needs a save migration, and a `Gate-Change:` trailer if a golden or fixture changes.
- Sound and haptic cue ids are kebab nouns (Line Siege's six: `'place'`, `'beam'`, `'shock'`, `'hit'`, `'pop'`, `'breach'`); statistic counter ids are kebab nouns (`'monsters-defeated'`, `'beams-fired'`, `'biggest-combo'`), unique and stable forever.
- `left`/`right`/`up`/`down` are fine as data inside rules (a swipe direction); the physical-direction ban applies only to style objects.
- Tooling and Node-side config are exempt from the kebab rule, because they talk to external formats (the App Store Connect API uses camelCase resource `type` values).

## testIDs

Format: `<scope>.<element>[.<part-or-key>…]`, every segment `[a-z0-9]+(-[a-z0-9]+)*`, at least two segments. Regex: `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`.

- `<scope>` is the screen's route name in kebab-case (`Home` → `home`, `SettingsLanguage` → `settings-language`), an overlay (`pause`, `result`), a dialog (`reset-progress-dialog`) or `debug`.
- `<element>` is a kebab noun. Interactive elements end in their role: `-button`, `-switch`, `-slider`, `-row`, `-tile`, `-card`, `-tab`. Text and containers need no suffix (`home.title`, `game.board`, `debug.network-attempts`).
- Repeated items append a stable data key, never a list index: `levels.level-tile.12`, `settings-language.language-row.ckb` (`testid-index` fails `${String(index)}`).
- Reusable components take a `testID` prop and derive their parts by appending a segment: `settings.top-bar` → `settings.top-bar.back-button`.
- testIDs are not user-visible and are never translated; they are exempt from the i18n lint rules.
- The Skia board has no internal testIDs (canvas content is invisible to the accessibility tree). Its wrapper is `game.board`; E2E taps on cells use coordinates from `BoardLayout`, which test builds publish in the `game.board-layout` text.
- Only literal testIDs are linted by ESLint. For a dynamic id, write a template literal whose static parts already follow the format: `` `levels.level-tile.${String(level)}` ``. `check-code-names.mjs` checks both forms (`testid-format`).

## Maestro selectors

Flows select by `id:` only, so they run unchanged in all four languages (`maestro-selector`):

```yaml
- tapOn:
    id: 'language-choice.continue-button'
- assertVisible:
    id: 'debug.network-attempts'
    text: '0'            # a text matcher may narrow an id selector
- extendedWaitUntil:
    visible:
      id: 'tutorial.screen'
    timeout: 10000
```

- Maestro treats the value as a regular expression; a `.` matches itself, so `home.play-button` works unescaped.
- A shorthand `tapOn: 'Play'`, `assertVisible: 'Play'`, `visible: 'Play'` or a `text:` selector without an `id:` is a text selector and fails.
- The one exception is an OS dialog that has no testID (the iOS "Open" prompt of a deep link). The verified sub-flow taps it only when it shows, and the checker accepts exactly this guard (the text under `when: visible:` equals the text tapped under `commands:`):

  ```yaml
  - runFlow:
      when:
        visible: 'Open'
      commands:
        - tapOn: 'Open'
  ```

  Any other OS-dialog line carries the marker comment: `- tapOn: 'Allow' # system dialog`.
- An `id:` value must be a valid testID (unless it is a deliberate regex or an `${ENV}` value such as `'${WAIT_FOR}'`).

## i18n keys

Grammar (checked by the catalog linter behind `npm run i18n:verify` and by `check-code-names.mjs`):

```
key        = segment "." segment [ "." segment ]{0,3}      2 to 5 segments
segment    = [a-z0-9]+ ( "-" [a-z0-9]+ )*                   lowercase ASCII kebab-case
regex      = ^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$
prefix     = the game id in game catalogs; never a game id in Shell catalogs
```

| Catalog | Location | First segment | Examples |
|---|---|---|---|
| Shell | `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json` | a screen area (the route name in kebab-case; the Game screen uses `game-screen`), or `common`, `dialog`, `date` | `home.play-button.continue`, `premium.buy-button.label`, `dialog.reset-progress.title`, `game-screen.mode.daily`, `common.back`, `date.month-short.9` |
| Game module | `apps/<game-id>/src/i18n/{en,de,fa,ckb}.json` | the game id | `line-siege.name`, `line-siege.lose.broke-through`, `line-siege.lose.board-full`, `line-siege.tutorial.step-1`, `line-siege.stats.monsters-defeated` |

- **Semantic, not textual.** `home.play-button.continue` holds "Continue - Level {level, number}". If the English wording changes, the key stays. Never put the English words into the key (`home.continue-level`).
- **The last segment names the role** when an element has several texts: `.title`, `.body`, `.label`, `.a11y-label`, `.a11y-hint`. A text iOS shows in a system dialog (an Info.plist purpose string) ends in `.usage-description` and lives under the screen area that leads to the dialog: `consent.tracking.usage-description` (S3, Apple's tracking prompt; owner decision O1). It fits the grammar (3 kebab segments, Shell area `consent`) and is plain text with no placeholders, because the build copies it into Info.plist, where nothing formats ICU (the i18n skill's `copy-deck.mjs check` rule `system-text-plain`).
- **One sentence, one key.** Plurals and selects live inside the message (`{movesCount, plural, one {# move} other {# moves}}`); never `…moves-one` / `…moves-other` keys.
- **Keys are string literals at the call site** (`t('home.play-button.continue', { level })`, `<T id="home.title" />`) or come from a typed table of literals (`THEME_LABEL_KEYS[theme]`, `MONTH_SHORT_KEYS[month - 1]`), never from string building (`` t(`date.month-short.${month}`) `` fails `i18n-key-built`). The catalog tools and the `ShellMessageKey` type can only check keys they can see.
- **Game keys are passed, not built.** The Shell never names a game key. The game hands its texts to the Shell through the `GameModule` contract as plain message ids written as literals in the game's own code (`{ id: 'line-siege.progress', values: { defeated, total } }`), each starting with the game's own id; the game's contract test proves every id exists in all four catalogs. The Shell turns them into text in one place, `gameMessageText(t, message)` in `packages/shell/src/i18n/game-message-text.ts`. A game that wants its ids in one place keeps typed tables of plain literals (`apps/<id>/src/i18n/keys.ts`, `as const` strings, no Shell import); only `game-message-text.ts` ever calls `asGameKey` (the i18n skill's `game-key-cast` rule fails any other call).
- Catalog files are flat JSON objects (key → ICU message), keys sorted alphabetically, one file per language code. The i18n-strings-and-catalogs skill owns the catalog format, ICU rules and the translation workflow.

## Placeholders

Placeholders are camelCase and name the value; they mirror the object passed to `t()` (`i18n-placeholder`):

| Value | Form | Example |
|---|---|---|
| A number | `{name, number}` | `Level {level, number}` |
| A counted noun | `{nameCount, plural, …}` | `{movesCount, plural, one {# move} other {# moves}}` |
| Free text | plain `{…Name}` or `{…Text}` | `{packName}`, `{dateText}`, `{priceText}` |

Bad: `{0}`, `{best-score}`, `{LEVEL}`, and a plain `{level}` for a number.
