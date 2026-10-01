#!/usr/bin/env node
// check-code-names.mjs: checks names inside the code of the Pocket Arcade app repo: testIDs, kind and
// type values, i18n keys and placeholders, env variables, test titles, type names, booleans,
// handlers, module constants and acronyms, plus Maestro flow selectors.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-code-names.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, matchGlob, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { ENV_VAR, I18N_KEY, RULES, TEST_ID, TEST_TITLE, hasAcronymRun, hasBooleanPrefix, isPascal, isUpperSnake } from './lib/names.mjs';
import { scanSource } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-code-names',
  summary:
    'Checks names inside source, catalogs and E2E flows: testIDs, kind/type values, i18n keys and placeholders, ' +
    'env variables, test titles, type names, boolean names, handler names, module constants, acronyms, and that ' +
    'Maestro flows select by id.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  testid-format       a testID is not <screen>.<element> in kebab-case (home.play-button, levels.level-tile.12)',
    '  testid-index        a repeated item\'s testID uses a list index instead of a stable data key',
    '  kind-value          a kind/type literal is not kebab-case (\'column-cleared\', \'set-theme\')',
    '  i18n-key            a catalog key or t()/asGameKey() key breaks the key grammar or its namespace',
    '  i18n-key-built      a key is built from a template literal instead of written as a literal',
    '  i18n-placeholder    a catalog placeholder is not camelCase, or a plain {x} whose name does not end in Name/Text',
    '  env-var             an env variable is not UPPER_SNAKE_CASE, or app code reads a non-EXPO_PUBLIC_ variable',
    '                      or reads one with bracket access',
    '  test-title          an it() title does not start with a third-person verb or "can"; test() instead of it()',
    '  type-name           a type is not PascalCase, has an I prefix, or (outside tests) is called plain Props or State',
    '  boolean-name        a boolean variable or parameter lacks is/has/can/should/did/will/was',
    '  handler-name        in a .tsx component, an on* prop gets a local function not named handleX/onX, or a',
    '                      local handler is named onX (onX is for callback props)',
    '  constant-name       module-level fixed data (a literal, a regex, an as-const table) is not UPPER_CASE',
    '  acronym-case        an identifier spells an acronym in capitals (SQLDriver, isRTL); write SqlDriver, isRtl',
    '  maestro-selector    a Maestro step selects by text instead of id (OS-owned UI only under a "# system-ui: <why>"',
    '                      comment or on a "# system dialog" line), or an id is not a valid testID',
    '',
    'Scans apps/, packages/ (tooling only for boolean, type and acronym names), test/ and root .ts files; catalogs in',
    'packages/shell/src/i18n/catalogs/ and apps/<id>/src/i18n/; flows in any e2e/flows/ folder.',
    'Example: node check-code-names.mjs .            (from the app repo root)',
  ].join('\n'),
};

// Generated or local-only folders. Root folders and app build output are anchored, so area folders
// such as packages/tooling/src/build/ are still checked.
const IGNORE = ['node_modules', '.git', '.expo', 'ios', 'android', 'apps/*/build/', 'apps/*/dist/', 'apps/*/sfx-preview/', 'coverage/', 'reports/', 'dist-audit/', 'tools/', '.stryker-tmp/', 'skills/', '.claude/', 'expo-env.d.ts'];
// Node code and tooling talk to external formats (App Store Connect uses camelCase `type` values).
const NODE_CODE = ['apps/*/app.config.ts', 'packages/shell/src/config/**', 'packages/shell/plugins/**', 'packages/tooling/**'];
const APP_RUNTIME = ['apps/*/index.ts', 'apps/*/game.config.ts', 'apps/*/src/**', 'packages/game-kit/src/**', 'packages/shell/src/**'];
const any = (rel, globs) => globs.some((glob) => matchGlob(rel, glob));

function gameIds(root) {
  const dir = join(root, 'apps');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
}

/** Static text of a template literal with each ${...} as `${}`, plus the raw expressions. */
function templateParts(text, entry) {
  const raw = text.slice(entry.index + 1, entry.end - 1);
  const expressions = [...raw.matchAll(/\$\{([^}]*)\}/g)].map((match) => match[1].trim());
  return { statics: entry.parts, expressions };
}

function checkTestIds(rel, scan, text, report) {
  const { code, stringAt, lineOf } = scan;
  for (const match of code.matchAll(/\btestID\s*(?:=\s*\{?\s*|:\s*)(?=['"`])/g)) {
    const entry = stringAt.get(match.index + match[0].length);
    if (!entry) continue;
    const at = { file: rel, line: lineOf(entry.index) };
    if (entry.quote !== '`') {
      if (!TEST_ID.test(entry.value)) report.problem({ ...at, rule: 'testid-format', message: `testID "${entry.value}"`, fix: "Use '<screen>.<element>' with kebab-case segments, e.g. 'home.play-button'." });
      continue;
    }
    const { statics, expressions } = templateParts(text, entry);
    const joined = statics.join('x');
    const dynamicOnlyAtStart = statics[0] === '' && expressions.length > 0;
    if (!dynamicOnlyAtStart && !TEST_ID.test(joined.replace(/\.$/, '.x'))) {
      report.problem({ ...at, rule: 'testid-format', message: `testID template "${entry.value}"`, fix: 'Keep the static parts kebab-case with dots between segments: `levels.level-tile.${String(level)}`.' });
    }
    if (expressions.some((expression) => /^(String\()?\s*(i|idx|index)\s*\)?$/.test(expression))) {
      report.problem({ ...at, rule: 'testid-index', message: `testID "${entry.value}" uses a list index`, fix: 'Append a stable data key (the level number, the language code), never the position in the list.' });
    }
  }
}

function checkKinds(rel, scan, report) {
  const { code, stringAt, lineOf } = scan;
  for (const match of code.matchAll(/(?<![\w$.])(kind|type)\s*\??\s*:\s*(?=['"])/g)) {
    let index = match.index + match[0].length;
    for (;;) {
      const entry = stringAt.get(index);
      if (!entry) break;
      if (/[^a-z0-9-]/.test(entry.value)) {
        report.problem({ file: rel, line: lineOf(entry.index), rule: 'kind-value', message: `${match[1]} value '${entry.value}' is not kebab-case`, fix: "Use lowercase words joined by hyphens: moves imperative ('place-block'), events past tense ('column-cleared'), actions imperative ('set-theme')." });
      }
      const next = /^\s*\|\s*(?=['"])/.exec(code.slice(entry.end, entry.end + 40));
      if (!next) break;
      index = entry.end + next[0].length;
    }
  }
}

function checkKeyCalls(rel, scan, games, report) {
  const { code, stringAt, lineOf } = scan;
  const ownGame = /^apps\/([^/]+)\//.exec(rel)?.[1];
  for (const match of code.matchAll(/(?<![\w$.])(t|asGameKey)\s*\(\s*(?=['"`])|<T\s+id=\{?\s*(?=['"`])/g)) {
    const entry = stringAt.get(match.index + match[0].length);
    if (!entry) continue;
    const at = { file: rel, line: lineOf(entry.index) };
    if (entry.quote === '`') {
      report.problem({ ...at, rule: 'i18n-key-built', message: `key built from a template: ${entry.value}`, fix: 'Write the key as a literal, or pick it from a typed table of literals (THEME_LABEL_KEYS[theme]); tools can only check keys they can see.' });
      continue;
    }
    if (!I18N_KEY.test(entry.value)) {
      report.problem({ ...at, rule: 'i18n-key', message: `key '${entry.value}' breaks the grammar`, fix: 'Use 2-5 dot-separated kebab-case segments: <area>.<element>[.<variant>], e.g. home.play-button.continue.' });
      continue;
    }
    const first = entry.value.split('.')[0];
    if (match[1] === 'asGameKey' && ownGame && first !== ownGame) {
      report.problem({ ...at, rule: 'i18n-key', message: `game key '${entry.value}' does not start with '${ownGame}.'`, fix: `Game keys start with the game id: ${ownGame}.<area>.<element>.` });
    }
    if (rel.startsWith('packages/shell/') && games.includes(first)) {
      report.problem({ ...at, rule: 'i18n-key', message: `the Shell uses the game key '${entry.value}'`, fix: 'The Shell never names a game key; the game passes its keys through the GameModule contract.' });
    }
  }
}

function checkEnv(rel, scan, report) {
  const { code, stringAt, lineOf } = scan;
  const runtime = any(rel, APP_RUNTIME) && !any(rel, NODE_CODE);
  for (const match of code.matchAll(/\bprocess\.env\.([A-Za-z_$][\w$]*)|\bprocess\.env\[\s*(?=['"])/g)) {
    const at = { file: rel, line: lineOf(match.index) };
    const bracket = match[1] === undefined;
    const name = bracket ? stringAt.get(match.index + match[0].length)?.value : match[1];
    if (name === undefined) continue;
    if (!ENV_VAR.test(name)) {
      report.problem({ ...at, rule: 'env-var', message: `env variable ${name} is not UPPER_SNAKE_CASE`, fix: 'Name env variables in UPPER_SNAKE_CASE (APP_VARIANT, ADS_MODE).' });
    } else if (runtime && !name.startsWith('EXPO_PUBLIC_')) {
      report.problem({ ...at, rule: 'env-var', message: `app code reads ${name}, which Expo does not inline`, fix: 'Only EXPO_PUBLIC_* variables reach the app; declare it in packages/shell/src/app-env.d.ts.' });
    } else if (runtime && bracket) {
      report.problem({ ...at, rule: 'env-var', message: `app code reads ${name} with bracket access`, fix: `Expo inlines only dot access: process.env.${name} (declared in app-env.d.ts).` });
    }
  }
}

function checkTests(rel, scan, report) {
  const { code, stringAt, lineOf } = scan;
  for (const match of code.matchAll(/(?<![\w$.])(it|test)(?:\.(?:each\([^)]*\)|only|skip))?\s*\(\s*(?=['"`])/g)) {
    const entry = stringAt.get(match.index + match[0].length);
    if (!entry) continue;
    const at = { file: rel, line: lineOf(match.index) };
    if (match[1] === 'test') report.problem({ ...at, rule: 'test-title', message: 'test() instead of it()', fix: "Write it('returns ...') inside describe('<exported name>')." });
    if (!TEST_TITLE.test(entry.value)) report.problem({ ...at, rule: 'test-title', message: `title "${entry.value}" does not start with a third-person verb or "can"`, fix: "Start with a verb: it('returns ...'), it('emits ...'), it('rejects ...')." });
  }
}

function checkDeclarations(rel, scan, report) {
  const { code, stringAt, lineOf } = scan;
  const at = (index) => ({ file: rel, line: lineOf(index) });
  for (const match of code.matchAll(/(?<![\w$.])type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=;]*>)?\s*=(?!=)/g)) {
    const name = match[1];
    if (!isPascal(name)) report.problem({ ...at(match.index), rule: 'type-name', message: `type ${name} is not PascalCase`, fix: 'Name types in PascalCase: LevelPack, SettingsState.' });
    else if (/^I[A-Z][a-z]/.test(name)) report.problem({ ...at(match.index), rule: 'type-name', message: `type ${name} has an I prefix`, fix: `Drop the prefix: ${name.slice(1)}.` });
    else if ((name === 'Props' || name === 'State') && !/\.test\.tsx?$/.test(rel)) report.problem({ ...at(match.index), rule: 'type-name', message: `type named plain ${name}`, fix: `Name it after its owner: <Component>${name} (LevelTile${name}), <Domain>${name} (Settings${name}).` });
  }
  for (const match of code.matchAll(/(?<![\w$.])(?:const|let|var|function|class|type)\s+([A-Za-z_$][\w$]*)/g)) {
    if (hasAcronymRun(match[1])) report.problem({ ...at(match.index), rule: 'acronym-case', message: `${match[1]} spells an acronym in capitals`, fix: 'Treat acronyms as words: SqlDriver, isRtl, loadHttpUrl, AdmobAdsAdapter.' });
  }
  const booleans = [
    /(?<![\w$.])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*:\s*boolean\b(?!\s*[|&[])/g,
    /(?<![\w$.])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:true|false)\s*[;,\n]/g,
    /[(,]\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*boolean\b(?!\s*[|&[])/g,
  ];
  for (const regex of booleans) {
    for (const match of code.matchAll(regex)) {
      if (!hasBooleanPrefix(match[1])) report.problem({ ...at(match.index), rule: 'boolean-name', message: `boolean ${match[1]} has no is/has/can/should/did/will/was prefix`, fix: `Name it as a question: is${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}, has..., can...` });
    }
  }
  for (const match of code.matchAll(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/gm)) {
    const valueAt = match.index + match[0].length;
    const rest = code.slice(valueAt, valueAt + 400);
    const literal = /^(?:-?\d[\d_.]*|['"]|\/(?![/*]))/.test(rest) && /^[^\n;]*;/.test(rest);
    const statementEnd = code.indexOf(';', valueAt);
    const asConst = /^[[{]/.test(rest) && /\bas\s+const\b(\s+satisfies\s+[^;]+)?\s*$/.test(code.slice(valueAt, statementEnd));
    const name = match[1];
    if ((literal || asConst) && !isUpperSnake(name) && !stringAt.get(valueAt)?.quote?.startsWith('`')) {
      report.problem({ ...at(match.index), rule: 'constant-name', message: `module constant ${name} holds fixed data but is not UPPER_CASE`, fix: 'Name module-level fixed data in UPPER_CASE (MAX_UNDO_DEPTH, THEME_PREFERENCES); objects built by a call stay camelCase.' });
    }
  }
  // Handlers are the functions a component declares for its JSX: only .tsx files, and only names
  // declared as functions inside a body (an on* prop may also take a value, e.g. Skia's onSize).
  if (!rel.endsWith('.tsx')) return;
  for (const match of code.matchAll(/\bon[A-Z][\w$]*=\{\s*([A-Za-z_$][\w$]*)\s*\}/g)) {
    const name = match[1];
    const isLocalFunction = new RegExp(`^[ \\t]+(?:function\\s+${name}\\b|(?:const|let)\\s+${name}\\s*(?::[^=;]+)?=\\s*(?:async\\s*)?(?:function\\b|\\([^()]*\\)\\s*(?::\\s*[^=;]+)?=>|[A-Za-z_$][\\w$]*\\s*=>))`, 'm').test(code);
    if (isLocalFunction && !/^(handle|on)[A-Z]/.test(name)) report.problem({ ...at(match.index), rule: 'handler-name', message: `on* prop receives "${name}"`, fix: 'Name the handler handleX (handlePress) or pass the callback prop through (onPress={onPress}).' });
  }
  for (const match of code.matchAll(/^[ \t]+(?:const|let)\s+(on[A-Z][\w$]*)\s*(?::[^=;]+)?=\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+)?=>/gm)) {
    report.problem({ ...at(match.index), rule: 'handler-name', message: `local handler named ${match[1]}`, fix: `Name local handlers handleX (handle${match[1].slice(2)}); onX is for callback props.` });
  }
}

function checkCatalog(rel, root, games, report) {
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  } catch (error) {
    report.problem({ file: rel, rule: 'i18n-key', message: `not valid JSON: ${error.message}`, fix: 'Keep catalogs flat JSON objects: key -> ICU message.' });
    return;
  }
  const game = /^apps\/([^/]+)\//.exec(rel)?.[1];
  for (const [key, message] of Object.entries(catalog)) {
    const at = { file: rel, rule: 'i18n-key' };
    if (!I18N_KEY.test(key)) report.problem({ ...at, message: `key '${key}' breaks the grammar`, fix: 'Use 2-5 dot-separated kebab-case segments, e.g. home.play-button.continue.' });
    else if (game && !key.startsWith(`${game}.`)) report.problem({ ...at, message: `game key '${key}' does not start with '${game}.'`, fix: `Prefix every key of this catalog with ${game}. so Shell and game catalogs never collide.` });
    else if (!game && games.includes(key.split('.')[0])) report.problem({ ...at, message: `Shell key '${key}' starts with a game id`, fix: 'Shell keys start with a screen area, common, dialog or date; game texts live in the game catalogs.' });
    if (typeof message === 'string') checkPlaceholders(rel, key, message, report);
  }
}

function checkPlaceholders(rel, key, message, report) {
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    const ch = message[i];
    if (ch === "'" && /['{}]/.test(message[i + 1] ?? '')) {
      i += 1;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) {
        const arg = /^\s*([^,}\s]+)\s*(?:,\s*([a-z]+))?/.exec(message.slice(i + 1));
        const name = arg?.[1] ?? '';
        const type = arg?.[2];
        const where = { file: rel, rule: 'i18n-placeholder' };
        if (!/^[a-z][A-Za-z0-9]*$/.test(name)) report.problem({ ...where, message: `'${key}' has placeholder {${name}}`, fix: 'Name placeholders in camelCase after the value: {level, number}, {movesCount, plural, ...}, {packName}.' });
        else if (type === undefined && !/(Name|Text)$/.test(name)) report.problem({ ...where, message: `'${key}' has a plain {${name}}`, fix: 'Type numbers ({level, number}), make counts plurals, or name free text ...Name / ...Text ({packName}, {priceText}).' });
      }
      depth += 1;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
}

// Indentation of a YAML line, counting a list dash as indentation ("  - tapOn" is 4).
const yamlIndent = (line) => /^\s*/.exec(line.replace(/^(\s*)-\s/, '$1  '))[0].length;
const isContent = (line) => line.trim() !== '' && !line.trim().startsWith('#');
const unquote = (text) => text.trim().replace(/^(['"])(.*)\1$/, '$2');

/** Index of the nearest line above i with a smaller indentation (its YAML parent), or -1. */
function parentOf(lines, i) {
  const own = yamlIndent(lines[i]);
  for (let j = i - 1; j >= 0; j -= 1) if (isContent(lines[j]) && yamlIndent(lines[j]) < own) return j;
  return -1;
}

/** Indexes of the lines inside the block that starts at line k (deeper indentation). */
function childrenOf(lines, k) {
  const out = [];
  for (let j = k + 1; j < lines.length; j += 1) {
    if (!isContent(lines[j])) continue;
    if (yamlIndent(lines[j]) <= yamlIndent(lines[k])) break;
    out.push(j);
  }
  return out;
}

/** The text of `when: visible: '<text>'` and the texts tapped under `commands:` of one runFlow. */
function guardOf(lines, runFlow) {
  let visible = null;
  const tapped = [];
  for (const j of childrenOf(lines, runFlow)) {
    if (/^\s*when:\s*$/.test(lines[j])) {
      for (const c of childrenOf(lines, j)) visible = /^\s*visible:\s*(.+?)\s*(#.*)?$/.exec(lines[c])?.[1] ?? visible;
    }
    if (/^\s*commands:\s*$/.test(lines[j])) {
      for (const c of childrenOf(lines, j)) {
        const tap = /^\s*-?\s*tapOn:\s*(['"]?)([^'"#{][^'"#]*)\1\s*(#.*)?$/.exec(lines[c]);
        if (tap) tapped.push(tap[2].trim());
      }
    }
  }
  return visible === null ? null : { visible: unquote(visible), tapped };
}

/**
 * True when line i belongs to the verified OS-dialog guard of a sub-flow:
 *   - runFlow: { when: { visible: 'Open' }, commands: [ - tapOn: 'Open' ] }
 * The iOS "Open" prompt of a deep link has no testID, and the guard taps it only when it shows.
 */
function isDialogGuard(lines, i, text) {
  for (let k = parentOf(lines, i); k >= 0; k = parentOf(lines, k)) {
    if (!/^\s*-?\s*runFlow:\s*$/.test(lines[k])) continue;
    const guard = guardOf(lines, k);
    return guard !== null && guard.visible === text && guard.tapped.includes(text);
  }
  return false;
}

// "# system-ui: <why>" (e2e-maestro's check-flows uses the same comment): OS-owned UI with no testID,
// such as Apple's "Open in ...?" link alert or Google's test ad, on that line or up to 6 lines above.
const SYSTEM_UI = /#\s*system-ui:\s*\S.{5,}/;

function underSystemUi(lines, i) {
  for (let j = i; j >= 0 && j >= i - 6; j -= 1) if (SYSTEM_UI.test(lines[j])) return true;
  return false;
}

function checkFlow(rel, root, report) {
  const lines = readFileSync(join(root, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const at = { file: rel, line: i + 1, rule: 'maestro-selector' };
    // A system dialog (the iOS "Open" prompt of a deep link) has no testID: it is allowed on a line marked
    // "# system dialog", under a "# system-ui: <why>" comment, or inside the runFlow guard that taps it
    // only when it is visible.
    const isSystemUi = underSystemUi(lines, i);
    const shorthand = /^\s*-?\s*(tapOn|doubleTapOn|longPressOn|assertVisible|assertNotVisible|scrollUntilVisible|visible|notVisible):\s*(['"]?)([^'"#\s{][^'"#]*)\2\s*(#.*)?$/.exec(line);
    if (shorthand && !isSystemUi && !/system dialog/i.test(shorthand[4] ?? '') && !isDialogGuard(lines, i, shorthand[3].trim())) {
      report.problem({ ...at, message: `${shorthand[1]} selects by text "${shorthand[3].trim()}"`, fix: `Select by id: ${shorthand[1]}: { id: '<screen>.<element>' }; flows must run unchanged in four languages (OS-owned UI without a testID: a "# system-ui: <why>" comment above it, or mark the line "# system dialog").` });
    }
    const id = /^\s*-?\s*id:\s*(['"]?)([^'"#]+)\1\s*$/.exec(line);
    if (id && !/[*+?[\]()\\|^$]/.test(id[2]) && !id[2].includes('${') && !TEST_ID.test(id[2].trim())) {
      report.problem({ ...at, message: `id "${id[2].trim()}" is not a valid testID`, fix: "Use the element's '<screen>.<element>' testID." });
    }
    if (/^\s*-?\s*text:\s/.test(line)) {
      const own = yamlIndent(line);
      let hasId = false;
      for (let j = i - 1; j >= 0 && yamlIndent(lines[j]) >= own && lines[j].trim() !== ''; j -= 1) if (yamlIndent(lines[j]) === own && /^\s*-?\s*id:/.test(lines[j])) hasId = true;
      for (let j = i + 1; j < lines.length && yamlIndent(lines[j]) >= own && lines[j].trim() !== ''; j += 1) if (yamlIndent(lines[j]) === own && /^\s*id:/.test(lines[j])) hasId = true;
      if (!hasId && !isSystemUi) report.problem({ ...at, message: 'selector by text without an id', fix: 'Select by id; a text matcher may only narrow an id selector (id + text). OS-owned UI without a testID goes under a "# system-ui: <why>" comment.' });
    }
  });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-code-names', json: options.json });
  const games = gameIds(root);
  const files = walk(root, { ignore: IGNORE });
  let checked = 0;
  for (const rel of files) {
    const inScope = ['apps', 'packages', 'test', '__mocks__'].includes(rel.split('/')[0]) || /^[^/]+\.tsx?$/.test(rel);
    if (!inScope) continue;
    if (/\.tsx?$/.test(rel)) {
      checked += 1;
      const text = readFileSync(join(root, rel), 'utf8');
      const scan = scanSource(text);
      const isMock = rel.startsWith('__mocks__/');
      if (!any(rel, NODE_CODE)) {
        checkTestIds(rel, scan, text, report);
        checkKinds(rel, scan, report);
        checkKeyCalls(rel, scan, games, report);
      }
      checkEnv(rel, scan, report);
      if (/\.test\.tsx?$/.test(rel)) checkTests(rel, scan, report);
      if (!isMock) checkDeclarations(rel, scan, report);
    } else if (/^(packages\/shell\/src\/i18n\/catalogs|apps\/[^/]+\/src\/i18n)\/[a-z]+\.json$/.test(rel)) {
      checked += 1;
      checkCatalog(rel, root, games, report);
    } else if (/\/e2e\/(flows|subflows)\/.+\.ya?ml$/.test(rel)) {
      checked += 1;
      checkFlow(rel, root, report);
    }
  }
  return report.finish({ checked, unit: 'files' });
});
