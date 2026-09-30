#!/usr/bin/env node
// write-palette.mjs: writes apps/<game>/src/theme/palette.ts (the game's Toybox ColorTokens, light and
// dark, colour-blind = standard) from the Toybox token file, or from a paint file for a new game.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/write-palette.mjs --game line-siege

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run } from './check-lib.mjs';
import { COLOR_FIELDS, colorTokensFromPaint, knownGames, loadTokens, tokenGameKey } from './lib/toybox-expectations.mjs';
import { TOY_INK, PENCIL, schemeProblems } from './lib/palette-rules.mjs';

const SPEC = {
  name: 'write-palette',
  summary: 'Writes a game\'s Toybox palette module (apps/<game>/src/theme/palette.ts). Known games take their paint from the Toybox token file; a new game passes --paint with its own paints, which must pass the Toybox contrast rules before anything is written.',
  usage: '--game <game-id> [--paint <paint.json>] [--out <file>] [--dry-run] [--force]',
  options: {
    game: { type: 'string', value: 'game-id', help: 'The app folder name, e.g. line-siege (required)' },
    paint: { type: 'string', value: 'file', help: 'Paint file for a game the token file does not know (see references/colour-tokens.md)' },
    out: { type: 'string', value: 'file', help: 'Output path (default: apps/<game>/src/theme/palette.ts)' },
    'dry-run': { type: 'boolean', help: 'Validate and print the module instead of writing it' },
    force: { type: 'boolean', help: 'Overwrite an existing palette file' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules checked before writing (the same as check-design-system.mjs):',
    '  palette-hex        every colour is an uppercase #RRGGBB',
    '  palette-contrast   text 4.5:1 on ground, surface and sunken; outline and focus 3:1',
    '  palette-fill       accent, pop and star fills stand 3:1 off their edge or their ground',
    '  palette-one-ink    light ink family is toy ink #1D1B3A and pencil #43406A',
    '',
    'Paint file (new games): { "names": { "light": {...}, "dark": {...} },',
    '  "light": { "ground", "surface", "sunken", "accent", "pop" },',
    '  "dark":  { "ground", "surface", "sunken", "ink", "inkSoft", "outline", "shadow", "accent", "pop" } }',
    '',
    'Examples:',
    '  node write-palette.mjs --game flock-tilt',
    '  node write-palette.mjs --game sheep-sort --paint sheep-sort-paint.json --dry-run',
  ].join('\n'),
};

function paintFromFile(file) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read paint file ${file}: ${error.message}`, 'Pass a JSON file shaped like the example in --help.');
  }
  const light = { ...data.light, ink: TOY_INK, inkSoft: PENCIL, outline: TOY_INK, shadow: TOY_INK, onAccent: TOY_INK, onPop: TOY_INK };
  const dark = { ...data.dark, onAccent: data.dark?.ground, onPop: data.dark?.ground };
  return { light, dark, names: data.names ?? null };
}

function describe(names) {
  if (!names) return { light: 'Light paint.', dark: 'Dark paint, "toy chest at night".' };
  const list = (n) => [n.ground, n.surface, n.ink, n.inkSoft, n.accent, n.pop].filter(Boolean).join(', ');
  return { light: `Light: ${list(names.light)}.`, dark: `Dark, "toy chest at night": ${list(names.dark)}.` };
}

function objectLines(name, colors) {
  return [`const ${name}: ColorTokens = {`, ...COLOR_FIELDS.map((field) => `  ${field}: '${colors[field]}',`), '};'];
}

export function paletteModule(out, colors, names) {
  const text = describe(names);
  return [
    `// ${out}`,
    '// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.',
    "import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';",
    '',
    `/** ${text.light} */`,
    ...objectLines('LIGHT', colors.light),
    `/** ${text.dark} */`,
    ...objectLines('DARK', colors.dark),
    '',
    '/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */',
    'export const PALETTE: Palette = {',
    '  standard: { light: LIGHT, dark: DARK },',
    '  colorBlind: { light: LIGHT, dark: DARK },',
    '};',
    '',
  ].join('\n');
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const game = options.game;
  if (!game) fail('--game is required', 'Pass the app folder name, e.g. --game line-siege.');
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(game)) fail(`--game "${game}" is not a kebab-case app id`, 'Use the app folder name, e.g. line-siege.');
  const tokens = loadTokens();
  let paint;
  if (options.paint) {
    paint = paintFromFile(resolve(options.paint));
  } else {
    const known = tokens.color.games[tokenGameKey(game)];
    if (!known) fail(`the Toybox token file has no paint for "${game}" (it knows ${knownGames(tokens).join(', ')})`, 'Design the paints (references/colour-tokens.md, "Painting a new game") and pass them with --paint <file>.');
    paint = { light: known.light, dark: known.dark, names: known.names };
  }
  const colors = {
    light: colorTokensFromPaint(paint.light, tokens.color.shell.light),
    dark: colorTokensFromPaint(paint.dark, tokens.color.shell.dark),
  };
  const out = options.out ?? `apps/${game}/src/theme/palette.ts`;
  const report = createReporter({ name: 'write-palette' });
  for (const scheme of ['light', 'dark']) {
    for (const problem of schemeProblems(scheme, colors[scheme], COLOR_FIELDS, tokens)) {
      report.problem({ file: options.paint ?? out, rule: problem.rule, message: problem.message, fix: 'Change that paint (keep the hue, move the lightness) and rerun.' });
    }
  }
  if (report.count === 0) {
    const text = paletteModule(out, colors, paint.names);
    if (options['dry-run']) {
      console.log(text);
    } else if (existsSync(out) && readFileSync(out, 'utf8') === text) {
      console.log(`unchanged ${out}`);
    } else if (existsSync(out) && !options.force) {
      report.problem({ file: out, rule: 'palette-exists', message: 'the palette file already exists with other paints', fix: 'Pass --force to overwrite it, or --dry-run to compare first.' });
    } else {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out, text);
      console.log(`wrote ${out}`);
    }
  }
  return report.finish({ checked: 2, unit: 'schemes' });
});
