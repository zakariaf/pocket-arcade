#!/usr/bin/env node
// list-screen.mjs: prints one screen's build contract from the shipped map and copy deck (every
// testID with its component, role, copy key and English text, which parts a component draws
// itself, variants, the reference image), and fails when a key or a reference image is missing.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S4   (or --all to validate every screen)

import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import {
  DEFAULT_DECK,
  DEFAULT_MAP,
  DEFAULT_REFERENCES,
  SCREEN_PATHS,
  SHELL_EXTRA_KEYS,
  SKILL_DIR,
  describeDerivation,
  findScreen,
  loadContract,
} from './lib/screen-map.mjs';

const SPEC = {
  name: 'list-screen',
  summary:
    'Prints the build contract of one Toybox screen (testIDs, components, copy keys with English text, ' +
    'variants, where the code goes, the reference image) and checks that every key and image exists.',
  usage: '<screen> | --all [options]',
  options: {
    all: { type: 'boolean', help: 'Validate every screen and print one summary line each' },
    lang: { type: 'string', value: 'code', default: 'en', help: 'Language of the text column: en, de, fa, ckb (default en)' },
    map: { type: 'string', value: 'file', help: 'The screen testID map (default: the skill assets/screen-testids.json)' },
    deck: { type: 'string', value: 'file', help: 'The copy deck (default: the skill assets/copy-deck.json)' },
    refs: { type: 'string', value: 'dir', help: 'Reference images folder (default: the skill assets/reference)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  unknown-copy-key         an element\'s text or accessibility key is not in the copy deck (nor a Shell',
    '                           text the deck lacks, such as result.win.score-line)',
    '  reference-image-missing  a design frame of the screen has no <frame>.png reference image',
    '',
    'Examples:',
    '  node list-screen.mjs S4            Home: every testID, part and copy key',
    '  node list-screen.mjs settings      by scope',
    '  node list-screen.mjs S12 --lang fa',
    '  node list-screen.mjs --all         validate the whole map against the deck and the images',
  ].join('\n'),
};

/** Resolve games.<id>.x and meta.x keys against the deck's game and meta sections. */
function deckText(deck, key, lang) {
  if (key.startsWith('games.<id>.')) {
    let node = deck.games?.lineSiege;
    for (const part of key.slice('games.<id>.'.length).split('.')) node = node?.[/^\d+$/.test(part) ? Number(part) : part];
    return typeof node === 'string' ? node : node?.[lang] ?? null;
  }
  if (key.startsWith('meta.')) {
    let node = deck.meta;
    for (const part of key.slice('meta.'.length).split('.')) node = node?.[part];
    return typeof node === 'string' ? node : null;
  }
  // The Shell texts the deck lacks (result.win.score-line, the undo and hint labels) live in the
  // four Shell catalogs, written by hand from SHELL_EXTRA_KEYS.
  return deck.strings?.[key]?.[lang] ?? SHELL_EXTRA_KEYS[key]?.[lang] ?? null;
}

function checkScreen(ctx, screen, options, report) {
  for (const element of screen.elements) {
    for (const key of [element.text, element.a11yLabel]) {
      if (typeof key !== 'string' || deckText(ctx.deck, key, 'en') !== null) continue;
      report.problem({ file: toPosix(relative(process.cwd(), options.deckPath)) || 'copy-deck.json', rule: 'unknown-copy-key', message: `${screen.id} ${element.testID} uses "${key}", which the copy deck does not have`, fix: 'Sync the library copy deck (sync-shared.mjs); if the key is really missing, the deck and catalogs need it first.' });
    }
  }
  for (const frame of new Set(Object.values(screen.frameKeys ?? {}))) {
    const image = join(options.refs, `${frame}.png`);
    if (!existsSync(image)) report.problem({ file: toPosix(relative(process.cwd(), image)), rule: 'reference-image-missing', message: `${screen.id} frame ${frame} has no reference image`, fix: 'Render the frame at 1x from the Toybox mockup into assets/reference/ (see references/screen-frame-and-rules.md).' });
  }
}

function partNote(screen, element) {
  return describeDerivation(screen, element);
}

function printScreen(ctx, screen, options) {
  const frames = Object.entries(screen.frameKeys ?? {}).map(([variant, key]) => `${variant}: ${toPosix(relative(SKILL_DIR, join(options.refs, `${key}.png`)))}`);
  console.log(`${screen.id} ${screen.name}  route: ${screen.route ?? '(none)'}  presentation: ${screen.presentation}`);
  console.log(`code: ${SCREEN_PATHS[screen.id].join(', ')}`);
  console.log(`variants: ${screen.variants.join(', ')}  reference images: ${frames.join('; ')}`);
  if (screen.notes) console.log(`notes: ${screen.notes}`);
  console.log('');
  console.log('testID | role | component (kind) | copy key | text | variants/requires | set by | parity');
  for (const element of screen.elements) {
    // Reach policy: bounds only for what Maestro lists; crop-only parts are judged in their cover.
    const isCropOnly = element.parent !== undefined || element.a11yHidden === true;
    const parity = isCropOnly ? `crop-only in ${element.coveredBy ?? element.parent ?? '(hidden by parity)'}${element.a11yHidden ? ' (hidden from VoiceOver)' : ''}` : (element.checks ?? []).join('+');
    const text = element.text ? deckText(ctx.deck, element.text, options.lang) ?? '(missing)' : '';
    const a11y = element.a11yLabel ? ` [a11y ${element.a11yLabel}]` : '';
    const scope = [element.variants?.join(',') ?? '', element.requires ?? ''].filter(Boolean).join(' ');
    const setBy = partNote(screen, element) || 'this screen';
    console.log(`${element.testID} | ${element.role} | ${element.component}${element.kind ? ` (${element.kind})` : ''} | ${element.text ?? ''}${a11y} | ${JSON.stringify(text)} | ${scope} | ${setBy} | ${parity}${element.note ? ` | note: ${element.note}` : ''}`);
  }
  const extras = [...screen.extraIds];
  if (extras.length > 0) console.log(`\nChosen (not drawn) testIDs this screen may also set: ${extras.join(', ')}`);
  console.log('');
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.all && positionals.length === 0) fail('name a screen (S4, S11a, home) or pass --all', 'Run: node list-screen.mjs S4');
  const mapPath = resolve(options.map ?? DEFAULT_MAP);
  const deckPath = resolve(options.deck ?? DEFAULT_DECK);
  const refs = resolve(options.refs ?? DEFAULT_REFERENCES);
  const ctx = loadContract({ mapPath, deckPath });
  const report = createReporter({ name: 'list-screen', json: options.json });
  const settings = { deckPath, refs, lang: options.lang };
  const screens = options.all
    ? [...ctx.screens.values()]
    : [findScreen(ctx, positionals[0]) ?? fail(`unknown screen "${positionals[0]}"`, 'Use S1-S15, S11a-S11d or a scope such as home.')];
  for (const screen of screens) {
    if (options.all) console.log(`${screen.id} ${screen.name}: ${screen.byId.size} testIDs, ${Object.keys(screen.frameKeys ?? {}).length} frames`);
    else printScreen(ctx, screen, settings);
    checkScreen(ctx, screen, settings, report);
  }
  return report.finish({ checked: screens.length, unit: 'screens' });
});
