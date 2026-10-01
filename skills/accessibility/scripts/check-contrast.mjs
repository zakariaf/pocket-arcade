#!/usr/bin/env node
// check-contrast.mjs: proves every game palette meets WCAG 2.2 AA in all modes and schemes (the
// Toybox pair set), that the Shell colours under text and icons do too, that every board palette
// (board-palettes.json) keeps its declared pairs readable and its pieces apart for colour-blind
// players, that piece colours stay apart, and that quality-gates.json keeps the accessibility budgets.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-contrast.mjs [repo-root] [--palette file] [--tokens file] [--categorical #a,#b,...]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run, toPosix } from './check-lib.mjs';
import { ConstantsError, loadTsConstants } from './lib/load-ts-constants.mjs';
import { BOARD_SETS, COLOR_BLIND_SETS, composite, contrastRatio, DEFICIENCIES, FILL_EDGES, MIN_CVD_DISTANCE, minPairwiseDistance, PALETTE_PAIRS, SHELL_PAIRS } from './lib/wcag.mjs';

const SPEC = {
  name: 'check-contrast',
  summary: 'Checks colour accessibility: each apps/<game>/src/theme/palette.ts (or a Toybox tokens file) against the WCAG 2.2 AA pairs of the Toybox design, the Shell colours in packages/shell/src/theme/shell-colors.ts, each apps/<game>/src/board/board-palettes.json against the pairs its board-contrast.json declares, colour-blind separation of piece colours, and the a11y budgets in quality-gates.json.',
  usage: '[options] [repo-root]',
  options: {
    tokens: { type: 'string', value: 'file', help: 'Also check every game palette in a Toybox tokens.json (color.games.<id>.colorTokens)' },
    palette: { type: 'string', multiple: true, value: 'file', help: 'Check this palette.ts, palette .json or board-palettes.json instead of discovering them (the shape is detected)' },
    categorical: { type: 'string', multiple: true, value: 'list', help: 'Comma-separated #RRGGBB piece colours that must stay apart' },
    allow: { type: 'string', multiple: true, value: 'pair', help: 'Owner-approved exception, printed as a note: <scheme or set>:<fg>/<bg>' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  palette-shape      Toybox palettes: standard and colorBlind modes, light and dark, all 16 ColorTokens as #RRGGBB;',
    '                     board palettes: light, dark, colorBlindLight, colorBlindDark with identical keys, #RRGGBB(AA)',
    '  text-contrast      text, textMuted on background/surface/sunken; onPrimary/primary; onPop/pop;',
    '                     danger/surface: at least 4.5:1 (danger text only ever sits on surface)',
    '  non-text-contrast  icon and border on background/surface; starOff/surface; focus on background/sunken: 3:1;',
    '                     each fill (primary, pop on background; starOn on surface) 3:1 off its border or its ground',
    '  shell-contrast     toast text, ad text, sticker ink on gold, text and textMuted on dangerFill (the error',
    '                     note) and danger on dangerFill (the hold label while the fill grows under it, and the',
    '                     danger icons on dangerFill tiles): 4.5:1 in both schemes, with no exception',
    '  board-pairs        every board-palettes.json has a board-contrast.json beside it naming existing tokens:',
    '                     { "edge": token, "text": [[fg, bg]], "graphics": [[fg, bg]], "shapes": [[fill, ground]],',
    '                       "distinct": [[token, token, ...]] }',
    '  board-contrast     in all four board sets: text pairs 4.5:1, graphics 3:1, and each shape 3:1 off its ink edge',
    '                     or its ground; translucent #RRGGBBAA colours are composited over their ground first',
    '  cvd-separation     piece colours (--categorical, and each board "distinct" list in the colour-blind sets)',
    '                     at least 0.07 apart in OKLab under protan/deutan/tritan simulation',
    '  a11y-gates         quality-gates.json a11y: minTouchPt >= 44, maxFontScale = 2, textContrastMin >= 4.5,',
    '                     nonTextContrastMin >= 3, minCvdDistanceOk >= 0.07',
    '',
    'Accent, pop and star fills may sit close to the ground: Toybox edges every control with the ink',
    'outline, which is the boundary WCAG 1.4.11 measures (border vs background/surface). A fill must',
    'still stand 3:1 off that outline or off its ground (the dark paints rely on the second). Boards',
    'follow the same rule for the shapes their draw() edges with the "edge" token.',
    '',
    'Examples: node check-contrast.mjs .   node check-contrast.mjs . --palette apps/line-siege/src/board/board-palettes.json',
  ].join('\n'),
};

const TOKENS = ['background', 'surface', 'sunken', 'text', 'textMuted', 'primary', 'onPrimary', 'pop', 'onPop', 'border', 'shadow', 'danger', 'focus', 'icon', 'starOn', 'starOff'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_ALPHA = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const BOARD_CONTRAST_FILE = 'board-contrast.json';
const BOARD_PAIR_KINDS = [
  ['text', 4.5, 'text-contrast'],
  ['graphics', 3, 'non-text-contrast'],
];
const GATES = [
  ['minTouchPt', (v) => v >= 44, '>= 44'],
  ['maxFontScale', (v) => v === 2, '= 2'],
  ['textContrastMin', (v) => v >= 4.5, '>= 4.5'],
  ['nonTextContrastMin', (v) => v >= 3, '>= 3'],
  ['minCvdDistanceOk', (v) => v >= 0.07, '>= 0.07'],
];

function isPalette(value) {
  return Boolean(value && typeof value === 'object' && value.standard && value.colorBlind);
}

function isBoardPalette(value) {
  return Boolean(value && typeof value === 'object' && !value.standard && BOARD_SETS.some((set) => set in value));
}

/** Reads a palette file; the shape decides the kind: { kind: 'toybox' | 'board', palette }. */
function loadPaletteFile(file) {
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const data = JSON.parse(text);
    if (isBoardPalette(data)) return { kind: 'board', palette: data };
    if (isPalette(data)) return { kind: 'toybox', palette: data };
    throw new ConstantsError(`${basename(file)} is neither a Toybox palette { standard, colorBlind } nor a board palette { ${BOARD_SETS.join(', ')} }`);
  }
  const constants = loadTsConstants(text, basename(file));
  const found = Object.values(constants).filter(isPalette);
  if (found.length !== 1) throw new ConstantsError(`${basename(file)} must export exactly one Palette (found ${found.length})`);
  return { kind: 'toybox', palette: found[0] };
}

function discover(root, shown) {
  const sources = [];
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return sources;
  for (const id of readdirSync(apps).sort()) {
    for (const rel of ['src/theme/palette.ts', 'src/board/board-palettes.json']) {
      const file = join(apps, id, rel);
      if (existsSync(file)) sources.push({ label: shown(file), file });
    }
  }
  return sources;
}

/** The pair lists of a board-contrast.json, or the problems that make it unusable. */
function readBoardDeclaration(file, tokens) {
  if (!existsSync(file)) return { problems: [`no ${BOARD_CONTRAST_FILE} beside the board palette says which colours sit on which`] };
  let decl;
  try {
    decl = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { problems: [`${BOARD_CONTRAST_FILE} is not valid JSON: ${error.message}`] };
  }
  const problems = [];
  const known = (name) => typeof name === 'string' && tokens.includes(name);
  if (decl.edge !== undefined && !known(decl.edge)) problems.push(`edge "${decl.edge}" is not a palette token`);
  for (const kind of ['text', 'graphics', 'shapes']) {
    const pairs = decl[kind] ?? [];
    if (!Array.isArray(pairs)) problems.push(`"${kind}" is not a list of [fg, bg] pairs`);
    else for (const pair of pairs) if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(known)) problems.push(`"${kind}" pair ${JSON.stringify(pair)} does not name two palette tokens`);
  }
  if ((decl.shapes ?? []).length > 0 && decl.edge === undefined) problems.push('"shapes" needs the "edge" token the board draws their outline with');
  for (const list of decl.distinct ?? []) if (!Array.isArray(list) || list.length < 2 || !list.every(known)) problems.push(`"distinct" list ${JSON.stringify(list)} does not name two or more palette tokens`);
  const pairCount = ['text', 'graphics', 'shapes'].reduce((sum, kind) => sum + (Array.isArray(decl[kind]) ? decl[kind].length : 0), 0);
  if (pairCount === 0) problems.push('declares no text, graphics or shapes pair');
  return problems.length > 0 ? { problems } : { decl };
}

function checkBoardShape(source, palette, report) {
  const reference = Object.keys(palette.light ?? {}).sort().join(',');
  let isValid = true;
  for (const set of BOARD_SETS) {
    const tokens = palette[set];
    if (!tokens || typeof tokens !== 'object' || Object.keys(tokens).length === 0) {
      report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: `board set "${set}" is missing or empty`, fix: `Give the board palette the sets ${BOARD_SETS.join(', ')} with the same tokens.` });
      isValid = false;
      continue;
    }
    if (Object.keys(tokens).sort().join(',') !== reference) {
      report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: `board set "${set}" has other tokens than "light"`, fix: 'Give all four sets exactly the same token names.' });
      isValid = false;
    }
    const bad = Object.entries(tokens).filter(([, value]) => !HEX_ALPHA.test(value ?? '')).map(([name]) => name);
    if (bad.length > 0 || !HEX.test(tokens.background ?? '')) {
      report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: `${set}: ${bad.length > 0 ? `${bad.join(', ')} not #RRGGBB(AA)` : 'background is missing or translucent'}`, fix: 'Write every token as #RRGGBB or #RRGGBBAA, with an opaque background token.' });
      isValid = false;
    }
  }
  return isValid;
}

/** The board checks: declared text, graphic and edged-shape pairs per set, and colour-blind separation. */
function checkBoard(source, palette, report, flag) {
  if (!checkBoardShape(source, palette, report)) return;
  const declFile = join(dirname(source.file), BOARD_CONTRAST_FILE);
  const declLabel = toPosix(join(dirname(source.label), BOARD_CONTRAST_FILE));
  const { decl, problems } = readBoardDeclaration(declFile, Object.keys(palette.light));
  for (const message of problems ?? []) report.problem({ file: declLabel, line: 1, rule: 'board-pairs', message, fix: 'Write board-contrast.json from the template: the ink edge token, the text, graphics and edged shapes pairs draw() paints, and the piece colours that must stay apart.' });
  if (!decl) return;
  for (const set of BOARD_SETS) {
    const tokens = palette[set];
    const solid = (name, ground = tokens.background) => composite(tokens[name], ground);
    for (const [kind, min, rule] of BOARD_PAIR_KINDS) {
      for (const [fg, bg] of decl[kind] ?? []) {
        const ground = solid(bg);
        const ratio = contrastRatio(solid(fg, ground), ground);
        if (ratio < min) flag(source.label, rule, set, fg, bg, ratio, min);
      }
    }
    for (const [fill, bg] of decl.shapes ?? []) {
      const ground = solid(bg);
      const shape = solid(fill, ground);
      const best = Math.max(contrastRatio(solid(decl.edge, shape), shape), contrastRatio(shape, ground));
      if (best < 3) report.problem({ file: source.label, line: 1, rule: 'board-contrast', message: `${set}: ${fill} on ${bg} has no 3:1 edge or ground (${best.toFixed(2)}:1 against ${decl.edge} and ${bg})`, fix: `Darken or lighten ${fill} (or its ${decl.edge} edge) until the shape stands 3:1 off its edge or its ground.` });
    }
  }
  for (const set of COLOR_BLIND_SETS) {
    for (const list of decl.distinct ?? []) {
      const colors = list.map((name) => composite(palette[set][name], palette[set].background));
      for (const deficiency of DEFICIENCIES) {
        const { distance, pair } = minPairwiseDistance(colors, deficiency);
        if (distance < MIN_CVD_DISTANCE) report.problem({ file: source.label, line: 1, rule: 'cvd-separation', message: `${set} ${deficiency}: ${list.join(', ')} are only ${distance.toFixed(3)} apart (${pair.join(' and ')}, < ${MIN_CVD_DISTANCE})`, fix: 'Pick the colour-blind set from Okabe-Ito and keep a shape cue for every piece kind.' });
      }
    }
  }
}

function checkToybox(source, palette, shell, report, flag) {
  for (const mode of ['standard', 'colorBlind']) {
    for (const scheme of ['light', 'dark']) {
      const tokens = palette?.[mode]?.[scheme];
      const where = `${mode}.${scheme}`;
      if (!tokens) {
        report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: `${where} is missing`, fix: 'Fill standard and colorBlind, each with light and dark (colour-blind may reuse the standard objects).' });
        continue;
      }
      const bad = TOKENS.filter((name) => !HEX.test(tokens[name] ?? ''));
      if (bad.length > 0) {
        report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: `${where}: ${bad.join(', ')} missing or not #RRGGBB`, fix: 'Give every ColorTokens field an opaque #RRGGBB colour.' });
        continue;
      }
      for (const [fg, bg, min] of PALETTE_PAIRS) {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        if (ratio < min) flag(source.label, min >= 4.5 ? 'text-contrast' : 'non-text-contrast', where, fg, bg, ratio, min);
      }
      for (const [fill, base] of FILL_EDGES) {
        const best = Math.max(contrastRatio(tokens.border, tokens[fill]), contrastRatio(tokens[fill], tokens[base]));
        if (best < 3) {
          report.problem({ file: source.label, line: 1, rule: 'non-text-contrast', message: `${where}: ${fill} has no 3:1 edge or ground (${best.toFixed(2)}:1 against border and ${base})`, fix: `Give the ${fill} fill 3:1 against the outline (light paints) or against ${base} (dark paints), in the design tokens first.` });
        }
      }
      const colors = shell.colors?.[scheme];
      if (!colors) continue;
      for (const [fgKey, bgKey, min] of SHELL_PAIRS) {
        const fg = fgKey.startsWith('palette.') ? tokens[fgKey.slice(8)] : colors[fgKey];
        const bg = colors[bgKey];
        if (!HEX.test(fg ?? '') || !HEX.test(bg ?? '')) continue;
        const ratio = contrastRatio(fg, bg);
        if (ratio < min) flag(shell.label, 'shell-contrast', `${source.label} ${where}`, fgKey.replace('palette.', ''), bgKey, ratio, min);
      }
    }
  }
}

function readShellColors(shellFile, shellLabel, report) {
  if (!existsSync(shellFile)) return null;
  try {
    const colors = Object.values(loadTsConstants(readFileSync(shellFile, 'utf8'), 'shell-colors.ts')).find((v) => v && v.light && v.dark) ?? null;
    if (!colors) report.problem({ file: shellLabel, line: 1, rule: 'palette-shape', message: 'no SHELL_COLORS { light, dark } table found', fix: 'Export SHELL_COLORS: Readonly<Record<ColorScheme, ShellColors>> as literal data.' });
    return colors;
  } catch (error) {
    if (!(error instanceof ConstantsError)) throw error;
    report.problem({ file: shellLabel, line: 1, rule: 'palette-shape', message: error.message, fix: 'Keep shell-colors.ts a literal data module (type imports only).' });
    return null;
  }
}

function checkCategorical(list, report) {
  const colors = list.split(',').map((c) => c.trim()).filter(Boolean);
  const invalid = colors.filter((c) => !HEX.test(c));
  if (invalid.length > 0 || colors.length < 2) fail(`--categorical needs two or more #RRGGBB colours, got: ${list}`, 'Pass --categorical "#E69F00,#56B4E9,#009E73".');
  for (const deficiency of DEFICIENCIES) {
    const { distance, pair } = minPairwiseDistance(colors, deficiency);
    if (distance < MIN_CVD_DISTANCE) {
      report.problem({ file: '--categorical', line: 0, rule: 'cvd-separation', message: `${deficiency}: ${pair.join(' and ')} are ${distance.toFixed(3)} apart in OKLab (< ${MIN_CVD_DISTANCE})`, fix: 'Pick colours from a colour-blind-safe set (Okabe-Ito) and give every piece a shape or symbol as well.' });
    }
  }
}

function checkGates(gatesFile, label, report) {
  const gates = JSON.parse(readFileSync(gatesFile, 'utf8')).a11y;
  if (!gates) {
    report.problem({ file: label, line: 1, rule: 'a11y-gates', message: 'quality-gates.json has no "a11y" section', fix: 'Add "a11y": { "minTouchPt": 44, "maxFontScale": 2, "textContrastMin": 4.5, "nonTextContrastMin": 3, "minCvdDistanceOk": 0.07 }.' });
    return;
  }
  for (const [key, ok, want] of GATES) {
    if (typeof gates[key] !== 'number' || !ok(gates[key])) {
      report.problem({ file: label, line: 1, rule: 'a11y-gates', message: `a11y.${key} is ${JSON.stringify(gates[key])}, needs ${want}`, fix: 'Restore the budget; loosening it needs the owner\'s approval and a Gate-Change: trailer.' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = positionals[0] ?? '.';
  const root = resolve(requireDir(rootArg, 'app repo root'));
  const shown = (file) => toPosix(relative(process.cwd(), file)) || file;
  const report = createReporter({ name: 'check-contrast', json: options.json });
  const allowed = new Set(options.allow);
  const notes = [];

  const sources = options.palette.map((file) => {
    if (!existsSync(file)) fail(`palette file ${file} does not exist`, 'Pass the path of a palette.ts, palette .json or board-palettes.json file.');
    return { label: shown(resolve(file)), file: resolve(file) };
  });
  if (options.palette.length === 0) sources.push(...discover(root, shown));
  if (options.tokens) {
    if (!existsSync(options.tokens)) fail(`tokens file ${options.tokens} does not exist`, 'Pass a Toybox tokens.json.');
    const tokens = JSON.parse(readFileSync(options.tokens, 'utf8'));
    for (const [id, game] of Object.entries(tokens.color?.games ?? {})) sources.push({ label: `${shown(resolve(options.tokens))}#${id}`, kind: 'toybox', palette: game.colorTokens });
  }
  const shellFile = join(root, 'packages', 'shell', 'src', 'theme', 'shell-colors.ts');
  const gatesFile = join(root, 'quality-gates.json');
  if (sources.length === 0 && options.categorical.length === 0 && !existsSync(shellFile) && !existsSync(gatesFile)) {
    fail(`nothing to check: no apps/*/src/theme/palette.ts, apps/*/src/board/board-palettes.json, shell-colors.ts or quality-gates.json under ${rootArg}`, 'Run from the app repo root, or pass --palette, --tokens or --categorical.');
  }
  const shell = { label: shown(shellFile), colors: readShellColors(shellFile, shown(shellFile), report) };

  const flag = (file, rule, where, fg, bg, ratio, min) => {
    const id = `${where.split('.').pop()}:${fg}/${bg}`;
    const message = `${where}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 < ${min}:1`;
    if (allowed.has(id)) {
      notes.push(`note: ${message} (allowed by --allow ${id})`);
      return;
    }
    report.problem({ file, line: 1, rule, message, fix: min >= 4.5 ? `Darken or lighten one of the two colours until the pair reaches ${min}:1 (text), in the design tokens first.` : 'Raise the outline/icon contrast to 3:1 against its ground; the ink outline is what separates Toybox controls from the ground.' });
  };

  let checked = 0;
  for (const source of sources) {
    let loaded = source.palette ? { kind: source.kind, palette: source.palette } : null;
    if (!loaded) {
      try {
        loaded = loadPaletteFile(source.file);
      } catch (error) {
        if (!(error instanceof ConstantsError) && !(error instanceof SyntaxError)) throw error;
        report.problem({ file: source.label, line: 1, rule: 'palette-shape', message: error.message, fix: 'Write the palette as literal ColorTokens objects (type imports only) and export one Palette, or a board palette with its four sets.' });
        continue;
      }
    }
    checked += 1;
    if (loaded.kind === 'board') checkBoard(source, loaded.palette, report, flag);
    else checkToybox(source, loaded.palette, shell, report, flag);
  }
  for (const list of options.categorical) {
    checked += 1;
    checkCategorical(list, report);
  }
  if (existsSync(gatesFile)) {
    checked += 1;
    checkGates(gatesFile, shown(gatesFile), report);
  }
  if (shell.colors) checked += 1;
  for (const note of notes) console.log(note);
  return report.finish({ checked, unit: 'palettes, colour sets and gate files' });
});
