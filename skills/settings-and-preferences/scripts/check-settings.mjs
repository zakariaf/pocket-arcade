#!/usr/bin/env node
// check-settings.mjs: checks the S11 settings end to end in the Shell source: the saved fields
// and their defaults, the reducer's actions, persist-before-publish, a Settings row that
// dispatches each preference, and code outside the settings screen that applies each setting.
// A partial Shell (shell-slice.json) skips the rules of the screens it leaves out.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-settings.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  SHELL_SLICE_FILE,
  createReporter,
  lineOf,
  maskComments,
  parseArgs,
  readShellSlice,
  requireDir,
  run,
  sliceSkipReason,
  toPosix,
  walk,
} from './check-lib.mjs';
import { extractBlock, topLevelEntries } from './lib/object-literal.mjs';

const SPEC = {
  name: 'check-settings',
  summary:
    'Checks the settings model in the Shell source: schema fields and defaults, reducer actions, persist-then-publish, ' +
    'a Settings row for each preference, an effect that applies each setting, resets that keep settings, and one writer.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON before the RESULT line' } },
  positionals: { min: 0, max: 1 },
  details: [
    'repo-root defaults to "." and holds packages/shell/src (the Shell source folder itself is accepted too).',
    '',
    'Partial Shell (shell-slice.json at the repo root): the rules of screens outside the slice print SKIP',
    'lines instead of problems: the S11 rows and their toggle feedback (S11), set-language (S2 or S11a), and',
    '"nothing writes" a reset (resetStatistics: S10 or S11; resetAllProgress: S11). "screens": [] (no Shell',
    'app) makes the whole check NOT APPLICABLE. Everything that exists is still checked.',
    '',
    'Rules:',
    '  settings-schema        the newest SETTINGS_V<n> has exactly the 11 fields with their validators',
    '  settings-default       DEFAULT_SETTINGS holds the agreed first-launch values (music off, System everywhere)',
    '  reducer-action         settings-reducer.ts handles every settings action; volumes are clamped',
    '  persist-then-publish   the store calls save.update before set, so the screen never shows an unsaved value',
    '  row-dispatch           screens/settings dispatches every preference action (set-language also from first-run)',
    '  setting-effect         code outside the settings screen, stores and save reads every field (the setting does something)',
    '  volume-scale           code that reads soundVolume or musicVolume divides by 100 (the save keeps percent)',
    '  reset-keeps-settings   resetAllProgress never replaces settings, firstRun or premium',
    '  reset-publish          both resets are written through updateAndPublish (one write, backup refreshed, every',
    '                         section store re-reads), never with a bare save.update',
    '  toggle-feedback        the Settings switches play the toggle feedback: playUiFeedback(services, \'toggle\')',
    '  single-writer          settings are persisted only by SaveService (no AsyncStorage, MMKV, SecureStore, localStorage)',
    '  reduce-motion-source   nothing imports Reanimated\'s useReducedMotion (it ignores the Shell setting)',
  ].join('\n'),
};

const PICK = (values) => new RegExp(`^v\\.picklist\\(\\s*\\[\\s*${values.map((value) => `'${value}'`).join('\\s*,\\s*')}\\s*,?\\s*\\]\\s*\\)$`);
const FIELDS = {
  language: { schema: /^v\.nullable\(\s*v\.picklist\(\s*\[\s*'en'\s*,\s*'de'\s*,\s*'fa'\s*,\s*'ckb'\s*,?\s*\]\s*\)\s*\)$/, text: "v.nullable(v.picklist(['en', 'de', 'fa', 'ckb']))", default: 'null', effect: /\bselectLanguage\b|\bsettings\.language\b/ },
  digits: { schema: PICK(['automatic', 'latin', 'local']), text: "v.picklist(['automatic', 'latin', 'local'])", default: "'automatic'", effect: /\bselectDigits\b|\bsettings\.digits\b/ },
  soundEnabled: { schema: /^v\.boolean\(\)$/, text: 'v.boolean()', default: 'true', effect: /\bsoundEnabled\b/ },
  soundVolume: { schema: /^PERCENT$/, text: 'PERCENT', default: '80', effect: /\bsoundVolume\b/ },
  musicEnabled: { schema: /^v\.boolean\(\)$/, text: 'v.boolean()', default: 'false', effect: /\bmusicEnabled\b/ },
  musicVolume: { schema: /^PERCENT$/, text: 'PERCENT', default: '60', effect: /\bmusicVolume\b/ },
  vibrationEnabled: { schema: /^v\.boolean\(\)$/, text: 'v.boolean()', default: 'true', effect: /\bselectIsVibrationOn\b|\bvibrationEnabled\b/ },
  theme: { schema: PICK(['system', 'light', 'dark']), text: "v.picklist(['system', 'light', 'dark'])", default: "'system'", effect: /\bselectThemePreference\b|\bsettings\.theme\b/ },
  colorBlind: { schema: /^v\.boolean\(\)$/, text: 'v.boolean()', default: 'false', effect: /\bselectIsColorBlind\b|\bcolorBlind\b/ },
  reduceMotion: { schema: PICK(['system', 'on', 'off']), text: "v.picklist(['system', 'on', 'off'])", default: "'system'", effect: /\bselectReduceMotionPreference\b|\bsettings\.reduceMotion\b/ },
  hintsDuringPlay: { schema: /^v\.boolean\(\)$/, text: 'v.boolean()', default: 'true', effect: /\bselectHintsDuringPlay\b|\bhintsDuringPlay\b/ },
};
const ACTIONS = ['set-language', 'set-digits', 'set-sound', 'set-music', 'set-vibration', 'set-theme', 'set-color-blind', 'set-reduce-motion', 'set-hints-during-play', 'finish-tutorial'];
const ROW_ACTIONS = ACTIONS.filter((action) => action !== 'finish-tutorial' && action !== 'set-language');
const SIDE_STORAGE = /from\s+['"](@react-native-async-storage\/async-storage|react-native-mmkv|expo-secure-store)['"]|\blocalStorage\b/g;
const RESETS = ['resetAllProgress', 'resetStatistics'];
const NOT_EFFECT = [/^stores\/settings-/, /^services\/save\//, /^screens\/settings\//, /^testing\//, /\.test\.tsx?$/, /\.d\.ts$/];

const read = (abs) => maskComments(readFileSync(abs, 'utf8'));
const squash = (text) => text.replace(/\s+/g, ' ').trim();

function newestSettingsSchema(src) {
  const dir = join(src, 'services', 'save', 'schema');
  if (!existsSync(dir)) return null;
  let best = null;
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.ts'))) {
    const source = read(join(dir, name));
    for (const match of source.matchAll(/export\s+const\s+SETTINGS_V(\d+)\s*=\s*v\.strictObject\(\s*\{/g)) {
      const version = Number(match[1]);
      if (best === null || version > best.version) {
        const block = extractBlock(source, match.index + match[0].length - 1);
        best = { version, file: name, source, index: match.index, inner: block?.inner ?? '' };
      }
    }
  }
  return best;
}

function checkSchema(ctx, src, label) {
  const schema = newestSettingsSchema(src);
  if (!schema) {
    ctx.problem({ file: `${label}/services/save/schema`, line: 1, rule: 'settings-schema', message: 'no `export const SETTINGS_V<n> = v.strictObject({ ... })`', fix: 'The save document needs its settings section (see references/settings-model.md, "The saved fields").' });
    return;
  }
  const file = `${label}/services/save/schema/${schema.file}`;
  const entries = new Map(topLevelEntries(schema.inner).map((entry) => [entry.key, entry]));
  for (const [key, field] of Object.entries(FIELDS)) {
    const entry = entries.get(key);
    const line = lineOf(schema.source, schema.index);
    if (!entry) ctx.problem({ file, line, rule: 'settings-schema', message: `SETTINGS_V${schema.version} has no ${key}`, fix: `Add ${key}: ${field.text} through a new schema version and migration.` });
    else if (!field.schema.test(squash(entry.value))) ctx.problem({ file, line, rule: 'settings-schema', message: `${key} is ${squash(entry.value)}, expected ${field.text}`, fix: 'Keep the field shape the settings model documents; change it only through a new schema version.' });
  }
  for (const key of entries.keys()) {
    if (!FIELDS[key]) ctx.problem({ file, line: lineOf(schema.source, schema.index), rule: 'settings-schema', message: `unknown setting ${key}`, fix: 'Add the setting to the settings model in this skill first (row, action, default, effect), then to the schema.' });
  }
  ctx.checked += 1;
}

function checkDefaults(ctx, src, label) {
  const abs = join(src, 'services', 'save', 'schema', 'default-save-doc.ts');
  const file = `${label}/services/save/schema/default-save-doc.ts`;
  if (!existsSync(abs)) {
    ctx.problem({ file, line: 1, rule: 'settings-default', message: 'default-save-doc.ts is missing', fix: 'Define DEFAULT_SETTINGS with the first-launch values.' });
    return;
  }
  const source = read(abs);
  const match = /DEFAULT_SETTINGS\s*(?::\s*[\w.[\]'"]+\s*)?=\s*\{/.exec(source);
  if (!match) {
    ctx.problem({ file, line: 1, rule: 'settings-default', message: 'no DEFAULT_SETTINGS object', fix: 'Export DEFAULT_SETTINGS: SaveSettings = { ... } and use it in createDefaultSaveDoc.' });
    return;
  }
  const inner = extractBlock(source, match.index + match[0].length - 1)?.inner ?? '';
  const entries = new Map(topLevelEntries(inner).map((entry) => [entry.key, squash(entry.value)]));
  for (const [key, field] of Object.entries(FIELDS)) {
    const value = entries.get(key);
    if (value !== field.default) {
      ctx.problem({ file, line: lineOf(source, match.index), rule: 'settings-default', message: `DEFAULT_SETTINGS.${key} is ${value ?? 'missing'}, expected ${field.default}`, fix: 'Use the first-launch value from references/settings-model.md (music stays off, language/theme/reduce motion follow the phone).' });
    }
  }
  ctx.checked += 1;
}

function checkStore(ctx, src, label) {
  const reducer = join(src, 'stores', 'settings-reducer.ts');
  if (!existsSync(reducer)) {
    ctx.problem({ file: `${label}/stores/settings-reducer.ts`, line: 1, rule: 'reducer-action', message: 'settings-reducer.ts is missing', fix: 'Copy templates/settings-reducer.ts.' });
  } else {
    const source = read(reducer);
    for (const action of ACTIONS) {
      if (!new RegExp(`case\\s+'${action}'`).test(source)) ctx.problem({ file: `${label}/stores/settings-reducer.ts`, line: 1, rule: 'reducer-action', message: `no case '${action}'`, fix: 'Handle every settings action in the pure reducer (templates/settings-reducer.ts).' });
    }
    if (!/clampVolume\s*\(/.test(source)) ctx.problem({ file: `${label}/stores/settings-reducer.ts`, line: 1, rule: 'reducer-action', message: 'volumes are stored without clampVolume', fix: 'Round and clamp every volume into 0..100 in the reducer.' });
    if (!/languageChosen\s*:\s*true/.test(source)) ctx.problem({ file: `${label}/stores/settings-reducer.ts`, line: 1, rule: 'reducer-action', message: "set-language does not set firstRun.languageChosen", fix: 'set-language saves the language and the first-run milestone together.' });
    ctx.checked += 1;
  }
  const store = join(src, 'stores', 'settings-store.ts');
  if (!existsSync(store)) {
    ctx.problem({ file: `${label}/stores/settings-store.ts`, line: 1, rule: 'persist-then-publish', message: 'settings-store.ts is missing', fix: 'Copy templates/settings-store.ts.' });
    return;
  }
  const source = read(store);
  const update = source.search(/save\.update\s*\(/);
  const publish = source.search(/\bset\s*\(\s*next/);
  if (update === -1 || publish === -1 || update > publish) {
    ctx.problem({ file: `${label}/stores/settings-store.ts`, line: update === -1 ? 1 : lineOf(source, update), rule: 'persist-then-publish', message: 'dispatch does not call save.update before set(next)', fix: 'Reduce, then save.update(...) (sync, one transaction), then set(next).' });
  }
  ctx.checked += 1;
}

function sourceFiles(src) {
  return walk(src, { include: ['*.ts', '*.tsx'] }).map((rel) => ({ rel, text: read(join(src, rel)) }));
}

/** The problem, or a SKIP line when every screen that needs the rule is outside shell-slice.json. */
function dueProblem(ctx, screens, problem) {
  const reasons = screens.map((id) => sliceSkipReason(ctx.slice, id));
  if (ctx.slice === null || reasons.some((reason) => reason === null)) ctx.problem(problem);
  else ctx.skip({ file: problem.file, rule: problem.rule, message: `${screens.join(' and ')} not in ${SHELL_SLICE_FILE}` });
}

function checkRowsAndEffects(ctx, files, label) {
  const settingsScreen = files.filter((file) => file.rel.startsWith('screens/settings/') && !/\.test\.tsx?$/.test(file.rel));
  if (settingsScreen.length === 0) {
    dueProblem(ctx, ['S11'], { file: `${label}/screens/settings`, line: 1, rule: 'row-dispatch', message: 'no Settings screen code', fix: 'Build S11 with templates/settings-rows.ts, settings-preference-actions.ts and use-settings-model.ts.' });
  }
  const screenText = settingsScreen.map((file) => file.text).join('\n');
  for (const action of ROW_ACTIONS) {
    if (!screenText.includes(`'${action}'`)) dueProblem(ctx, ['S11'], { file: `${label}/screens/settings`, line: 1, rule: 'row-dispatch', message: `no Settings row dispatches '${action}'`, fix: 'Wire the row to its action (templates/settings-preference-actions.ts).' });
  }
  const languageText = files.filter((file) => /^screens\/(settings|first-run)\//.test(file.rel)).map((file) => file.text).join('\n');
  if (!languageText.includes("'set-language'")) dueProblem(ctx, ['S2', 'S11a'], { file: `${label}/screens/settings/language`, line: 1, rule: 'row-dispatch', message: "nothing dispatches 'set-language'", fix: 'S2 and S11a dispatch set-language (templates/language-change.ts).' });

  const effects = files.filter((file) => !NOT_EFFECT.some((pattern) => pattern.test(file.rel)));
  for (const [key, field] of Object.entries(FIELDS)) {
    if (!effects.some((file) => field.effect.test(file.text))) {
      ctx.problem({ file: `${label}`, line: 1, rule: 'setting-effect', message: `nothing outside the settings screen reads ${key}: the setting has no effect`, fix: `Apply it where references/settings-model.md says (the "${key}" row of the effects table).` });
    }
  }
  for (const file of effects) {
    const volume = /\b(soundVolume|musicVolume)\b/.exec(file.text);
    if (volume && !/\/\s*100\b/.test(file.text)) {
      ctx.problem({ file: `${label}/${file.rel}`, line: lineOf(file.text, volume.index), rule: 'volume-scale', message: `${volume[1]} is used without dividing by 100`, fix: 'The save keeps integer percent; the audio port takes 0..1 (toAudioSettings).' });
    }
  }
  for (const file of files) {
    for (const match of file.text.matchAll(SIDE_STORAGE)) {
      ctx.problem({ file: `${label}/${file.rel}`, line: lineOf(file.text, match.index), rule: 'single-writer', message: `${match[1] ?? 'localStorage'} bypasses the save document`, fix: 'Persist settings only through the settings store (SaveService.update).' });
    }
    const match = /import\s*\{[^}]*\buseReducedMotion\b[^}]*\}\s*from\s*['"]react-native-reanimated['"]/.exec(file.text);
    if (match) ctx.problem({ file: `${label}/${file.rel}`, line: lineOf(file.text, match.index), rule: 'reduce-motion-source', message: "Reanimated's useReducedMotion is a load-time constant that ignores the Shell setting", fix: 'Use useReduceMotion() from app/use-reduce-motion.ts.' });
  }
}

function checkReset(ctx, src, label) {
  const abs = join(src, 'services', 'save', 'reset-progress.ts');
  const file = `${label}/services/save/reset-progress.ts`;
  if (!existsSync(abs)) {
    ctx.problem({ file, line: 1, rule: 'reset-keeps-settings', message: 'reset-progress.ts is missing', fix: 'Define resetAllProgress and resetStatistics over the save document.' });
    return;
  }
  const source = read(abs);
  const at = /function\s+resetAllProgress\b[^{]*\{/.exec(source);
  if (!at) {
    ctx.problem({ file, line: 1, rule: 'reset-keeps-settings', message: 'no resetAllProgress function', fix: 'Export resetAllProgress(doc) that keeps settings, firstRun and premium.' });
    return;
  }
  const body = extractBlock(source, at.index + at[0].length - 1)?.inner ?? '';
  const replaced = /\b(settings|firstRun|premium)\s*:/.exec(body);
  if (replaced) {
    ctx.problem({ file, line: lineOf(source, at.index + at[0].length + replaced.index), rule: 'reset-keeps-settings', message: `resetAllProgress replaces ${replaced[1]}`, fix: 'Reset all progress deletes levels, stars, daily results and statistics; it keeps Premium, language and settings.' });
  }
  ctx.checked += 1;
}

/** "Reset statistics" and "Reset all progress" are one updateAndPublish write each, so no store keeps old numbers. */
function checkResetWrites(ctx, files, label) {
  const wired = new Set();
  for (const file of files) {
    if (/\.test\.tsx?$/.test(file.rel) || file.rel === 'services/save/reset-progress.ts') continue;
    for (const name of RESETS) {
      if (!new RegExp(`\\b${name}\\b`).test(file.text)) continue;
      const bare = new RegExp(`\\.update\\s*\\(\\s*(?:\\(?\\s*\\w*\\s*\\)?\\s*=>\\s*)?${name}\\b`).exec(file.text);
      if (bare) {
        ctx.problem({ file: `${label}/${file.rel}`, line: lineOf(file.text, bare.index), rule: 'reset-publish', message: `${name} is written with a bare save.update, so the progress and stats stores keep their old sections`, fix: `Call updateAndPublish(save, stores, { recipe: ${name}, refreshBackup: true }) (templates/settings-resets.ts).` });
      } else if (/\bupdateAndPublish\s*\(/.test(file.text)) wired.add(name);
    }
  }
  const screensOf = { resetAllProgress: ['S11'], resetStatistics: ['S10', 'S11'] };
  for (const name of RESETS) {
    if (!wired.has(name)) dueProblem(ctx, screensOf[name], { file: `${label}/screens/settings`, line: 1, rule: 'reset-publish', message: `nothing writes ${name} through updateAndPublish`, fix: 'Copy templates/settings-resets.ts and use-settings-resets.ts; the S14 reset dialogs call their handlers.' });
  }
}

/** Every Settings switch sounds and pulses once (ui.toggle + the selection haptic). */
function checkToggleFeedback(ctx, files, label) {
  const screen = files.filter((file) => file.rel.startsWith('screens/settings/') && !/\.test\.tsx?$/.test(file.rel));
  const call = screen.find((file) => /\bplayUiFeedback\s*\([^;]*?['"]toggle['"]/.test(file.text));
  if (call === undefined) dueProblem(ctx, ['S11'], { file: `${label}/screens/settings`, line: 1, rule: 'toggle-feedback', message: "the Settings switches play no toggle feedback (playUiFeedback(services, 'toggle'))", fix: "Pass onToggled: () => { playUiFeedback(services, 'toggle'); } to createPreferenceActions in use-settings-model.ts (templates)." });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const given = requireDir(positionals[0] ?? '.', 'repo root');
  // The repo root holds packages/shell/src; an older call passed the Shell source folder itself.
  const isRepoRoot = existsSync(join(given, 'packages', 'shell', 'src'));
  const src = isRepoRoot ? join(given, 'packages', 'shell', 'src') : given;
  const slice = isRepoRoot ? readShellSlice(given) : null;
  const label = toPosix(relative(process.cwd(), src)) || '.';
  const report = createReporter({ name: 'check-settings', json: options.json });
  if (slice !== null && !slice.hasShellApp) return report.notApplicable(sliceSkipReason(slice));
  const skipped = new Set();
  const ctx = {
    problem: (problem) => report.problem(problem),
    // One SKIP line per file, rule and reason (the S11 rows share one).
    skip: (skip) => {
      const key = `${skip.file}|${skip.rule}|${skip.message}`;
      if (skipped.has(key)) return;
      skipped.add(key);
      report.skip(skip);
    },
    slice,
    checked: 0,
  };
  const files = sourceFiles(src);
  if (files.length === 0) return report.finish({ checked: 0, unit: 'files' });
  checkSchema(ctx, src, label);
  checkDefaults(ctx, src, label);
  checkStore(ctx, src, label);
  checkRowsAndEffects(ctx, files, label);
  checkReset(ctx, src, label);
  checkResetWrites(ctx, files, label);
  checkToggleFeedback(ctx, files, label);
  return report.finish({ checked: files.length, unit: 'files' });
});
