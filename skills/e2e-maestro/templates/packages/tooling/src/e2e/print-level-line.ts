// packages/tooling/src/e2e/print-level-line.ts
// Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/e2e/print-level-line.ts --app <game-id> --level <n>
// Prints what a level's E2E flow taps: the first move's tap targets (region, column, row; a
// tap-then-tap game selects first), the stars action=win-level earns on that level, and the
// game bot's whole line with its taps (playBot's seed rule), for a flow that plays the level by
// hand. It loads the game's pure modules only (rules/<id>-engine.ts, testing/<id>-testing.ts,
// board/<id>-board.ts and the committed levels/pack-<n>.json tables), never the app. The logic
// lives in level-line.ts and is tested there.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { formatLevelLine, levelLine } from '@e07/tooling/e2e/level-line.ts';

import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';
import type { LineGame } from '@e07/tooling/e2e/level-line.ts';

const GAME_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
type Loaded = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Loaded => typeof value === 'object' && value !== null;

/** The first export of a game module that has every one of `keys`. */
async function exportWith(specifier: string, keys: readonly string[]): Promise<Loaded | null> {
  const loaded: unknown = await import(specifier);
  const values = isRecord(loaded) ? Object.values(loaded) : [];
  return values.filter(isRecord).find((value) => keys.every((key) => key in value)) ?? null;
}

async function loadGame(app: string): Promise<LineGame<unknown, unknown>> {
  const engine = await exportWith(`@e07/${app}/rules/${app}-engine.ts`, ['create', 'intentToMove']);
  const testing = await exportWith(`@e07/${app}/testing/${app}-testing.ts`, ['bot', 'examples']);
  if (engine === null || testing === null) {
    throw new Error(
      `apps/${app}/src: rules/${app}-engine.ts or testing/${app}-testing.ts is missing`,
    );
  }
  // A board module that needs the native Skia runtime cannot load here: no taps, the rest prints.
  const board = await exportWith(`@e07/${app}/board/${app}-board.ts`, ['layout']).catch(() => null);
  const examples = testing['examples'] as { readonly win: () => unknown };
  const game: LineGame<unknown, unknown> = {
    engine: engine as unknown as LineGame<unknown, unknown>['engine'],
    bot: testing['bot'] as LineGame<unknown, unknown>['bot'],
    winExample: examples.win,
  };
  const targetsOfMove = board?.['targetsOfMove'];
  return typeof targetsOfMove === 'function'
    ? {
        ...game,
        targetsOfMove: targetsOfMove as NonNullable<LineGame<unknown, unknown>['targetsOfMove']>,
      }
    : game;
}

/** Every committed level, from apps/<id>/src/levels/pack-<n>.json in pack order. */
function levelTable(app: string): readonly LevelEntry[] {
  const dir = join('apps', app, 'src', 'levels');
  const packs = readdirSync(dir)
    .filter((name) => /^pack-\d+\.json$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  return packs.flatMap((name) => toLevelEntries(JSON.parse(readFileSync(join(dir, name), 'utf8'))));
}

const { values } = parseArgs({
  options: { app: { type: 'string' }, level: { type: 'string', default: '1' } },
});
const app = values.app ?? '';
if (!GAME_ID.test(app)) throw new Error('pass --app <game-id> (kebab-case) and --level <n>');
const entry = levelTable(app).find((candidate) => String(candidate.level) === values.level);
if (entry === undefined) throw new Error(`apps/${app} ships no level ${values.level}`);
const result = levelLine(await loadGame(app), entry);
console.log(formatLevelLine(app, entry, result).join('\n'));
