// packages/tooling/src/sims/write-sim-report.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fingerprintFiles, rulesFingerprint, writeSimReport } from './write-sim-report.ts';

import type { SimReport } from '@e07/game-kit/testing/balance-bands.ts';

const GAME = 'toy-game';

/** A tiny repo: the game's rules and bot, its sim, and a game-kit with used and unused files. */
const FILES: Readonly<Record<string, string>> = {
  [`apps/${GAME}/src/rules/create.ts`]:
    "import { seedRng } from '@e07/game-kit/rng/sfc32.ts';\nexport const create = seedRng;\n",
  [`apps/${GAME}/src/rules/create.test.ts`]: "import { create } from './create.ts';\n",
  [`apps/${GAME}/src/testing/${GAME}-bot.ts`]:
    "import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';\nexport type Bot = BotPolicy;\n",
  [`test/sims/${GAME}/balance.sim.test.ts`]:
    "import { traceBot } from '@e07/game-kit/testing/trace-bot.ts';\nvoid traceBot;\n",
  [`test/sims/${GAME}/balance-bands.json`]: '{}\n',
  'packages/game-kit/src/rng/sfc32.ts': 'export const seedRng = 1;\n',
  'packages/game-kit/src/rng/sfc32.test.ts': "import { seedRng } from './sfc32.ts';\n",
  'packages/game-kit/src/testing/play-bot.ts': 'export type BotPolicy = number;\n',
  'packages/game-kit/src/testing/trace-bot.ts':
    "import { seedRng } from '../rng/sfc32.ts';\nimport { gap } from './missing.ts';\nexport const traceBot = seedRng;\n",
  'packages/game-kit/src/timeline/sample.ts': 'export const sample = 1;\n',
};

describe('rulesFingerprint', () => {
  // Each test gets its own repo folder: coverage runs tests in random order.
  let root = '';

  const put = (rel: string, text: string): void => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sim-fingerprint-'));
    for (const [rel, text] of Object.entries(FILES)) put(rel, text);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('covers the game folders, the sim and only the game-kit files they import', () => {
    expect(fingerprintFiles(GAME, root)).toStrictEqual([
      `apps/${GAME}/src/rules/create.ts`,
      `apps/${GAME}/src/testing/${GAME}-bot.ts`,
      'packages/game-kit/src/rng/sfc32.ts',
      'packages/game-kit/src/testing/play-bot.ts',
      'packages/game-kit/src/testing/trace-bot.ts',
      `test/sims/${GAME}/balance.sim.test.ts`,
    ]);
  });

  it('stays the same when an unrelated game-kit file appears (a board or gesture step)', () => {
    const before = rulesFingerprint(GAME, root);
    put('packages/game-kit/src/geom/stick-command.ts', 'export const stick = 2;\n');
    put('packages/game-kit/src/timeline/sample.ts', 'export const sample = 3;\n');

    expect(rulesFingerprint(GAME, root)).toBe(before);
  });

  it('changes when a game-kit file the sim reaches only through another kit file changes', () => {
    const before = rulesFingerprint(GAME, root);
    put('packages/game-kit/src/rng/sfc32.ts', 'export const seedRng = 2;\n');

    expect(rulesFingerprint(GAME, root)).not.toBe(before);
  });

  it('stays the same when the level packs are generated after the sims', () => {
    put(`apps/${GAME}/src/levels/${GAME}-level-plan.ts`, 'export const rows = 4;\n');
    const before = rulesFingerprint(GAME, root);
    put(`apps/${GAME}/src/levels/pack-1.json`, '{ "levels": [] }\n');
    put(`apps/${GAME}/src/levels/pack-2.json`, '{ "levels": [] }\n');

    expect(rulesFingerprint(GAME, root)).toBe(before);
    expect(fingerprintFiles(GAME, root)).toContain(`apps/${GAME}/src/levels/${GAME}-level-plan.ts`);
  });

  it('changes when a rules or level-plan file changes after the packs were generated', () => {
    put(`apps/${GAME}/src/levels/pack-1.json`, '{ "levels": [] }\n');
    const before = rulesFingerprint(GAME, root);
    put(`apps/${GAME}/src/levels/${GAME}-level-plan.ts`, 'export const rows = 5;\n');
    const afterPlan = rulesFingerprint(GAME, root);
    put(`apps/${GAME}/src/rules/create.ts`, 'export const create = 2;\n');

    expect(afterPlan).not.toBe(before);
    expect(rulesFingerprint(GAME, root)).not.toBe(afterPlan);
  });

  it('changes with the rules and the sim, but not with unit tests or the bands', () => {
    const before = rulesFingerprint(GAME, root);
    put(`apps/${GAME}/src/rules/create.test.ts`, '// another test\n');
    put(`test/sims/${GAME}/balance-bands.json`, '{ "status": "approved" }\n');
    expect(rulesFingerprint(GAME, root)).toBe(before);

    put(`test/sims/${GAME}/balance.sim.test.ts`, '// seeds 1-200\n');
    expect(rulesFingerprint(GAME, root)).not.toBe(before);
  });

  it('writes the report as two-space JSON with a trailing newline', () => {
    const report = {
      gameId: GAME,
      rulesFingerprint: 'abc',
      seedsPerCell: 100,
      maxMoves: 50,
      cells: [],
    };
    const written = writeSimReport(report satisfies SimReport, root);

    expect(written).toBe(path.join(root, 'reports', 'sim', `${GAME}.json`));
    expect(readFileSync(written, 'utf8')).toBe(`${JSON.stringify(report, null, 2)}\n`);
  });
});
