#!/usr/bin/env node
// check-sound-banks.mjs: renders every synthesized sound of a Pocket Arcade repo (the Shell's UI_SOUNDS and
// each game's SOUND_BANK) with a byte-exact port of the app's synth, checks each recipe against the quality
// gate, and cross-checks the game's timeline cues against its bank. Optionally writes WAV files to listen to.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-sound-banks.mjs [repo-root] [--wav-dir dir]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, requireDir, run, toPosix, walk } from './check-lib.mjs';
import { LIMITS, RATE, encodeWav, recipeProblems, selfCheck, synthesizeRecipe } from './lib/synth.mjs';
import { LiteralError, findConstInitializer, parseObjectEntries } from './lib/ts-literal.mjs';

const SPEC = {
  name: 'check-sound-banks',
  summary: 'Checks every synthesized sound (UI_SOUNDS in the Shell, SOUND_BANK in each game) and every timeline cue that names a sound.',
  usage: '[options] [repo-root]',
  options: {
    game: { type: 'string', multiple: true, value: 'id', help: 'Check only this game (apps/<id>); the Shell UI sounds are always checked' },
    'wav-dir': { type: 'string', value: 'dir', help: 'Also write every clean sound as a 48 kHz WAV to <dir>/<game-or-shell>/<id>.wav' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  recipe-literal  a recipe is literal data (numbers and strings inline, no constants, spreads or calls)',
    `  recipe-quality  renders finite samples, peak ${LIMITS.minPeak}-${LIMITS.maxPeak}, first sample < ${LIMITS.maxFirstSample}, last < ${LIMITS.maxLastSample},`,
    `                  ${LIMITS.minDurationMs} ms to ${LIMITS.maxEffectMs} ms (music up to ${LIMITS.maxMusicMs} ms), sane voice fields`,
    '  sound-id        UI sound ids are ui.<kebab>; game sound ids are kebab-case and never start with ui.',
    '  bank-category   game sounds are category sfx (no isLoop) or at most one music entry with isLoop: true',
    '  bank-missing    a game whose code cues a sound has apps/<id>/src/sounds/sound-bank.ts exporting SOUND_BANK',
    '  cue-unknown     every cued sound id (sound: \'id\', audio.play(\'id\'), startMusic(\'id\')) is in the game\'s bank',
    '  sound-unused    every sfx sound in the bank is cued somewhere in the game',
    '  bank-test       apps/<id>/src/sounds/sound-bank.test.ts runs recipeProblems over the bank',
    '  bank-unwired    apps/<id>/src/index.ts passes SOUND_BANK to the Shell (presentation.sounds)',
    '',
    'Example: node check-sound-banks.mjs . --wav-dir /tmp/sfx   (then open the WAVs in Finder)',
  ].join('\n'),
};

const UI_SOUNDS_FILE = 'packages/shell/src/services/audio/synth/ui-sounds.ts';
const UI_ID = /^ui\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const GAME_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// A sound cue: cue: { sound: 'id' }, audio.play('id') (not haptics.play('light')), startMusic('id').
const CUE_PATTERNS = [/\bsound\s*:\s*['"]([^'"]+)['"]/g, /(?<!\bhaptics\s*\??)\.play\(\s*['"]([^'"]+)['"]/g, /\bstartMusic\(\s*['"]([^'"]+)['"]/g];
const SPEC_FIELDS = new Set(['category', 'recipe', 'minIntervalMs', 'isLoop']);

function readRel(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Parses `const <name> = { ... }` into entries; reports a file-level problem when it cannot. */
function readEntries(root, rel, name, report) {
  const source = readRel(root, rel);
  if (source === null) return null;
  const start = findConstInitializer(source, name);
  if (start === -1) {
    report.problem({ file: rel, line: 1, rule: 'recipe-literal', message: `no \`const ${name} = { ... }\` found`, fix: `Export the bank as \`export const ${name}: SoundBank = { ... }\` with literal recipes.` });
    return { source, entries: [] };
  }
  try {
    return { source, entries: parseObjectEntries(source, start) };
  } catch (error) {
    if (!(error instanceof LiteralError)) throw error;
    report.problem({ file: rel, line: lineOf(source, error.index), rule: 'recipe-literal', message: `${name} is not a plain object literal: ${error.message}`, fix: 'Write the bank as one object literal of literal recipes.' });
    return { source, entries: [] };
  }
}

function literalProblem(report, rel, source, entry) {
  report.problem({ file: rel, line: lineOf(source, entry.errorIndex), rule: 'recipe-literal', message: `sound "${entry.key}": ${entry.error}`, fix: 'Write recipes as literal data (numbers and strings inline) so the quality gate and the WAV preview can read them.' });
}

function checkRecipe(report, where, id, recipe, maxMs) {
  const problems = recipeProblems(recipe, maxMs);
  for (const problem of problems) {
    report.problem({ ...where, rule: 'recipe-quality', message: `sound "${id}" ${problem}`, fix: 'Tune the recipe (attackMs 1-8 ms, gain 0.15-0.5, the lengths in the sound design guide), then listen to the WAV preview.' });
  }
  return problems.length === 0;
}

function writeWav(wavDir, group, id, recipe) {
  const dir = join(wavDir, group);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.wav`), encodeWav(synthesizeRecipe(recipe, RATE), RATE));
}

function checkUiSounds(root, report, options, stats) {
  const parsed = readEntries(root, UI_SOUNDS_FILE, 'UI_SOUNDS', report);
  if (parsed === null) return;
  for (const entry of parsed.entries) {
    stats.checked += 1;
    const where = { file: UI_SOUNDS_FILE, line: lineOf(parsed.source, entry.index) };
    if (!UI_ID.test(entry.key)) report.problem({ ...where, rule: 'sound-id', message: `UI sound id "${entry.key}" is not ui.<kebab>`, fix: 'Name Shell sounds ui.tap, ui.toggle, ui.win ... so games can never collide with them.' });
    if (entry.error) {
      literalProblem(report, UI_SOUNDS_FILE, parsed.source, entry);
      continue;
    }
    if (checkRecipe(report, where, entry.key, entry.value, LIMITS.maxEffectMs) && options['wav-dir']) {
      writeWav(options['wav-dir'], 'shell', entry.key, entry.value);
      stats.wavs += 1;
    }
  }
}

function findCues(root, game) {
  const srcRel = `apps/${game}/src`;
  const cues = [];
  for (const rel of walk(join(root, srcRel), { include: ['*.ts', '*.tsx'], ignore: ['*.test.ts', '*.test.tsx', 'sounds'] })) {
    const file = `${srcRel}/${rel}`;
    const source = maskComments(readFileSync(join(root, file), 'utf8'));
    for (const pattern of CUE_PATTERNS) {
      for (const match of source.matchAll(pattern)) cues.push({ id: match[1], file, line: lineOf(source, match.index) });
    }
  }
  return cues;
}

function checkSpec(report, where, entry) {
  const spec = entry.value;
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    report.problem({ ...where, rule: 'bank-category', message: `sound "${entry.key}" is not a { category, recipe } object`, fix: "Write { category: 'sfx', recipe: [ ... ] }." });
    return null;
  }
  const unknown = Object.keys(spec).filter((key) => !SPEC_FIELDS.has(key));
  if (unknown.length > 0) report.problem({ ...where, rule: 'bank-category', message: `sound "${entry.key}" has unknown field(s) ${unknown.join(', ')}`, fix: 'A SoundSpec has only category, recipe, minIntervalMs and isLoop.' });
  if (spec.category !== 'sfx' && spec.category !== 'music') {
    report.problem({ ...where, rule: 'bank-category', message: `sound "${entry.key}" has category ${JSON.stringify(spec.category)}`, fix: "Game sounds are 'sfx' (or one looped 'music'); 'ui' belongs to the Shell's UI_SOUNDS." });
  } else if (spec.category === 'music' && spec.isLoop !== true) {
    report.problem({ ...where, rule: 'bank-category', message: `music "${entry.key}" is not looped`, fix: 'Set isLoop: true on the music entry.' });
  } else if (spec.category === 'sfx' && spec.isLoop === true) {
    report.problem({ ...where, rule: 'bank-category', message: `effect "${entry.key}" sets isLoop`, fix: 'Only music loops; an effect plays once.' });
  }
  if (spec.minIntervalMs !== undefined && !(typeof spec.minIntervalMs === 'number' && spec.minIntervalMs >= 0)) {
    report.problem({ ...where, rule: 'bank-category', message: `sound "${entry.key}" minIntervalMs must be a number of 0 or more`, fix: 'Use e.g. minIntervalMs: 60 for rapid hits.' });
  }
  return spec;
}

function checkGame(root, game, report, options, stats) {
  const bankRel = `apps/${game}/src/sounds/sound-bank.ts`;
  const cues = findCues(root, game);
  stats.checked += cues.length;
  const parsed = readEntries(root, bankRel, 'SOUND_BANK', report);
  if (parsed === null) {
    const first = cues[0];
    if (first) report.problem({ file: first.file, line: first.line, rule: 'bank-missing', message: `${game} cues sound "${first.id}" but has no ${bankRel}`, fix: 'Copy templates/apps/__GAME_ID__/src/sounds/ (bank and test) and add one recipe per cued sound.' });
    return;
  }
  const bankIds = new Map();
  let musicCount = 0;
  for (const entry of parsed.entries) {
    stats.checked += 1;
    const where = { file: bankRel, line: lineOf(parsed.source, entry.index) };
    bankIds.set(entry.key, where);
    if (!GAME_ID.test(entry.key)) report.problem({ ...where, rule: 'sound-id', message: `game sound id "${entry.key}" is not a kebab-case noun${entry.key.startsWith('ui.') ? ' (ui. is the Shell namespace)' : ''}`, fix: "Name game sounds after what happened: 'place', 'clear', 'hit', 'win'." });
    if (entry.error) {
      literalProblem(report, bankRel, parsed.source, entry);
      continue;
    }
    const spec = checkSpec(report, where, entry);
    if (spec === null) continue;
    if (spec.category === 'music') {
      musicCount += 1;
      bankIds.set(entry.key, { ...where, isMusic: true });
    }
    const limit = spec.category === 'music' ? LIMITS.maxMusicMs : LIMITS.maxEffectMs;
    if (checkRecipe(report, where, entry.key, spec.recipe, limit) && options['wav-dir']) {
      writeWav(options['wav-dir'], game, entry.key, spec.recipe);
      stats.wavs += 1;
    }
  }
  if (musicCount > 1) report.problem({ file: bankRel, line: 1, rule: 'bank-category', message: `${musicCount} music entries`, fix: 'A game has at most one looped music entry (most have none).' });
  const cued = new Set(cues.map((cue) => cue.id));
  for (const cue of cues) {
    if (!bankIds.has(cue.id)) report.problem({ file: cue.file, line: cue.line, rule: 'cue-unknown', message: `cue names sound "${cue.id}", which is not in SOUND_BANK`, fix: `Add "${cue.id}" to ${bankRel}, or fix the id (games cue their own sounds; the Shell plays ui.* itself).` });
  }
  for (const [id, where] of bankIds) {
    if (!cued.has(id) && !where.isMusic) report.problem({ file: where.file, line: where.line, rule: 'sound-unused', message: `sound "${id}" is never cued`, fix: `Cue it from buildTimeline (cue: { sound: '${id}' }) or delete it.` });
  }
  const testSource = readRel(root, `apps/${game}/src/sounds/sound-bank.test.ts`);
  if (testSource === null || !/\brecipeProblems\b/.test(testSource)) report.problem({ file: `apps/${game}/src/sounds/sound-bank.test.ts`, line: 1, rule: 'bank-test', message: 'no sound-bank test that runs recipeProblems over SOUND_BANK', fix: 'Copy templates/apps/__GAME_ID__/src/sounds/sound-bank.test.ts next to the bank.' });
  const index = readRel(root, `apps/${game}/src/index.ts`);
  if (index !== null && !/\bSOUND_BANK\b/.test(index)) report.problem({ file: `apps/${game}/src/index.ts`, line: 1, rule: 'bank-unwired', message: 'the game module does not pass SOUND_BANK to the Shell', fix: 'Set presentation.sounds: SOUND_BANK in the ShellGameModule.' });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  selfCheck();
  const report = createReporter({ name: 'check-sound-banks', json: options.json });
  const stats = { checked: 0, wavs: 0 };
  if (options['wav-dir']) options['wav-dir'] = resolve(options['wav-dir']);
  checkUiSounds(root, report, options, stats);
  const appsDir = join(root, 'apps');
  const games = existsSync(appsDir) ? readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(appsDir, entry.name, 'src'))).map((entry) => entry.name).sort() : [];
  const unknown = options.game.filter((game) => !games.includes(game));
  if (unknown.length > 0) fail(`nothing to check: no apps/${unknown[0]}/src in ${root}`, `Pass an existing game id (${games.join(', ') || 'none found'}).`);
  for (const game of games) {
    if (options.game.length > 0 && !options.game.includes(game)) continue;
    checkGame(root, game, report, options, stats);
  }
  if (options['wav-dir']) report.note(`wrote ${stats.wavs} WAV files to ${toPosix(relative(process.cwd(), options['wav-dir'])) || '.'}`);
  return report.finish({ checked: stats.checked, unit: 'sounds and cues' });
});
