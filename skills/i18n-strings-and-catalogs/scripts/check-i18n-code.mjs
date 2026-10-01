#!/usr/bin/env node
// check-i18n-code.mjs: checks that app code shows text only through t()/T with literal keys that
// exist, that react-intl stays inside the i18n folder, that dates never go through Intl date APIs,
// and that the Intl polyfills load first (start-shell.ts, Jest) with exactly en/de/fa/ckb data.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-i18n-code.mjs [repo-root]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, lineOf, parseArgs, run, toPosix, walk } from './check-lib.mjs';
import { findCalls, findImports, findJsxTags, jsxAttributes, literalOf, maskCode } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-i18n-code',
  summary: 'Checks Pocket Arcade source (packages/shell/src, packages/game-kit/src, apps/*/src, apps/*/index.ts) for hard-coded UI text, built or unknown message keys, react-intl outside the i18n folder, Intl date APIs, and the Intl polyfill wiring.',
  usage: '[repo-root]',
  options: {
    root: { type: 'string', value: 'dir', help: 'App repo root (same as the positional repo-root, default .)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  jsx-literal-text    words written between JSX tags (use <T id=... /> or AppText text={t(...)})',
    '  literal-prop-text   a literal or built string in a text prop (also a literal branch of ?: or ??):',
    '                      text, label, title, hint, message, placeholder, subtitle, description, caption,',
    '                      summary, accessibilityLabel/Hint, and literal text given to Alert.alert',
    '  dynamic-key         a key built with a template or +',
    '  game-key-cast       asGameKey(...) outside packages/shell/src/i18n/game-message-text.ts: a game message id',
    '                      (and every game table of ids) becomes text only through gameMessageText(t, message)',
    '  unknown-key         t(\'k\'), t(c ? \'k1\' : \'k2\'), <T id="k"> where a key is in no en.json,',
    '                      and every \'<game-id>.…\' id literal in apps/<game-id>/src (nameId, messageId, labelId,',
    '                      a hud goal id) that the game\'s en.json lacks',
    '  react-intl-import   react-intl imported outside packages/shell/src/i18n/',
    '  date-format-api     Intl.DateTimeFormat, Intl.RelativeTimeFormat or toLocale*String (use formatDayMonth)',
    '  nested-isolates     a text that already carries bidi isolates passed straight into another t() call as a value:',
    '                      formatDayMonth(...) / formatWeekdayDayMonth(...) or a t() call given a *Name/*Text value; wrap it in',
    '                      stripIsolates() (i18n/bidi.ts) first, or nested FSI/PDI make CoreText flip the date in fa',
    '  polyfill-first      packages/shell/src/app/start-shell.ts must import the Intl polyfills first',
    '  polyfill-locales    intl-polyfills.ts must force Locale/PluralRules/NumberFormat with en, de, fa, ckb data only',
    '  jest-polyfills      jest.config.js must list intl-polyfills.ts in setupFiles',
    '',
    'Test files (*.test.ts[x]) and packages/shell/src/testing/ may use literal strings (queries, fixtures).',
  ].join('\n'),
};

/** Formatters whose result already holds FSI…PDI: they interpolate a *Name value through t(). */
const ISOLATED_FORMATTERS = ['formatDayMonth', 'formatWeekdayDayMonth'];
const T_CALL = '(?:[A-Za-z_$][A-Za-z0-9_$]*\\.)?t';

const TEXT_PROPS = new Set(['text', 'label', 'title', 'hint', 'message', 'placeholder', 'subtitle', 'description', 'caption', 'summary', 'accessibilityLabel', 'accessibilityHint']);
const LETTER = /\p{L}/u;
const POLYFILL_FILE = 'packages/shell/src/i18n/intl-polyfills.ts';
const POLYFILL_IMPORT = '@e07/shell/i18n/intl-polyfills.ts';
const EXPECTED_POLYFILLS = [
  '@formatjs/intl-getcanonicallocales/polyfill.js',
  '@formatjs/intl-locale/polyfill-force.js',
  '@formatjs/intl-pluralrules/polyfill-force.js',
  ...['en', 'de', 'fa', 'ckb'].map((l) => `@formatjs/intl-pluralrules/locale-data/${l}.js`),
  '@formatjs/intl-numberformat/polyfill-force.js',
  ...['en', 'de', 'fa', 'ckb'].map((l) => `@formatjs/intl-numberformat/locale-data/${l}.js`),
];

function isTestFile(rel) {
  return /\.test\.tsx?$/.test(rel) || rel.includes('/testing/') || rel.includes('__mocks__/');
}

function sourceFiles(root) {
  const files = [];
  const add = (dir) => {
    if (!existsSync(join(root, dir))) return;
    for (const rel of walk(join(root, dir), { include: ['*.ts', '*.tsx'], ignore: ['*.d.ts', 'ios', 'android', 'build', 'dist'] })) files.push(`${dir}/${rel}`);
  };
  add('packages/shell/src');
  add('packages/game-kit/src');
  const apps = join(root, 'apps');
  if (existsSync(apps)) {
    for (const id of readdirSync(apps).sort()) {
      if (!statSync(join(apps, id)).isDirectory()) continue;
      add(`apps/${id}/src`);
      if (existsSync(join(apps, id, 'index.ts'))) files.push(`apps/${id}/index.ts`);
    }
  }
  return files;
}

function loadKeys(root) {
  const read = (file) => {
    if (!existsSync(file)) return null;
    try {
      return new Set(Object.keys(JSON.parse(readFileSync(file, 'utf8'))));
    } catch {
      return null;
    }
  };
  const shell = read(join(root, 'packages/shell/src/i18n/catalogs/en.json'));
  const games = new Map();
  const apps = join(root, 'apps');
  if (existsSync(apps)) {
    for (const id of readdirSync(apps)) {
      const keys = read(join(apps, id, 'src/i18n/en.json'));
      if (keys) games.set(id, keys);
    }
  }
  return { shell, games };
}

function keyExists(key, catalogs) {
  const owner = key.split('.')[0];
  if (catalogs.games.has(owner)) return catalogs.games.get(owner).has(key);
  return catalogs.shell?.has(key) ?? false;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = options.root ?? positionals[0] ?? '.';
  const root = resolve(rootArg);
  const files = sourceFiles(root);
  if (files.length === 0) fail(`nothing to check: no .ts/.tsx files under ${rootArg}/packages/shell/src, packages/game-kit/src or apps/*/src`, 'Run from the app repo root, or pass it: node check-i18n-code.mjs <repo-root>.');
  const report = createReporter({ name: 'check-i18n-code', json: options.json });
  const catalogs = loadKeys(root);
  const shown = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;

  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const masked = maskCode(source);
    const isTest = isTestFile(rel);
    const at = (index) => lineOf(source, index);
    const problem = (index, rule, message, fix) => report.problem({ file: shown(rel), line: at(index), rule, message, fix });

    // react-intl only inside the i18n folder.
    for (const imp of findImports(source, masked)) {
      if ((imp.from === 'react-intl' || imp.from.startsWith('react-intl/')) && !rel.startsWith('packages/shell/src/i18n/')) {
        problem(imp.index, 'react-intl-import', 'react-intl is imported outside packages/shell/src/i18n/', 'Use useT() / <T> from @e07/shell/i18n/*; only the i18n folder talks to react-intl.');
      }
    }

    // Dates never go through Intl date formatting (Hermes picks the Solar Hijri calendar for fa).
    for (const match of masked.matchAll(/\bIntl\.(DateTimeFormat|RelativeTimeFormat)\b|\.(toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/g)) {
      problem(match.index, 'date-format-api', `${match[0].replace(/\s*\($/, '')} formats with the device calendar and ignores the digit setting`, 'Format dates with formatDayMonth(dateKey, t) and numbers with createNumberFormatter(localeTagFor(language, digits)).');
    }

    // Keys: literal, and present in a catalog.
    const checkKey = (index, key, how) => {
      if (!keyExists(key, catalogs)) {
        problem(index, 'unknown-key', `${how} uses "${key}", which is in no en.json catalog`, 'Add the key to en/de/fa/ckb (copy-deck.mjs apply for deck texts) or fix the spelling.');
      }
    };
    for (const call of findCalls(masked, 't')) {
      const arg = source.slice(call.open + 1, call.close).trim();
      const literal = /^(['"])([^'"]+)\1\s*(,|$)/.exec(arg);
      const choice = /^[^,'"`]+\?\s*(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3\s*(,|$)/.exec(arg);
      if (literal) checkKey(call.start, literal[2], 't()');
      else if (choice) {
        checkKey(call.start, choice[2], 't()');
        checkKey(call.start, choice[4], 't()');
      } else if (/^`[^`]*\$\{/.test(arg) || /^(['"`])[^'"`]*\1\s*\+/.test(arg) || /^[\w.]+\s*\+\s*['"`]/.test(arg)) {
        problem(call.start, 'dynamic-key', `t(${arg.split(',')[0]}) builds its key at runtime`, 'Write the key as a literal, or pick it from a typed table of literal keys (MONTH_SHORT_KEYS[month - 1]).');
      }
    }
    if (!isTest) checkNestedIsolates(masked, problem);
    // Game code hands its texts to the Shell as literal ids ('line-siege.progress'): each
    // string literal that starts with the game id and has the key shape must be in its catalog.
    const app = /^apps\/([^/]+)\/src\//.exec(rel);
    if (app && !isTest) {
      const idLiteral = new RegExp(`(['"])(${app[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*){1,4})\\1`, 'g');
      for (const m of source.matchAll(idLiteral)) {
        if (masked[m.index] !== m[1]) continue; // inside a comment
        checkKey(m.index, m[2], 'game message id');
      }
    }
    // Game ids become keys in one place only: packages/shell/src/i18n/game-message-text.ts.
    if (!/^packages\/shell\/src\/i18n\/(messages|game-message-text)\.ts$/.test(rel)) {
      for (const call of findCalls(masked, 'asGameKey')) {
        const arg = source.slice(call.open + 1, call.close).trim();
        problem(call.start, 'game-key-cast', `asGameKey(${arg.slice(0, 40)}) casts a game message id outside game-message-text.ts`, "Keep the id a plain literal (a game's id tables in apps/<game-id>/src/i18n/keys.ts are plain 'as const' strings) and show it with gameMessageText(t, { id, values }) from @e07/shell/i18n/game-message-text.ts, the one place a game id becomes a key.");
      }
    }

    if (!rel.endsWith('.tsx')) {
      if (!isTest) checkAlert(source, masked, problem);
      continue;
    }
    const tags = findJsxTags(source, masked);
    for (const tag of tags) {
      const attrs = jsxAttributes(source, tag, masked);
      if (tag.name === 'T') {
        const id = attrs.get('id');
        const literal = literalOf(id);
        if (literal !== null) checkKey(tag.start, literal, '<T id>');
        else if (id && id.kind === 'expr' && /^`[^`]*\$\{/.test(id.value)) problem(tag.start, 'dynamic-key', '<T id={`...${}`}> builds its key at runtime', 'Pass a literal key or one from a typed table.');
      }
      if (isTest) continue;
      for (const [name, attr] of attrs) {
        if (!TEXT_PROPS.has(name)) continue;
        const literal = literalOf(attr);
        const built = attr.kind === 'expr' && /^`[\s\S]*\$\{[\s\S]*`$/.test(attr.value) && LETTER.test(attr.value.replace(/\$\{[^}]*\}/g, ''));
        const branch = literal === null && !built && attr.kind === 'expr' ? literalBranch(attr.value) : null;
        if ((literal !== null && LETTER.test(literal)) || built || branch !== null) {
          const shownValue = literal !== null ? JSON.stringify(literal) : branch !== null ? `{…${branch}…}` : attr.value;
          problem(attr.index, 'literal-prop-text', `${name}=${shownValue} is text that is not from t()`, `Pass ${name}={t('area.element')} with a catalog key (all four languages); for a choice write {isOn ? t('a.on') : t('a.off')}.`);
        }
      }
      if (!tag.selfClosing) {
        const after = masked.slice(tag.end + 1);
        const stop = after.search(/[<{]/);
        const run = stop === -1 ? '' : after.slice(0, stop);
        if (LETTER.test(run) && !/[;=()]/.test(run)) {
          const offset = tag.end + 1 + run.search(LETTER);
          problem(offset, 'jsx-literal-text', `text "${run.trim().slice(0, 40)}" is written straight into <${tag.name}>`, 'Render text with <T id="area.element" /> or <AppText text={t(\'area.element\')} />.');
        }
      }
    }
    if (!isTest) checkAlert(source, masked, problem);
  }

  // Polyfill wiring.
  const polyfills = join(root, POLYFILL_FILE);
  if (existsSync(polyfills)) {
    const source = readFileSync(polyfills, 'utf8');
    const got = findImports(source).map((imp) => imp.from);
    const expected = EXPECTED_POLYFILLS.join('\n');
    if (got.join('\n') !== expected) {
      const extra = got.filter((from) => !EXPECTED_POLYFILLS.includes(from));
      const missing = EXPECTED_POLYFILLS.filter((from) => !got.includes(from));
      const detail = [missing.length ? `missing ${missing.join(', ')}` : '', extra.length ? `unexpected ${extra.join(', ')}` : '', !missing.length && !extra.length ? 'wrong order' : ''].filter(Boolean).join('; ');
      report.problem({ file: shown(POLYFILL_FILE), line: 1, rule: 'polyfill-locales', message: `the polyfill imports are not the required list (${detail})`, fix: 'Copy templates/shell-i18n/intl-polyfills.ts: getcanonicallocales (conditional), then Locale, PluralRules + en/de/fa/ckb, NumberFormat + en/de/fa/ckb, all forced.' });
    }
  }
  const startShell = join(root, 'packages/shell/src/app/start-shell.ts');
  if (existsSync(startShell)) {
    const first = findImports(readFileSync(startShell, 'utf8'))[0];
    if (!first || first.from !== POLYFILL_IMPORT || !/^import\s*['"]/.test(first.text)) {
      report.problem({ file: shown('packages/shell/src/app/start-shell.ts'), line: first ? lineOf(readFileSync(startShell, 'utf8'), first.index) : 1, rule: 'polyfill-first', message: `the first import is ${first ? `"${first.from}"` : 'missing'}, not the Intl polyfills`, fix: `Make line 1 of the imports: import '${POLYFILL_IMPORT}'; (Hermes has no PluralRules/Locale until it runs).` });
    }
  }
  for (const name of ['jest.config.js', 'jest.config.cjs', 'jest.config.mjs', 'jest.config.ts']) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (!/setupFiles\s*:\s*\[[^\]]*intl-polyfills\.ts/.test(text)) {
      report.problem({ file: shown(name), line: 1, rule: 'jest-polyfills', message: 'Jest does not load intl-polyfills.ts in setupFiles', fix: "Add setupFiles: ['<rootDir>/packages/shell/src/i18n/intl-polyfills.ts'] to the shared project settings, so Jest formats exactly like the phone." });
    }
  }
  return report.finish({ checked: files.length, unit: 'source files' });
});

/**
 * A quoted string with letters that the expression can evaluate to: `isOn ? 'On' : 'Off'`,
 * `name ?? 'Player'`. Call arguments are blanked first, so t(isOn ? 'a.on' : 'a.off') and
 * comparisons such as mode === 'daily' are not text. Returns the literal, or null.
 */
function literalBranch(expression) {
  let depth = 0;
  let blanked = '';
  for (const char of expression) {
    if (char === '(') depth += 1;
    blanked += depth > 0 ? ' ' : char;
    if (char === ')') depth = Math.max(0, depth - 1);
  }
  const match = /(?:^|[?:]|\?\?|\|\||&&)\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/u.exec(blanked.trim());
  return match && LETTER.test(match[2]) && !/\$\{/.test(match[2]) ? match[0].trim() : null;
}

/** Index of the first comma at bracket depth 0 between from and to in masked source, or -1. */
function topLevelComma(masked, from, to) {
  let depth = 0;
  for (let i = from; i < to; i += 1) {
    const ch = masked[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

/** True when a t() call is given a *Name or *Text value, the only values t() isolates. */
function hasTextValue(masked, call) {
  const comma = topLevelComma(masked, call.open + 1, call.close);
  return comma !== -1 && /\b[A-Za-z_$][\w$]*(?:Name|Text)\s*[:,}]/.test(masked.slice(comma, call.close));
}

/**
 * A t() value that is itself isolated text: a date formatter's result, or a t() call given values.
 * t() isolates every *Name/*Text value again, and the nested FSI…PDI leaves the outer isolate
 * with no strong letter, so CoreText runs it left to right ("۲۶ سپتامبر" turns into
 * "سپتامبر ۲۶" inside "روزانه – …"). Strip the inner isolates first: stripIsolates(formatDayMonth(…)).
 */
function checkNestedIsolates(masked, problem) {
  const calls = findCalls(masked, T_CALL);
  const values = calls
    .map((call) => ({ from: topLevelComma(masked, call.open + 1, call.close), to: call.close }))
    .filter((span) => span.from !== -1);
  const strips = findCalls(masked, 'stripIsolates');
  const inside = (index, span) => index > span.from && index < span.to;
  const isStripped = (index) => strips.some((strip) => index > strip.open && index < strip.close);
  const inner = [
    ...ISOLATED_FORMATTERS.flatMap((name) => findCalls(masked, name).map((call) => ({ call, name: `${name}(…)` }))),
    ...calls.filter((call) => hasTextValue(masked, call)).map((call) => ({ call, name: 't(…, values)' })),
  ];
  for (const { call, name } of inner) {
    if (!values.some((span) => inside(call.start, span)) || isStripped(call.start)) continue;
    problem(call.start, 'nested-isolates', `${name} is passed into t() as a value, but its text already carries bidi isolates (FSI…PDI), which t() isolates again`, `Wrap it: stripIsolates(${name.replace('(…, values)', '(…)')}) from @e07/shell/i18n/bidi.ts, so the sentence holds one isolate per value (a date is one run of its language).`);
  }
}

function checkAlert(source, masked, problem) {
  for (const call of findCalls(masked, 'Alert\\.alert')) {
    const arg = source.slice(call.open + 1, call.close).trim();
    if (/^(['"`])[^'"`]*\p{L}/u.test(arg)) problem(call.start, 'literal-prop-text', 'Alert.alert() is given literal text', 'Pass t(\'dialog.<name>.title\') / t(\'dialog.<name>.body\'), or use the Shell dialog (S14).');
  }
}
