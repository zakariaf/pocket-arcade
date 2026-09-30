#!/usr/bin/env node
// Self-test of every toybox-visual-parity script: each good fixture must pass and each planted
// defect must fail with the lines of its EXPECT.txt. Needs the pinned packages (npm ci --prefix
// scripts) and Google Chrome; no simulator (capture-app and setup-parity-sim run against the fake
// xcrun and maestro in tests/fixtures/fakes/).
//
//   check-parity      real RN captures of the research probe (good, and a build with 4 planted
//                     defects), the Toybox Home reference with one planted defect per case, both
//                     sides of the fill and bounds tolerances, waivers of each class (platform,
//                     platform-text-shaping, design-artefact) and their invalid forms, a scrolled capture of a
//                     tall frame (fixed top bar, clipped body, pinned banner) with planted moves, and
//                     the reach policy: crop-only parts (hidden logo, icon inside a button) are never
//                     "missing" when Maestro omits them, yet a wrong part fails its cover's crop;
//                     real S11 and S4 Premium captures for the text-ink gate: a pushed-in segment's
//                     corner, a half-point scroll with Rubik 14 inside its role limit (and 1 px past
//                     it), a tilted sticker moved 2 px (its text moved 4 pt fails), a label in the wrong colour, and the border
//                     gate skipping the side a group tab draws without a border (a real side still fails)
//   make-sheet        sheets for a failing run and for a scrolled tall capture (a real S11 capture
//                     at scroll 1170 whose bounds failure is cropped from the window it shows);
//                     stale report, a report without viewRect, wrong device, missing reference
//   check-signoff     the sign-off ledger: every way a frame can look done without being done;
//                     --draft --from-ledger keeps the recorded differences of the same variant, and
//                     refuses stale sheets and a broken ledger
//   capture-app       still screen, root testID on screen, unchanged during the hierarchy dump
//                     (a late load is settled and dumped again; a screen that never stops is not)
//   setup-parity-sim  the dedicated simulator is ready (check mode) and gets ready (apply mode)
//   shoot-design      a re-render equals the committed reference set; drift is caught, also when a
//                     changed testID map reaches a reference (an element dropped from it)
//   run-parity        the loop end to end on the fake simulator: capture, check, sheet, summary;
//                     a second session's simulator name and Maestro driver port reach every capture
//   check-harness     the app's test-only parity harness is complete, knows every design frame, loads
//                     the fixtureSave copy unchanged, types no price, is exported and wired into the
//                     Shell's startup, stays test-only (tests may import it), and the component specs
//                     hold the edge widths the references draw
//   import-design     the design copy is exactly a fresh import of the mockup
//   check-testids     the screen testID map against the design (shared fixtures)
//
// Reference variants, game facts and the board mask (added 2026-09-30):
//   capture-app-board a Game-route frame is probed once (probe=board) and its reference variant is
//                     picked from parity/game-facts.json; a probe without game.board-layout fails
//   check-parity      the board of s6-pause masked (a game's own board painted in stays silent, the
//                     top bar and the Pause dialog are still gated), a run captured against the
//                     wrong variant, a pre-listed dashed-edge waiver that applies (and its absence)
//   exit 2            a Game-route run without a board rectangle, a frame with variants and no
//                     facts file, a facts file for another design game (never a guess)
//   variants          the no-music Settings variant, chosen by the facts, passes check-parity; a real
//                     dark fa capture whose list edge runs under a group tab passes the border gate
//                     (the band ends at the outside colour), and the same edge 2 px thicker fails
//   check-signoff     prints the intended reference changes of the frames it signs off
//   templates         every JSON template is Prettier-shaped (2 spaces, trailing newline), and the
//                     pre-listed waivers of templates/parity/waivers.json are valid
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'tests', 'fixtures');
const FAKES = join(FIXTURES, 'fakes');
// Scripts that write (captures, sheets) write into throwaway folders, made on first use and
// removed at the end.
let scratchRoot = null;
const scratch = () => {
  scratchRoot ??= mkdtempSync(join(tmpdir(), 'toybox-visual-parity-selftest-'));
  return mkdtempSync(join(scratchRoot, 'run-'));
};
const extraArgs = (dir) => (existsSync(join(dir, 'args.json')) ? JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')) : null);
const fakes = ['--xcrun', join(FAKES, 'fake-xcrun.mjs')];
// map-edit.json { "dropTestID": "<id>" }: a copy of the skill's testID map without that element, so a
// map change that reaches a reference (one element fewer measured) must show as drift.
const editedMap = (dir) => {
  const editPath = join(dir, 'map-edit.json');
  if (!existsSync(editPath)) return [];
  const { dropTestID } = JSON.parse(readFileSync(editPath, 'utf8'));
  const map = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'screen-testids.json'), 'utf8'));
  for (const screen of map.screens) screen.elements = screen.elements.filter((el) => el.testID !== dropTestID);
  const out = join(scratch(), 'screen-testids.json');
  writeFileSync(out, JSON.stringify(map));
  return ['--map', out];
};

// The type-role floors are pinned twice: in gates.mjs (what the gate uses) and in
// references/what-exact-means.md (the evidence). Either one moving alone fails the self-test.
{
  const { TEXT_ROLE_FLOORS, textRoleFloor } = await import('./lib/gates.mjs');
  const doc = readFileSync(join(HERE, '..', 'references', 'what-exact-means.md'), 'utf8');
  const problems = [];
  let pinned = 0;
  for (const [family, table] of Object.entries(TEXT_ROLE_FLOORS)) {
    const row = doc.split('\n').find((line) => line.startsWith(`| ${family} |`));
    if (!row) {
      problems.push(`no floor row for ${family}`);
      continue;
    }
    const documented = Object.fromEntries([...row.matchAll(/(\d+): ([\d.]+) \(([\d.]+)\)/g)].map((m) => [m[1], { floor: Number(m[2]), limit: Number(m[3]) }]));
    for (const [size, floor] of Object.entries(table)) {
      const d = documented[size];
      const limit = textRoleFloor(`400 ${size}px ${family}`).centrePt;
      if (!d || d.floor !== floor || d.limit !== limit) problems.push(`${family} ${size}: gates.mjs has floor ${floor} (limit ${limit}), the reference ${d ? `${d.floor} (${d.limit})` : 'nothing'}`);
      else pinned += 1;
    }
    for (const size of Object.keys(documented)) if (!(size in table)) problems.push(`${family} ${size}: documented but not in gates.mjs`);
  }
  if (problems.length) {
    for (const p of problems) console.log(`FAIL references/what-exact-means.md [role-floors] ${p} Fix: Change both together, with the probe evidence.`);
    console.log(`RESULT: FAIL (${problems.length} problems)`);
    process.exit(1);
  }
  console.log(`ok   type-role floors: ${pinned} sizes in gates.mjs equal the evidence table in what-exact-means.md`);
}

// A scrolled capture's failing element is cropped from the design window the capture shows: for S11
// at scroll 1170 the settings.version crop must start at screen y 844 (page y 2013), not at the
// Display group that sits at y 844 of the unscrolled page.
{
  const out = scratch();
  const run = spawnSync(process.execPath, [join(HERE, 'make-sheet.mjs'), join(FIXTURES, 'make-sheet-scrolled', 'good'), '--out', out], { encoding: 'utf8' });
  const want = 'crops/settings.version.png: design 24,844 of the window this capture shows (page y 2013)';
  if (run.status !== 0 || !run.stdout.includes(want)) {
    console.log(`FAIL tests/fixtures/make-sheet-scrolled/good [crop-window] make-sheet.mjs exited ${run.status} without "${want}" Fix: Crop the design side from the view window (problem.viewRect).`);
    console.log('RESULT: FAIL (1 problems)');
    process.exit(1);
  }
  console.log('ok   make-sheet crops a scrolled bounds failure from the window the capture shows');
}

// Every JSON template is exactly what Prettier writes (2-space indentation, a trailing newline), so
// format:check passes right after a copy.
{
  const { readdirSync, statSync } = await import('node:fs');
  const templates = join(HERE, '..', 'templates');
  const walkJson = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkJson(path);
    return name.endsWith('.json') ? [path] : [];
  });
  const bad = walkJson(templates).filter((path) => {
    const text = readFileSync(path, 'utf8');
    return text !== `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  });
  if (bad.length) {
    for (const path of bad) console.log(`FAIL ${path.slice(templates.length + 1)} [template-json] not the Prettier shape Fix: Write it as JSON.stringify(value, null, 2) plus a newline.`);
    console.log(`RESULT: FAIL (${bad.length} problems)`);
    process.exit(1);
  }
  const { readWaivers } = await import('./lib/runs.mjs');
  const pre = readWaivers(join(templates, 'parity', 'waivers.json'));
  if (pre.problems.length || pre.waivers.length === 0) {
    console.log(`FAIL templates/parity/waivers.json [prelisted] ${pre.problems.map((p) => p.message).join('; ') || 'no pre-listed waivers'} Fix: Keep the pre-listed dashed-edge and tile-13 waivers valid.`);
    console.log('RESULT: FAIL (1 problems)');
    process.exit(1);
  }
  console.log(`ok   ${walkJson(templates).length} JSON templates are Prettier-shaped; ${pre.waivers.length} pre-listed waivers are valid`);
}

// Checks whose answer is an exit code of 2 or a line in a passing run (runSelftest's bad-* fixtures
// must exit 1): each runs a script in a fixture folder and looks for its lines.
{
  const cases = [
    { name: 'board rectangle missing', script: 'check-parity.mjs', dir: 'exit2/board-rect-missing', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 2 },
    { name: 'facts file missing', script: 'check-parity.mjs', dir: 'exit2/facts-missing', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 2 },
    { name: 'facts of another design game', script: 'capture-app.mjs', dir: 'exit2/facts-wrong-game', args: ['--bundle-id', 'com.example.linesiege.test', '--frame', 's11-settings', '--theme', 'light', '--lang', 'en', '--out', scratch(), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')], exit: 2 },
    { name: 'the no-music variant chosen by the facts', script: 'check-parity.mjs', dir: 'variants/s11-no-music-light-en', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 0, lines: ['reference s11-settings--no-music (variant no-music, chosen by the game facts)', '1 of 1 runs pass'] },
    { name: 'a real S11 capture whose list edge runs under the group tab (dark fa, scroll 1042)', script: 'check-parity.mjs', dir: 'variants/s11-no-music-dark-fa-y1042-tab-edge', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 0, lines: ['reference s11-settings--no-music', '1 of 1 runs pass'] },
    { name: 'the same edge drawn 2 px thicker', script: 'check-parity.mjs', dir: 'variants/s11-no-music-dark-fa-y1042-thick-edge', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 1, lines: ['[border] settings.group.privacy.list: border differs: top 3.7 pt'] },
    { name: 'the change entries of a signed-off frame', script: 'check-signoff.mjs', dir: 'check-signoff/good', args: ['--frame', 's4-home', '--frame', 's11-settings', '--themes', 'light', '--langs', 'en', '--reference', join(FIXTURES, 'check-signoff', 'reference')], exit: 0, lines: ['reference s11-settings (base)', 'intended reference change L5 (2026-09-30)'], absent: ['X1'] },
  ];
  for (const c of cases) {
    const dir = join(FIXTURES, c.dir);
    const r = spawnSync(process.execPath, [join(HERE, c.script), ...c.args], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = `${r.stdout}${r.stderr}`;
    const expected = [...(c.lines ?? []), ...(existsSync(join(dir, 'EXPECT.txt')) ? readFileSync(join(dir, 'EXPECT.txt'), 'utf8').split('\n').filter(Boolean) : [])];
    const missing = expected.filter((line) => !out.includes(line));
    const present = (c.absent ?? []).filter((line) => out.includes(line));
    if (r.status !== c.exit || missing.length || present.length) {
      console.log(`FAIL tests/fixtures/${c.dir} [${c.script}] ${c.name}: exit ${r.status} (want ${c.exit})${missing.length ? `, missing ${missing.map((m) => `"${m}"`).join(', ')}` : ''}${present.length ? `, should not print ${present.join(', ')}` : ''} Fix: Restore the behaviour this fixture pins.`);
      console.log('RESULT: FAIL (1 problems)');
      process.exit(1);
    }
    console.log(`ok   ${c.script} ${c.name} (exit ${r.status})`);
  }
  // capture-app on a Game-route frame: the probe's board rectangle and the facts' variant land in run.json.
  const out = scratch();
  const r = spawnSync(process.execPath, [join(HERE, 'capture-app.mjs'), '--bundle-id', 'com.example.linesiege.test', '--frame', 's6-pause', '--theme', 'light', '--lang', 'en', '--out', out, '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')], { cwd: join(FIXTURES, 'capture-app-board', 'good'), encoding: 'utf8' });
  const info = existsSync(join(out, 'run.json')) ? JSON.parse(readFileSync(join(out, 'run.json'), 'utf8')) : {};
  const probeLaunch = `${r.stdout}`.includes('probe=board');
  if (r.status !== 0 || info.variant !== 'no-music' || info.board?.rect?.w !== 370 || !probeLaunch) {
    console.log(`FAIL tests/fixtures/capture-app-board/good [capture-app] exit ${r.status}, variant ${info.variant}, board ${JSON.stringify(info.board?.rect)}, probe launch ${probeLaunch} Fix: capture-app must probe the board once (probe=board) and pick the variant from the facts.`);
    console.log('RESULT: FAIL (1 problems)');
    process.exit(1);
  }
  console.log('ok   capture-app probes the board (probe=board) and picks s6-pause--no-music from the facts');
}

await runSelftest(import.meta.url, [
  {
    script: 'check-parity.mjs',
    fixtures: '../tests/fixtures/check-parity',
    args: (dir) => [...(existsSync(join(dir, 'run.json')) ? [dir] : ['--runs', dir]), '--waivers', join(dir, 'waivers.json'), '--no-write'],
  },
  {
    script: 'make-sheet.mjs',
    fixtures: '../tests/fixtures/make-sheet',
    args: (dir) => [dir, '--out', scratch()],
  },
  {
    script: 'make-sheet.mjs',
    fixtures: '../tests/fixtures/make-sheet-tall',
    args: (dir) => [dir, '--out', scratch()],
  },
  {
    script: 'make-sheet.mjs',
    fixtures: '../tests/fixtures/make-sheet-scrolled',
    args: (dir) => [dir, '--out', scratch()],
  },
  {
    script: 'check-signoff.mjs',
    fixtures: '../tests/fixtures/check-signoff',
    args: (dir) => [...(extraArgs(dir) ?? ['--frame', 's4-home', '--themes', 'light']), '--langs', 'en', '--reference', join(dir, '..', 'reference')],
  },
  {
    script: 'check-signoff.mjs',
    fixtures: '../tests/fixtures/check-signoff-draft',
    args: (dir) => ['--draft', join(dir, 'run'), '--from-ledger', '--ledger', join(dir, 'signoff.json')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app',
    args: () => ['--bundle-id', 'com.example.linesiege.test', '--frame', 's4-home', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app-board',
    args: () => ['--bundle-id', 'com.example.linesiege.test', '--frame', 's6-pause', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app-retry',
    args: () => ['--bundle-id', 'com.example.linesiege.test', '--frame', 's4-home', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'setup-parity-sim.mjs',
    fixtures: '../tests/fixtures/setup-parity-sim',
    args: () => ['--appearance', 'light', '--check', ...fakes],
  },
  {
    script: 'setup-parity-sim.mjs',
    fixtures: '../tests/fixtures/setup-parity-sim-apply',
    args: () => ['--appearance', 'light', ...fakes],
  },
  {
    script: 'shoot-design.mjs',
    fixtures: '../tests/fixtures/shoot-design',
    args: (dir) => ['--check', '--frame', 's12-error', '--theme', 'light', '--lang', 'en', ...(existsSync(join(dir, 'reference')) ? ['--reference', join(dir, 'reference')] : []), ...editedMap(dir)],
  },
  {
    script: 'run-parity.mjs',
    fixtures: '../tests/fixtures/run-parity',
    args: (dir) => ['--frame', 's4-home', '--themes', 'light', '--langs', 'en', '--bundle-id', 'com.example.linesiege.test', '--root', scratch(), '--reference', join(dir, '..', '..', 'check-parity', 'reference'), '--waivers', join(dir, 'waivers.json'), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'run-parity.mjs',
    fixtures: '../tests/fixtures/run-parity-session',
    args: (dir) => ['--frame', 's4-home', '--themes', 'light', '--langs', 'en', '--bundle-id', 'com.example.linesiege.test', '--root', scratch(), '--reference', join(dir, '..', '..', 'check-parity', 'reference'), '--waivers', join(dir, 'waivers.json'), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs'), ...(extraArgs(dir) ?? [])],
  },
  {
    script: 'check-harness.mjs',
    fixtures: '../tests/fixtures/check-harness',
    args: (dir) => [dir],
  },
  {
    script: 'import-design.mjs',
    fixtures: '../tests/fixtures/import-design',
    args: (dir) => [join(dir, 'original.html'), '--out', join(dir, 'copy.html'), '--check'],
  },
  {
    script: 'check-testids.mjs',
    fixtures: '../tests/fixtures/check-testids',
    args: (dir) => {
      const design = existsSync(join(dir, 'design.html')) ? join(dir, 'design.html') : join(dir, '..', 'good', 'design.html');
      return ['--map', join(dir, 'map.json'), '--design', design];
    },
  },
]);

if (scratchRoot) rmSync(scratchRoot, { recursive: true, force: true });
