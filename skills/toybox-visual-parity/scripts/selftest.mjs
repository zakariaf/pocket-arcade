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
//
// Added 2026-10-01:
//   selftest          takes the tooling folder like every script: --tooling <dir> or
//                     PARITY_TOOLING_DIR, parsed before any case runs and handed to every suite
//                     (through the variable, which each script reads); an empty folder stops at once
//                     with exit 2 and both install forms, in either form
//   check-signoff     --draft dates an entry with the local calendar day (01:17 in Berlin on
//                     1 October is 2026-10-01, not the UTC day), and --date YYYY-MM-DD sets it
//   check-harness     S15's frame state (debug-ads-always-test): its opener, its plan, and the SKIP
//                     while S15 is outside shell-slice.json; harness-debug-flags: a parity launch
//                     clears the saved debug flags before the debug services restore them
//
//   node selftest.mjs [--tooling <repo>/.parity/tooling]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fail, parseArgs, run, runSelftest, toPosix } from './check-lib.mjs';
import { TOOLING_ENV, TOOLING_OPTION, TOOLING_REPO_DIR, installFix, toolingDirOf } from './lib/deps.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The packages every image and render check needs, by the pins of scripts/package.json.
const PINNED = [['pngjs', 'pngjs 7.0.0'], ['pixelmatch', 'pixelmatch 7.2.0'], ['playwright', 'playwright 1.63.0']];

const SPEC = {
  name: 'selftest',
  summary:
    'Proves every toybox-visual-parity script on its fixtures (good, pass-*, bad-*, error-* and the extra cases ' +
    'below), with the pinned packages from the tooling folder: --tooling <dir>, else $PARITY_TOOLING_DIR, else the ' +
    "skill's own scripts folder. The folder is checked before any case runs and handed to every script.",
  usage: '[--tooling <dir>]',
  options: { tooling: TOOLING_OPTION },
  positionals: { min: 0, max: 0 },
  details: [
    'Examples:',
    '  node selftest.mjs                                  (packages in the skill: npm ci --prefix <skill>/scripts)',
    `  node selftest.mjs --tooling <repo>/${TOOLING_REPO_DIR}   (packages in the app repo)`,
    `  ${TOOLING_ENV}=<repo>/${TOOLING_REPO_DIR} node selftest.mjs`,
  ].join('\n'),
};

// Arguments first: an unknown option stops before any case runs, and the tooling folder is checked
// once (a missing package is exit 2 with both install forms, not one failure per case). Then every
// suite gets the folder through PARITY_TOOLING_DIR, which each script reads (runSelftest parses
// process.argv itself, so the parsed arguments are taken off it).
let toolingDir = null;
await run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const dir = toolingDirOf(options);
  for (const [name, what] of PINNED) {
    if (!existsSync(join(dir, 'node_modules', name, 'package.json'))) fail(`${what} is not installed in ${toPosix(dir)}/node_modules`, installFix());
  }
  toolingDir = dir;
});
if (toolingDir === null) process.exit(process.exitCode ?? 2);
process.env[TOOLING_ENV] = toolingDir;
process.argv.splice(2);
console.log(`ok   tooling folder ${toPosix(toolingDir)} (pngjs, pixelmatch and playwright installed; every suite uses it)`);
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
// The fake xcrun writes each launch's nonce here and the fake maestro puts its marker into the dump,
// as the app's parity root does (every child script inherits the variable).
const fakeStateDir = mkdtempSync(join(tmpdir(), 'toybox-visual-parity-fake-'));
process.env.FAKE_PARITY_STATE = join(fakeStateDir, 'launch.json');
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

// frames-edit.json { "frame", "variant", "derive" }: a copy of the skill's frames manifest whose variant
// derive is replaced, so a derive that hides the wrong element must fail (variant-derive).
const editedFrames = (dir) => {
  const editPath = join(dir, 'frames-edit.json');
  if (!existsSync(editPath)) return [];
  const edit = JSON.parse(readFileSync(editPath, 'utf8'));
  const frames = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'frames.json'), 'utf8'));
  frames.frames[edit.frame].variants[edit.variant].derive = edit.derive;
  const out = join(scratch(), 'frames.json');
  writeFileSync(out, JSON.stringify(frames));
  return ['--frames', out];
};

// Every JSON template is exactly what Prettier writes (2-space indentation, a trailing newline, and
// an array of plain values on one line when it fits the repo's printWidth of 100), so format:check
// passes right after a copy. JSON.stringify(value, null, 2) alone is not that shape: it breaks
// "langs": ["en"] over three lines, which Prettier joins.
const PRINT_WIDTH = 100;
const isPlain = (value) => value === null || typeof value !== 'object';
function prettierJson(value, indent = 0, prefix = 0) {
  const pad = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPlain)) {
      const line = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (indent + prefix + line.length + 1 <= PRINT_WIDTH) return line;
    }
    return `[\n${value.map((item) => pad + prettierJson(item, indent + 2)).join(',\n')}\n${' '.repeat(indent)}]`;
  }
  if (!isPlain(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, item]) => `${pad}${JSON.stringify(key)}: ${prettierJson(item, indent + 2, JSON.stringify(key).length + 2)}`).join(',\n')}\n${' '.repeat(indent)}}`;
  }
  return JSON.stringify(value);
}
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
    return text !== `${prettierJson(JSON.parse(text))}\n`;
  });
  if (bad.length) {
    for (const path of bad) console.log(`FAIL ${path.slice(templates.length + 1)} [template-json] not the Prettier shape Fix: Run npx prettier --write on it in an app repo (2-space JSON, short arrays of plain values on one line, a trailing newline) and copy it back.`);
    console.log(`RESULT: FAIL (${bad.length} problems)`);
    process.exit(1);
  }
  const { readWaivers } = await import('./lib/runs.mjs');
  const pre = readWaivers(join(templates, 'parity', 'waivers.json'));
  if (pre.problems.length || pre.waivers.length === 0) {
    console.log(`FAIL templates/parity/waivers.json [prelisted] ${pre.problems.map((p) => p.message).join('; ') || 'no pre-listed waivers'} Fix: Keep the pre-listed waivers (dashed edges, tile 13, the S11b chip, the fa restart card) valid.`);
    console.log('RESULT: FAIL (1 problems)');
    process.exit(1);
  }
  console.log(`ok   ${walkJson(templates).length} JSON templates are Prettier-shaped; ${pre.waivers.length} pre-listed waivers are valid`);
}

// The check-harness good fixture holds the harness exactly as the templates ship it (packages/shell/src/
// app/parity/, parity-startup.tsx, parity-launch-marker.tsx), so a template change that check-harness
// would refuse (a frame's state, a plan, an export) fails here, not in an app repo.
{
  const { readdirSync } = await import('node:fs');
  const good = join(FIXTURES, 'check-harness', 'good');
  const templates = join(HERE, '..', 'templates');
  const harness = ['packages/shell/src/app/parity-startup.tsx', 'packages/shell/src/app/parity-launch-marker.tsx',
    ...readdirSync(join(templates, 'packages/shell/src/app/parity')).filter((f) => !/\.test\.tsx?$/.test(f)).map((f) => `packages/shell/src/app/parity/${f}`)];
  const differ = harness.filter((rel) => !existsSync(join(good, rel)) || readFileSync(join(good, rel), 'utf8') !== readFileSync(join(templates, rel), 'utf8'));
  if (differ.length) {
    for (const rel of differ) console.log(`FAIL tests/fixtures/check-harness/good/${rel} [harness-fixture-copy] differs from templates/${rel} Fix: Copy the template into the good fixture (and the bad fixtures that hold it), then rerun: check-harness must pass the harness as shipped.`);
    console.log(`RESULT: FAIL (${differ.length} problems)`);
    process.exit(1);
  }
  console.log(`ok   the check-harness good fixture holds the ${harness.length} harness files exactly as the templates ship them`);
}

// Checks whose answer is an exit code of 2 or a line in a passing run (runSelftest's bad-* fixtures
// must exit 1): each runs a script in a fixture folder and looks for its lines.
{
  const cases = [
    { name: 'board rectangle missing', script: 'check-parity.mjs', dir: 'exit2/board-rect-missing', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 2 },
    { name: 'facts file missing', script: 'check-parity.mjs', dir: 'exit2/facts-missing', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 2 },
    { name: 'facts without hasHints (never a guess)', script: 'check-parity.mjs', dir: 'exit2/facts-no-hints', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 2 },
    { name: 'packages missing from the --tooling folder', script: 'check-parity.mjs', dir: 'exit2/tooling-empty', args: ['.', '--waivers', 'none.json', '--no-write', '--tooling', fakeStateDir], exit: 2 },
    { name: 'facts of another design game', script: 'capture-app.mjs', dir: 'exit2/facts-wrong-game', args: ['--bundle-id', 'io.applander.linesiege', '--frame', 's11-settings', '--theme', 'light', '--lang', 'en', '--out', scratch(), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')], exit: 2 },
    { name: 'the no-music variant chosen by the facts', script: 'check-parity.mjs', dir: 'variants/s11-no-music-light-en', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 0, lines: ['reference s11-settings--no-music (variant no-music, chosen by the game facts)', '1 of 1 runs pass'] },
    { name: 'a real S11 capture whose list edge runs under the group tab (dark fa, scroll 1042)', script: 'check-parity.mjs', dir: 'variants/s11-no-music-dark-fa-y1042-tab-edge', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 0, lines: ['reference s11-settings--no-music', '1 of 1 runs pass'] },
    { name: 'the S14 reset dialog over Settings without music (a background variant)', script: 'check-parity.mjs', dir: 'variants/s14-reset-no-music-light-en', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 0, lines: ['reference s14-reset-all-progress--no-music (variant no-music, chosen by the game facts)', '1 of 1 runs pass'] },
    { name: 'the same edge drawn 2 px thicker', script: 'check-parity.mjs', dir: 'variants/s11-no-music-dark-fa-y1042-thick-edge', args: ['.', '--waivers', 'none.json', '--no-write'], exit: 1, lines: ['[border] settings.group.privacy.list: border differs: top 3.7 pt'] },
    { name: 'the change entries of a signed-off frame', script: 'check-signoff.mjs', dir: 'check-signoff/good', args: ['--frame', 's4-home', '--frame', 's11-settings', '--reference', join(FIXTURES, 'check-signoff', 'reference')], exit: 0, lines: ['reference s11-settings (base)', 'intended reference change L5 (2026-09-30)', 'light-en done | light-fa done | dark-en done | dark-fa done'], absent: ['X1', 'narrowed'] },
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
  const r = spawnSync(process.execPath, [join(HERE, 'capture-app.mjs'), '--bundle-id', 'io.applander.linesiege', '--frame', 's6-pause', '--theme', 'light', '--lang', 'en', '--out', out, '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')], { cwd: join(FIXTURES, 'capture-app-board', 'good'), encoding: 'utf8' });
  const info = existsSync(join(out, 'run.json')) ? JSON.parse(readFileSync(join(out, 'run.json'), 'utf8')) : {};
  const probeLaunch = `${r.stdout}`.includes('probe=board');
  // Every capture names its simulator and its own driver port, and proves its dumps by two nonces.
  const proved = /^[0-9a-f]{12}$/.test(info.nonce ?? '') && /^[0-9a-f]{12}$/.test(info.board?.nonce ?? '') && info.nonce !== info.board?.nonce
    && info.simulator?.udid === '11111111-2222-3333-4444-555555555555' && Number.isInteger(info.simulator?.driverPort) && info.systemAlert === null;
  if (r.status !== 0 || info.variant !== 'no-music--no-hints' || info.referenceName !== 's6-pause--no-music--no-hints' || info.board?.rect?.w !== 370 || !probeLaunch || !proved) {
    console.log(`FAIL tests/fixtures/capture-app-board/good [capture-app] exit ${r.status}, variant ${info.variant}, board ${JSON.stringify(info.board?.rect)}, probe launch ${probeLaunch}, nonces ${info.nonce}/${info.board?.nonce}, simulator ${JSON.stringify(info.simulator)} Fix: capture-app must probe the board once (probe=board), compose the variant from the facts, and record the UDID, driver port and both launch nonces.`);
    console.log('RESULT: FAIL (1 problems)');
    process.exit(1);
  }
  console.log('ok   capture-app probes the board (probe=board), composes s6-pause--no-music--no-hints from the facts, and records the UDID, driver port and both launch nonces');
}

// The self-test itself takes the tooling folder both ways: --tooling <dir> and PARITY_TOOLING_DIR.
// An empty folder makes each form stop before its first case with exit 2, naming that folder and
// both install forms (so the folder reached the check, and nothing ran on missing packages).
{
  const empty = resolve(mkdtempSync(join(tmpdir(), 'toybox-visual-parity-empty-tooling-')));
  const env = { ...process.env };
  delete env[TOOLING_ENV];
  const forms = [
    { name: '--tooling <dir>', args: ['--tooling', empty], env },
    { name: `${TOOLING_ENV}=<dir>`, args: [], env: { ...env, [TOOLING_ENV]: empty } },
  ];
  for (const form of forms) {
    const r = spawnSync(process.execPath, [join(HERE, 'selftest.mjs'), ...form.args], { env: form.env, encoding: 'utf8' });
    const out = `${r.stdout}${r.stderr}`;
    const want = [`pngjs 7.0.0 is not installed in ${toPosix(empty)}/node_modules`, 'npm ci --prefix', `pass --tooling <repo>/${TOOLING_REPO_DIR} (or set ${TOOLING_ENV}=<repo>/${TOOLING_REPO_DIR})`];
    const missing = want.filter((line) => !out.includes(line));
    if (r.status !== 2 || missing.length || /Unknown option|ok {3}type-role/.test(out)) {
      console.log(`FAIL scripts/selftest.mjs [selftest-tooling] ${form.name} on an empty folder: exit ${r.status} (want 2)${missing.length ? `, missing ${missing.map((m) => `"${m}"`).join(', ')}` : ''}${/Unknown option/.test(out) ? ', the option was refused' : ''}${/ok {3}type-role/.test(out) ? ', cases ran before the tooling check' : ''} Fix: Parse --tooling before any case, check the folder once, and hand it to every suite.`);
      console.log('RESULT: FAIL (1 problems)');
      process.exit(1);
    }
    console.log(`ok   selftest.mjs takes the tooling folder as ${form.name}: an empty one stops before any case (exit 2, both install forms)`);
  }
  rmSync(empty, { recursive: true, force: true });
}

// --draft dates an entry with the local calendar day, the product's "today": at 01:17 in Berlin on
// 1 October (23:17 UTC on 30 September) the entry says 2026-10-01; --date sets the day; a day that
// does not exist stops with exit 2. The clock is pinned with tests/fixtures/fakes/fake-clock.mjs.
{
  const dir = join(FIXTURES, 'check-signoff-draft', 'good');
  const clock = ['--import', pathToFileURL(join(FAKES, 'fake-clock.mjs')).href];
  const at = { FAKE_NOW: '2026-09-30T23:17:00Z' };
  const dated = [
    { name: 'the local day at 01:17 in Berlin on 1 October', env: { TZ: 'Europe/Berlin', ...at }, args: [], exit: 0, line: '"date": "2026-10-01"' },
    { name: 'the same moment on a Mac set to UTC', env: { TZ: 'UTC', ...at }, args: [], exit: 0, line: '"date": "2026-09-30"' },
    { name: '--date sets the day', env: { TZ: 'Europe/Berlin', ...at }, args: ['--date', '2026-09-29'], exit: 0, line: '"date": "2026-09-29"' },
    { name: '--date with a day that does not exist', env: { TZ: 'Europe/Berlin', ...at }, args: ['--date', '2026-02-30'], exit: 2, line: '--date 2026-02-30 is not a calendar day written YYYY-MM-DD' },
  ];
  for (const c of dated) {
    const r = spawnSync(process.execPath, [...clock, join(HERE, 'check-signoff.mjs'), '--draft', join(dir, 'run'), '--ledger', join(dir, 'signoff.json'), ...c.args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...c.env } });
    const out = `${r.stdout}${r.stderr}`;
    if (r.status !== c.exit || !out.includes(c.line)) {
      console.log(`FAIL tests/fixtures/check-signoff-draft/good [draft-date] ${c.name}: exit ${r.status} (want ${c.exit})${out.includes(c.line) ? '' : `, missing "${c.line}"`} Fix: Date a draft with the local calendar day (getFullYear/getMonth/getDate), never toISOString(); --date YYYY-MM-DD overrides it.`);
      console.log('RESULT: FAIL (1 problems)');
      process.exit(1);
    }
    console.log(`ok   check-signoff.mjs --draft: ${c.name} (${c.line})`);
  }
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
    args: (dir) => [...(extraArgs(dir) ?? ['--frame', 's4-home', '--themes', 'light', '--langs', 'en']), '--reference', join(dir, '..', 'reference')],
  },
  {
    script: 'check-signoff.mjs',
    fixtures: '../tests/fixtures/check-signoff-draft',
    args: (dir) => ['--draft', join(dir, 'run'), '--from-ledger', '--ledger', join(dir, 'signoff.json')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app',
    args: () => ['--bundle-id', 'io.applander.linesiege', '--frame', 's4-home', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app-board',
    args: () => ['--bundle-id', 'io.applander.linesiege', '--frame', 's6-pause', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'capture-app.mjs',
    fixtures: '../tests/fixtures/capture-app-retry',
    args: () => ['--bundle-id', 'io.applander.linesiege', '--frame', 's4-home', '--theme', 'light', '--lang', 'en', '--out', scratch(), '--settle-ms', '2000', ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
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
    args: (dir) => ['--check', ...(extraArgs(dir) ?? ['--frame', 's12-error', '--theme', 'light', '--lang', 'en']), ...(existsSync(join(dir, 'reference')) ? ['--reference', join(dir, 'reference')] : []), ...editedMap(dir), ...editedFrames(dir)],
  },
  {
    script: 'run-parity.mjs',
    fixtures: '../tests/fixtures/run-parity',
    args: (dir) => ['--frame', 's4-home', '--themes', 'light', '--langs', 'en', '--bundle-id', 'io.applander.linesiege', '--root', scratch(), '--reference', join(dir, '..', '..', 'check-parity', 'reference'), '--waivers', join(dir, 'waivers.json'), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs')],
  },
  {
    script: 'run-parity.mjs',
    fixtures: '../tests/fixtures/run-parity-session',
    args: (dir) => ['--frame', 's4-home', '--themes', 'light', '--langs', 'en', '--bundle-id', 'io.applander.linesiege', '--root', scratch(), '--reference', join(dir, '..', '..', 'check-parity', 'reference'), '--waivers', join(dir, 'waivers.json'), ...fakes, '--maestro', join(FAKES, 'fake-maestro.mjs'), ...(extraArgs(dir) ?? [])],
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
rmSync(fakeStateDir, { recursive: true, force: true });
