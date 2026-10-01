#!/usr/bin/env node
// build-fixtures.mjs: rebuilds tests/fixtures/ for check-balance.mjs.
// The good repo is this skill's templates plus both worked examples with their real sim reports: Line
// Siege (turn-based: rules, bot hooks, traceBot sim, bands) and Halo Drift (real-time: a fixed-step
// sim, command policies, a runSimBot sim, bands), so the templates and both examples are proven to pass. Every bad-* fixture is a copy
// with ONE planted bug; EXPECT.txt names the rule and, where it matters, the exact file:line.
// Run after changing a template, the example or the checker:
//   node tests/build-fixtures.mjs && node scripts/selftest.mjs

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rulesFingerprint } from '../scripts/lib/balance.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..');
const FIXTURES = join(HERE, 'fixtures');
const GAME = 'line-siege';
const REPORT = `reports/sim/${GAME}.json`;
const BANDS = `test/sims/${GAME}/balance-bands.json`;
const SIM = `test/sims/${GAME}/balance.sim.test.ts`;
const TUNING = `apps/${GAME}/src/rules/${GAME}-tuning.ts`;
const RT_GAME = 'halo-drift';
const RT_REPORT = `reports/sim/${RT_GAME}.json`;
const RT_BANDS = `test/sims/${RT_GAME}/balance-bands.json`;
const RT_TUNING = `apps/${RT_GAME}/src/sim/${RT_GAME}-tuning.ts`;

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');

function replace(dir, rel, from, to) {
  const text = read(dir, rel);
  if (!text.includes(from)) throw new Error(`fixture builder: "${from}" not found in ${rel}`);
  write(dir, rel, text.replace(from, to));
}

function lineOf(dir, rel, marker) {
  const text = read(dir, rel);
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`fixture builder: marker "${marker}" not found in ${rel}`);
  return text.slice(0, index).split('\n').length;
}

function editJson(dir, rel, edit) {
  const value = JSON.parse(read(dir, rel));
  edit(value);
  write(dir, rel, `${JSON.stringify(value, null, 2)}\n`);
}

const cellOf = (report, policy, difficulty) => report.cells.find((cell) => cell.policy === policy && cell.difficulty === difficulty);

/** Re-stamps both reports with the fixture tree's own fingerprints (as a fresh npm run test:sim would). */
function stamp(dir) {
  for (const [game, report] of [[GAME, REPORT], [RT_GAME, RT_REPORT]]) {
    if (!existsSync(join(dir, report))) continue;
    editJson(dir, report, (value) => {
      value.rulesFingerprint = rulesFingerprint(dir, game);
    });
  }
}

function buildGood(dir, status = 'proposed') {
  cpSync(join(SKILL, 'templates'), dir, { recursive: true, filter: (src) => !src.includes('__GAME_ID__') });
  cpSync(join(SKILL, 'examples', GAME), dir, { recursive: true });
  cpSync(join(SKILL, 'examples', RT_GAME), dir, { recursive: true });
  write(dir, 'package.json', '{\n  "name": "e07-games",\n  "private": true,\n  "scripts": {\n    "test": "jest --ci",\n    "test:sim": "jest --ci --config jest.sim.config.js"\n  }\n}\n');
  write(dir, 'jest.config.js', "// jest.config.js (fixture excerpt): the unit project never runs bot sims.\nmodule.exports = { projects: [{ displayName: 'unit', testPathIgnorePatterns: ['/node_modules/', '\\\\.golden\\\\.test\\\\.', '\\\\.sim\\\\.test\\\\.'] }] };\n");
  if (status === 'approved') {
    for (const bands of [BANDS, RT_BANDS]) editJson(dir, bands, (value) => Object.assign(value, { status: 'approved', approvedOn: '2026-09-28' }));
  }
  stamp(dir);
}

/** Each case plants one bug and returns the lines EXPECT.txt must find. keep: do not re-stamp the report. */
const CASES = {
  'no-sim-config': (dir) => {
    rmSync(join(dir, 'jest.sim.config.js'));
    return ['[sim-config]', 'jest.sim.config.js', 'no jest.sim.config.js'];
  },
  'no-sim-script': (dir) => {
    replace(dir, 'package.json', '"test:sim": "jest --ci --config jest.sim.config.js"', '"test:sim": "jest --ci"');
    return ['[sim-config]', `package.json:${lineOf(dir, 'package.json', '"scripts"')}`, 'no "test:sim" script'];
  },
  'sims-in-npm-test': (dir) => {
    replace(dir, 'jest.config.js', ", '\\\\.sim\\\\.test\\\\.'", '');
    return ['[sim-config]', 'jest.config.js:1', 'npm test does not ignore'];
  },
  'writer-outdated': (dir) => {
    replace(dir, 'packages/tooling/src/sims/write-sim-report.ts', 'export function fingerprintFiles(', 'function fingerprintFiles(');
    return ['[harness-outdated]', 'packages/tooling/src/sims/write-sim-report.ts:1', 'no fingerprintFiles export'];
  },
  'harness-missing': (dir) => {
    rmSync(join(dir, 'packages/game-kit/src/testing/trace-bot.ts'));
    return ['[harness-missing]', 'packages/game-kit/src/testing/trace-bot.ts'];
  },
  'sim-missing': (dir) => {
    rmSync(join(dir, SIM));
    return ['[sim-missing]', `${GAME} has no bot simulation`];
  },
  'sim-in-app': (dir) => {
    const rel = `apps/${GAME}/src/rules/quick.sim.test.ts`;
    write(dir, rel, `// ${rel}\nimport { writeFileSync } from 'node:fs';\n\ndescribe('quick', () => {\n  it('writes', () => {\n    writeFileSync('x', 'y');\n  });\n});\n`);
    return ['[sim-location]', `${rel}:2`];
  },
  'sim-random': (dir) => {
    replace(dir, SIM, '      seed: index + 1,', '      seed: Math.floor(Math.random() * 1000),');
    return ['[sim-determinism]', `${SIM}:${lineOf(dir, SIM, 'Math.random')}`, 'Math.random()'];
  },
  'sim-skip': (dir) => {
    replace(dir, SIM, "  it('stays inside every band", "  it.skip('stays inside every band");
    return ['[sim-determinism]', `${SIM}:${lineOf(dir, SIM, 'it.skip(')}`, 'skipped or focused'];
  },
  'bot-clock': (dir) => {
    const rel = `apps/${GAME}/src/testing/${GAME}-bot.ts`;
    replace(dir, rel, 'export function scoreOfLineSiege(state: LineSiegeState): number {\n  return state.score;', 'export function scoreOfLineSiege(state: LineSiegeState): number {\n  return state.score + (Date.now() % 2);');
    return ['[sim-determinism]', `${rel}:${lineOf(dir, rel, 'Date.now()')}`, 'Date.now()'];
  },
  'sim-no-report': (dir) => {
    replace(dir, SIM, '    writeSimReport(report);\n', '');
    return ['[sim-harness]', `${SIM}:1`, 'does not write reports/sim'];
  },
  'sim-no-bands': (dir) => {
    replace(dir, SIM, 'expect(bandProblems(report, BANDS)).toStrictEqual([]);', 'expect(report.cells.length).toBeGreaterThan(0);');
    return ['[sim-harness]', 'does not assert bandProblems'];
  },
  'bot-missing': (dir) => {
    rmSync(join(dir, `apps/${GAME}/src/testing/${GAME}-bot.ts`));
    return ['[bot-missing]', `apps/${GAME}/src/testing/${GAME}-bot.ts`];
  },
  'bands-missing': (dir) => {
    rmSync(join(dir, BANDS));
    return ['[bands-missing]', BANDS];
  },
  'bands-bad-metric': (dir) => {
    editJson(dir, BANDS, (bands) => {
      bands.bands[0].metric = 'fun';
    });
    return ['[bands-invalid]', 'bands[0].metric is missing or invalid'];
  },
  'bands-unknown-policy': (dir) => {
    editJson(dir, BANDS, (bands) => {
      bands.curve.policy = 'expert';
    });
    return ['[bands-invalid]', 'curve names policy expert, which the grid does not run'];
  },
  'bands-few-seeds': (dir) => {
    editJson(dir, BANDS, (bands) => {
      bands.seedsPerCell = 20;
    });
    return ['[bands-invalid]', 'bands file.seedsPerCell is missing or invalid'];
  },
  'tuning-missing': (dir) => {
    rmSync(join(dir, TUNING));
    return ['[tuning-missing]', TUNING];
  },
  'tuning-undocumented': (dir) => {
    replace(dir, TUNING, '  /** Damage of each cleared row\'s shockwave to every monster but the armoured (spec 13: 2). */\n', '');
    return ['[tuning-undocumented]', `${TUNING}:${lineOf(dir, TUNING, 'shockDamage: 2')}`];
  },
  'fingerprint-scope': (dir) => {
    const rel = `apps/${GAME}/src/rules/bonus.ts`;
    write(dir, `apps/${GAME}/src/words/bonus-table.ts`, `// apps/${GAME}/src/words/bonus-table.ts\nexport const BONUS = [1, 2, 3] as const;\n`);
    write(dir, rel, `// ${rel}\nimport { BONUS } from '@e07/${GAME}/words/bonus-table.ts';\n\nexport const firstBonus = (): number => BONUS[0];\n`);
    return ['[fingerprint-scope]', `${rel}:2`, `imports @e07/${GAME}/words/bonus-table.ts`];
  },
  'fingerprint-scope-relative': (dir) => {
    const rel = `apps/${GAME}/src/testing/${GAME}-view-bot.ts`;
    write(dir, rel, `// ${rel}\nimport type { Cells } from '../board/cells.ts';\nimport { cellCount } from '../board/cells.ts';\n\nexport const count = (cells: Cells): number => cellCount(cells);\n`);
    return ['[fingerprint-scope]', `${rel}:3`, 'imports ../board/cells.ts'];
  },
  'realtime-game-unchecked': (dir) => {
    write(dir, 'apps/halo-lite/src/sim/halo-lite-sim.ts', "// apps/halo-lite/src/sim/halo-lite-sim.ts\n'worklet';\n\nexport function stepHaloLite(sim: { tick: number }): void {\n  sim.tick += 1;\n}\n");
    return ['[sim-missing]', 'halo-lite has no bot simulation', '[bot-missing]', 'apps/halo-lite/src/testing/halo-lite-bot.ts', '[tuning-missing]'];
  },
  'realtime-report-stale': (dir) => {
    replace(dir, RT_TUNING, 'chaserSpeed: 150,', 'chaserSpeed: 160,');
    return { keep: true, expect: ['[report-stale]', `${RT_REPORT}:${lineOf(dir, RT_REPORT, '"rulesFingerprint"')}`] };
  },
  'realtime-slow-payoff': (dir) => {
    editJson(dir, RT_REPORT, (report) => {
      cellOf(report, 'dodge', 0).firstPayoffShare[0] = 0.5;
    });
    return ['[first-payoff]', `${RT_BANDS}:${lineOf(dir, RT_BANDS, '"firstPayoff"')}`, 'only 0.5 of dodge d0 runs reach the first payoff within 1 moves'];
  },
  'realtime-tuning-undocumented': (dir) => {
    replace(dir, RT_TUNING, '  /** A pulse throws every chaser this close back to the edge (larger is easier). */\n', '');
    return ['[tuning-undocumented]', `${RT_TUNING}:${lineOf(dir, RT_TUNING, 'pulseRadius: 260')}`];
  },
  'report-other-game': (dir) => {
    editJson(dir, REPORT, (report) => {
      report.gameId = 'flock-tilt';
    });
    return ['[report-invalid]', `${REPORT}:${lineOf(dir, REPORT, '"gameId"')}`, 'the report is for "flock-tilt"'];
  },
  'report-missing': (dir) => {
    rmSync(join(dir, 'reports'), { recursive: true });
    return ['[report-missing]', REPORT];
  },
  'report-stale': (dir) => {
    replace(dir, TUNING, 'beamDamage: 8,', 'beamDamage: 9,');
    return { keep: true, expect: ['[report-stale]', `${REPORT}:${lineOf(dir, REPORT, '"rulesFingerprint"')}`] };
  },
  'report-invalid': (dir) => {
    editJson(dir, REPORT, (report) => {
      delete report.cells[0].winRate;
    });
    return ['[report-invalid]', 'cells[0].winRate is missing or invalid'];
  },
  'report-cell-missing': (dir) => {
    editJson(dir, REPORT, (report) => {
      report.cells = report.cells.filter((cell) => cell.policy !== 'lookahead');
    });
    return ['[report-cell-missing]', 'no lookahead d25 cell'];
  },
  'report-few-seeds': (dir) => {
    editJson(dir, REPORT, (report) => {
      report.seedsPerCell = 50;
    });
    return ['[report-invalid]', 'report ran 50 seeds'];
  },
  'cap-hit': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 50).capHits = 3;
    });
    return ['[cap-hit]', `${REPORT}:${lineOf(dir, REPORT, '"policy": "greedy",\n      "difficulty": 50')}`, '3 greedy d50 runs hit maxMoves'];
  },
  'band-violated': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 0).winRate = 0.95;
    });
    return ['[band-violated]', `${BANDS}:${lineOf(dir, BANDS, 'A reasonable player wins most first levels')}`, 'greedy d0 winRate = 0.95 is outside 0.6..0.9'];
  },
  'curve-flat': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 50).winRate = cellOf(report, 'greedy', 25).winRate;
    });
    return ['[curve]', `${BANDS}:${lineOf(dir, BANDS, '"curve"')}`, 'from d25 to d50'];
  },
  'skill-gap': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'random', 25).winRate = cellOf(report, 'greedy', 25).winRate;
    });
    return ['[skill-gap]', `${BANDS}:${lineOf(dir, BANDS, '"skillGap"')}`, 'greedy does not beat random'];
  },
  'lookahead-weak': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'lookahead', 25).winRate = cellOf(report, 'greedy', 25).winRate + 0.05;
    });
    return ['[skill-gap]', `${BANDS}:${lineOf(dir, BANDS, '"skillGap"')}`, 'lookahead does not beat greedy by 0.15 winRate at d25'];
  },
  'bot-in-other-file-random': (dir) => {
    const rel = `apps/${GAME}/src/testing/${GAME}-openings.ts`;
    write(dir, rel, `// ${rel}\n/** Picks a scripted opening for the bot. */\nexport function pickOpening(count: number): number {\n  return Math.floor(Math.random() * count);\n}\n`);
    return ['[sim-determinism]', `${rel}:4`, 'Math.random()'];
  },
  'slow-payoff': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 0).firstPayoffShare[2] = 0.4;
    });
    return ['[first-payoff]', `${BANDS}:${lineOf(dir, BANDS, '"firstPayoff"')}`, 'only 0.4 of greedy d0 runs reach the first payoff within 3 moves'];
  },
  'endless-in-grid': (dir) => {
    editJson(dir, BANDS, (bands) => {
      bands.grid.greedy.push(100);
    });
    return ['[bands-invalid]', 'grid.greedy must list level difficulties 0..99 (the endless run has its own block)'];
  },
  'endless-bad-block': (dir) => {
    editJson(dir, BANDS, (bands) => {
      bands.endless.difficulty = 75;
      bands.endless.bands[0].metric = 'winRate';
    });
    return ['[bands-invalid]', 'endless.difficulty must be 100 (ENDLESS_DIFFICULTY)', 'endless.bands[0].metric is missing or invalid'];
  },
  'endless-won': (dir) => {
    editJson(dir, REPORT, (report) => {
      Object.assign(cellOf(report, 'greedy', 100), { wins: 4, winRate: 0.04 });
    });
    return ['[endless-won]', `${BANDS}:${lineOf(dir, BANDS, '"endless"')}`, '4 endless greedy d100 runs were won'];
  },
  'endless-band-violated': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 100).medianMoves = 9;
    });
    return ['[band-violated]', `${BANDS}:${lineOf(dir, BANDS, 'An endless run outlasts a level')}`, 'endless greedy d100 medianMoves = 9 is outside 20..80'];
  },
  'endless-cell-missing': (dir) => {
    editJson(dir, REPORT, (report) => {
      report.cells = report.cells.filter((cell) => cell.difficulty !== 100);
    });
    return ['[report-cell-missing]', 'no endless greedy d100 cell in the report'];
  },
  'weak-twist': (dir) => {
    editJson(dir, REPORT, (report) => {
      cellOf(report, 'greedy', 25).twistPerRun = 0.25;
    });
    return ['[twist]', `${BANDS}:${lineOf(dir, BANDS, '"twist"')}`, 'the twist happens 0.25 times'];
  },
};

/** Named kind weights of the example, expanded the way Prettier wraps a row over 100 columns. */
const KIND_WEIGHTS = { NORMAL_ONLY: [1, 0, 0], SOME_FAST: [3, 0, 1], MIXED: [2, 1, 1] };

/** Rewrites the tuning file as Prettier would with long rows: each difficulty row and its kinds
 * object on several lines, and the endless row documented only through the DifficultyKnobs type. */
function wrapTuning(dir) {
  const text = read(dir, TUNING).replace(/^  \{ (goal: .*), kinds: ([A-Z_]+) \},$/gm, (_, knobs, kinds) => {
    const [normal, armoured, fast] = KIND_WEIGHTS[kinds];
    const lines = knobs.split(', ').map((knob) => `    ${knob},`);
    return ['  {', ...lines, '    kinds: {', `      normal: ${normal},`, `      armoured: ${armoured},`, `      fast: ${fast},`, '    },', '  },'].join('\n');
  });
  const start = text.indexOf('const ENDLESS_ROW = {');
  const end = text.indexOf('} as const satisfies DifficultyKnobs;', start);
  if (start === -1 || end === -1 || !text.includes('    kinds: {')) throw new Error('fixture builder: the tuning file no longer has the expected rows');
  const endless = text.slice(start, end).split('\n').filter((line) => !/^\s*\/\*\*.*\*\/\s*$/.test(line)).join('\n');
  write(dir, TUNING, text.slice(0, start) + endless + text.slice(end));
}

/**
 * `adjust` changes the good repo before its reports are stamped; `grow` adds files after, as a
 * later build step would, without rerunning the sims (the good repo must still pass).
 */
function buildSuite(name, status, cases, adjust = () => {}, grow = () => {}) {
  const root = join(FIXTURES, name);
  rmSync(root, { recursive: true, force: true });
  const good = join(root, 'good');
  buildGood(good, status);
  adjust(good);
  stamp(good);
  grow(good);
  for (const [caseName, plant] of Object.entries(cases)) {
    // A case named pass-<name> must pass and print its EXPECT.txt lines; every other case is bad-<name>.
    const dir = join(root, caseName.startsWith('pass-') ? caseName : `bad-${caseName}`);
    cpSync(good, dir, { recursive: true });
    const result = plant(dir);
    const { keep = false, expect } = Array.isArray(result) ? { expect: result } : result;
    if (!keep && !caseName.startsWith('report-missing')) stamp(dir);
    writeFileSync(join(dir, 'EXPECT.txt'), `${expect.join('\n')}\n`);
  }
  return Object.keys(cases).length;
}

const main = buildSuite('check-balance', 'proposed', CASES);
// G14: a Prettier-wrapped difficulty table (nested kinds objects) passes; an undocumented top-level knob still fails.
const wrapped = buildSuite('check-balance-wrapped', 'proposed', {
  'tuning-undocumented': (dir) => {
    replace(dir, TUNING, '  /** Hearts at the start; each breach costs one (fewer = harder). */\n', '');
    return ['[tuning-undocumented]', `${TUNING}:${lineOf(dir, TUNING, 'hearts: 3,')}`, 'knob "hearts: 3," has no comment'];
  },
}, wrapTuning);
// Owner decision O6: proposed bands pass a release run and print the owner step instead of failing it.
const release = buildSuite('check-balance-release', 'approved', {
  'pass-proposed': (dir) => {
    editJson(dir, BANDS, (bands) => Object.assign(bands, { status: 'proposed', approvedOn: null }));
    return ['OWNER STEP (not blocking)', `${BANDS}:${lineOf(dir, BANDS, '"status"')} [bands-unapproved]`, 'still "proposed"', 'Nothing waits for it.'];
  },
  'approved-without-date': (dir) => {
    editJson(dir, BANDS, (bands) => Object.assign(bands, { status: 'approved', approvedOn: null }));
    return ['[bands-invalid]', 'approved bands need approvedOn as YYYY-MM-DD'];
  },
});
// R2S-G16: board and gesture steps add game-kit files the sims never import (timeline/sample.ts,
// geom/stick-command.ts); the report stays fresh. A change to a kit file the sim imports
// (testing/sim-stats.ts) still makes it stale.
const KIT_GROWTH = {
  'packages/game-kit/src/timeline/sample.ts': '// packages/game-kit/src/timeline/sample.ts\nexport const sampleAt = (progress: number): number => progress;\n',
  'packages/game-kit/src/geom/stick-command.ts': '// packages/game-kit/src/geom/stick-command.ts\nexport type StickCommand = { readonly dx: number; readonly dy: number };\n',
};
const growth = buildSuite('check-balance-kit-growth', 'proposed', {
  'kit-import-changed': (dir) => {
    const rel = 'packages/game-kit/src/testing/sim-stats.ts';
    write(dir, rel, `${read(dir, rel)}// A comment is enough: the sim imports this file.\n`);
    return { keep: true, expect: ['[report-stale]', `${REPORT}:${lineOf(dir, REPORT, '"rulesFingerprint"')}`, 'the game-kit files they import'] };
  },
}, () => {}, (dir) => {
  for (const [rel, text] of Object.entries(KIT_GROWTH)) write(dir, rel, text);
});
console.log(`built fixtures: check-balance good + ${main} bad, check-balance-wrapped good + ${wrapped} bad, check-balance-release good + ${release} pass/bad, check-balance-kit-growth good + ${growth} bad`);
