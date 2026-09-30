#!/usr/bin/env node
// check-save-layer.mjs: checks the save layer of a Pocket Arcade app repo: the file set, SQLite
// only inside services/save, WAL + synchronous FULL, one transaction per write, validation before
// every write, Premium guard, strict valibot schemas, one migration step per version, frozen
// fixtures that still match their checksums, and a WAL checkpoint on background.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-save-layer.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SHELL_DUE_TARGETS, createReporter, dueSkipReason, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { fnv1a32 } from './lib/save-db.mjs';

const SPEC = {
  name: 'check-save-layer',
  summary:
    'Checks the save layer of a Pocket Arcade app repo (packages/shell/src/services/save and its callers) against the persistence rules, and recomputes the frozen save fixtures\' checksums.',
  usage: '[repo-root] [--json] (or --root <dir>)',
  options: {
    root: { type: 'string', default: '.', value: 'dir', help: 'App repo root (holds packages/shell/src)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  missing-file            a file of the standard save layer is missing (the boot files hydrate-save.ts and',
    '                          use-checkpoint-on-background.ts, with their tests, print SKIP until',
    '                          packages/shell/src/app/start-shell.ts exists: they are due at Shell step 6)',
    '  sqlite-outside-save     expo-sqlite / node:sqlite used outside services/save, services/error-log, test/, tooling',
    '  second-persistence      AsyncStorage, MMKV, SecureStore or zustand/middleware used for app data',
    '  zod-banned              zod imported (valibot is the chosen validator)',
    '  pragmas                 save-db-schema.ts lacks journal_mode = WAL, synchronous = FULL or STRICT tables',
    '  transaction-write       SaveStore.write not inside driver.transaction, or no wal_checkpoint(TRUNCATE)',
    '  quarantine-not-delete   a DELETE FROM save_slots (bad rows are quarantined, never deleted)',
    '  validate-before-write   SaveService writes before validateSaveDoc, lacks the Premium guard or ignores isReadOnly',
    '  schema-strict           v.object / v.looseObject / v.any in a save schema (use v.strictObject)',
    '  schema-version          save-doc-vN.ts without schemaVersion: v.literal(N), or LATEST_* not the highest N',
    '  migration-chain         a missing vK-to-vK+1 step, its registration or its test',
    '  migration-pure          a migration imports runtime code, today\'s defaults, or reads time/randomness',
    '  fixture-missing         save-vN.minimal.json / save-vN.full.json or its checksum entry is missing',
    '  fixture-frozen          a frozen fixture no longer matches its recorded fnv1a32 checksum',
    '  fixture-untested        save-fixtures.test.ts does not run a fixture',
    '  write-outside-service   a SaveStore row written outside services/save',
    '  premium-reset           reset-progress.ts touches the premium section',
    '  peek-writes             peek-current-save.ts runs a statement that writes',
    '  no-background-checkpoint nothing checkpoints the WAL when the app goes to the background (or the hook is never called)',
    '  newer-db-crash          opening a save.db whose tables are newer (user_version) throws, or the boot ignores it',
  ].join('\n'),
};

const SHELL = 'packages/shell/src';
const SAVE = `${SHELL}/services/save`;
const REQUIRED = [
  `${SAVE}/sql-driver.ts`,
  `${SAVE}/save-store.ts`,
  `${SAVE}/save-db-schema.ts`,
  `${SAVE}/expo-sqlite-sql-driver.ts`,
  `${SAVE}/sqlite-save-store.ts`,
  `${SAVE}/fake-save-store.ts`,
  `${SAVE}/checksum.ts`,
  `${SAVE}/save-codec.ts`,
  `${SAVE}/load-plan.ts`,
  `${SAVE}/load-plan.test.ts`,
  `${SAVE}/save-service.ts`,
  `${SAVE}/save-service.test.ts`,
  `${SAVE}/reset-progress.ts`,
  `${SAVE}/reset-progress.test.ts`,
  `${SAVE}/peek-current-save.ts`,
  `${SAVE}/schema/save-primitives.ts`,
  `${SAVE}/schema/save-doc.ts`,
  `${SAVE}/schema/default-save-doc.ts`,
  `${SAVE}/migrations/save-migrations.ts`,
  `${SAVE}/migrations/save-migrations.test.ts`,
  `${SAVE}/fixtures/fixture-checksums.ts`,
  `${SAVE}/fixtures/save-fixtures.test.ts`,
  `${SHELL}/services/clock/clock-port.ts`,
  `${SHELL}/services/error-log/error-log-port.ts`,
  'test/integration/save/node-sqlite-sql-driver.ts',
  'test/integration/save/sqlite-save-store.test.ts',
];
/**
 * The boot's save files: copied at Shell step 6 with the Shell boot (start-shell.ts), because they
 * need @react-navigation/native, RNTL, the state-stores testing helpers and the test-only pair,
 * which arrive then. Before start-shell.ts exists a missing one is a SKIP line, never a problem.
 */
const BOOT_FILES = [
  `${SHELL}/app/hydrate-save.ts`,
  `${SHELL}/app/hydrate-save.test.ts`,
  `${SHELL}/app/use-checkpoint-on-background.ts`,
  `${SHELL}/app/use-checkpoint-on-background.test.ts`,
];
const SQLITE_ALLOWED = [`${SAVE}/`, `${SHELL}/services/error-log/`, 'test/', 'packages/tooling/'];
const isTest = (rel) => /\.test\.tsx?$/.test(rel);

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(options.root, 'app repo root');
  requireDir(join(root, SHELL), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-save-layer', json: options.json });
  const files = ['packages', 'apps', 'test']
    .filter((top) => existsSync(join(root, top)))
    .flatMap((top) => walk(join(root, top), { include: ['*.ts', '*.tsx'], ignore: ['ios', 'android', 'build'] }).map((rel) => `${top}/${rel}`));
  const text = new Map(files.map((rel) => [rel, maskComments(readFileSync(join(root, rel), 'utf8'))]));
  const ctx = {
    root,
    text,
    skip: (file, rule, message) => report.skip({ file, rule, message }),
    add: (file, index, rule, message, fix) =>
      report.problem({ file, line: index < 0 ? 0 : lineOf(text.get(file) ?? '', index), rule, message, fix }),
  };
  for (const rel of REQUIRED) {
    if (!text.has(rel)) ctx.add(rel, -1, 'missing-file', 'required save-layer file is missing', 'Copy it from the skill templates (templates/<same path>) and adapt it.');
  }
  const bootDue = dueSkipReason(root, SHELL_DUE_TARGETS.boot);
  ctx.bootDue = bootDue;
  for (const rel of BOOT_FILES.filter((file) => !text.has(file))) {
    if (bootDue !== null) report.skip({ file: rel, rule: 'missing-file', message: bootDue });
    else ctx.add(rel, -1, 'missing-file', 'required boot save file is missing', 'Copy it from the skill templates (templates/<same path>): the Shell boot calls hydrateSave and mounts useCheckpointOnBackground once.');
  }
  for (const [rel, source] of text) checkImports(ctx, rel, source);
  checkSqlFiles(ctx);
  checkService(ctx);
  const latest = checkSchemaVersions(ctx);
  checkMigrations(ctx, latest);
  checkFixtures(ctx, latest);
  checkBootAndBackground(ctx);
  return report.finish({ checked: files.length, unit: 'source files' });
});

function checkImports({ add }, rel, source) {
  for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)'((?:expo-sqlite|node:sqlite)[^']*)'/g)) {
    if (!SQLITE_ALLOWED.some((prefix) => rel.startsWith(prefix)) && !isTest(rel)) {
      const fix = match[1] === 'expo-sqlite/kv-store'
        ? 'Key-value storage has two uses, both adapters in services/save/: the direction guard (sqlite-kv-direction-guard-adapter.ts, behind the DirectionGuard port) and the test-only debug flags (sqlite-kv-debug-store-adapter.ts, reached only through TEST_ONLY); anything else goes into the save document.'
        : 'Only services/save (drivers, SaveStore) and services/error-log talk to SQLite; everything else calls SaveService.';
      add(rel, match.index, 'sqlite-outside-save', `imports ${match[1]} outside the save layer`, fix);
    }
  }
  for (const match of source.matchAll(/from\s+'(@react-native-async-storage\/async-storage|react-native-mmkv|expo-secure-store|zustand\/middleware)'/g)) {
    add(rel, match.index, 'second-persistence', `imports ${match[1]}`, 'The one save document in save.db is the only persistence; add a section to the schema instead.');
  }
  for (const match of source.matchAll(/from\s+'(zod(?:\/[^']*)?)'/g)) {
    add(rel, match.index, 'zod-banned', `imports ${match[1]}`, 'Use valibot 1.5.0 (no eval / new Function; strictObject, variant).');
  }
  for (const match of source.matchAll(/DELETE\s+FROM\s+save_slots/gi)) {
    add(rel, match.index, 'quarantine-not-delete', 'deletes save rows', 'Copy a bad row into save_quarantine (SaveStore.quarantine) and overwrite the slot; never delete player data.');
  }
  // The performance-budgets save benchmark (test builds only) times raw SaveStore writes into its own
  // scratch database, perf-bench.db, never the player's save.db.
  const isScratchBenchmark = rel === 'packages/shell/src/app/perf/save-benchmark.ts' && /\bBENCHMARK_DB_FILE\s*=\s*'perf-bench\.db'/.test(source);
  const isSaveLayer = rel.startsWith(`${SAVE}/`) || rel.startsWith('test/') || rel.startsWith('packages/tooling/') || isTest(rel) || isScratchBenchmark;
  if (!isSaveLayer) {
    for (const match of source.matchAll(/\b(\w*[sS]tore\.write\s*\(|UPSERT_SLOT_SQL)/g)) {
      add(rel, match.index, 'write-outside-service', `writes save rows directly (${match[1].replace(/\s*\($/, '')})`, 'Call save.update(recipe, { refreshBackup }) so the document is validated and written in one transaction.');
    }
  }
}

function need(ctx, rel, pattern, rule, message, fix) {
  const source = ctx.text.get(rel);
  if (source === undefined) return;
  if (!pattern.test(source)) ctx.add(rel, 0, rule, message, fix);
}

function checkSqlFiles(ctx) {
  const schema = `${SAVE}/save-db-schema.ts`;
  need(ctx, schema, /journal_mode\s*=\s*WAL/i, 'pragmas', 'no PRAGMA journal_mode = WAL', 'SAVE_DB_PRAGMAS sets journal_mode = WAL and synchronous = FULL on every open.');
  need(ctx, schema, /synchronous\s*=\s*FULL/i, 'pragmas', 'no PRAGMA synchronous = FULL', 'FULL makes a committed move survive power loss; set it on every open (it is per connection).');
  need(ctx, schema, /\)\s*STRICT\s*;/, 'pragmas', 'save tables are not STRICT', 'Create save_slots, save_quarantine and error_log as STRICT tables.');
  const store = `${SAVE}/sqlite-save-store.ts`;
  const source = ctx.text.get(store);
  if (source !== undefined) {
    // Every write() that touches SQL runs it inside driver.transaction (the read-only store for a
    // newer save.db has a write() that does nothing, which is fine).
    const writes = [...source.matchAll(/\bwrite\s*:/g)].map((match) => ({ index: match.index, body: source.slice(match.index, match.index + 400).split(/\n\s{4}\w+\s*:/)[0] }));
    const transactional = writes.filter((write) => /driver\.transaction\s*\(/.test(write.body));
    const bare = writes.filter((write) => !/driver\.transaction\s*\(/.test(write.body) && /\b(upsert|driver\.run|driver\.exec)\s*\(/.test(write.body));
    const missing = transactional.length === 0 ? [writes[0] ?? { index: 0 }] : [];
    for (const write of bare.length > 0 ? bare : missing) {
      ctx.add(store, write.index, 'transaction-write', 'write() does not run inside driver.transaction', 'Wrap both UPSERTs in driver.transaction(() => ...) so current and backup commit together.');
    }
    need(ctx, store, /wal_checkpoint\(TRUNCATE\)/, 'transaction-write', 'checkpoint() does not run PRAGMA wal_checkpoint(TRUNCATE)', 'checkpoint: driver.get("PRAGMA wal_checkpoint(TRUNCATE)", []).');
  }
  checkNewerDatabase(ctx);
}

/** Spec 8.14: a save.db written by a newer app (older build installed) never crash-loops the boot. */
function checkNewerDatabase(ctx) {
  const store = `${SAVE}/sqlite-save-store.ts`;
  const source = ctx.text.get(store);
  if (source === undefined) return;
  const fix = 'When PRAGMA user_version > DB_STRUCTURE_VERSION, return a store that reads null and writes nothing, with newerStructureVersion() = that version; hydrateSave passes it to planLoad as newerStructure, which plays read-only (outcome newer-version).';
  for (const match of source.matchAll(/\bthrow\b/g)) {
    ctx.add(store, match.index, 'newer-db-crash', 'the SQLite store throws while opening save.db: a newer file would crash every launch', fix);
  }
  need(ctx, store, /\bnewerStructureVersion\s*:/, 'newer-db-crash', 'the SQLite store does not report a newer table version (newerStructureVersion)', fix);
  need(ctx, `${SHELL}/app/hydrate-save.ts`, /\bnewerStructure\s*:\s*\w+\.newerStructureVersion\s*\(\s*\)/, 'newer-db-crash', 'hydrateSave does not pass store.newerStructureVersion() to planLoad', fix);
  need(ctx, `${SAVE}/load-plan.ts`, /\bnewerStructure\b/, 'newer-db-crash', 'planLoad ignores a newer save.db structure', fix);
}

function checkService(ctx) {
  const rel = `${SAVE}/save-service.ts`;
  const source = ctx.text.get(rel);
  if (source !== undefined) {
    const validate = source.search(/validateSaveDoc\s*\(/);
    const write = source.search(/store\.write\s*\(/);
    if (validate === -1 || (write !== -1 && write < validate)) {
      ctx.add(rel, Math.max(write, 0), 'validate-before-write', 'the document is not validated before it is written', 'In the writer: validateSaveDoc(next) first; an invalid document is logged (thrown in test builds) and never written.');
    }
    need(ctx, rel, /keepPremiumUnlessRevoked\s*\(/, 'validate-before-write', 'update() does not apply the Premium guard', 'doc = keepPremiumUnlessRevoked(doc, recipe(doc)) in update(): Premium only turns off with a revocation date.');
    need(ctx, rel, /isReadOnly/, 'validate-before-write', 'the service ignores plan.isReadOnly', 'A save from a newer app is never written: skip persist when plan.isReadOnly.');
  }
  const reset = `${SAVE}/reset-progress.ts`;
  const resetSource = ctx.text.get(reset);
  const premium = resetSource?.search(/\bpremium\s*:/) ?? -1;
  if (premium !== -1) ctx.add(reset, premium, 'premium-reset', 'a reset writes the premium section', 'Resets keep premium, settings, firstRun and ads: spread ...doc and replace only progress, run, daily, stats, hints, upsell.');
  const peek = `${SAVE}/peek-current-save.ts`;
  const peekSource = ctx.text.get(peek) ?? '';
  for (const match of peekSource.matchAll(/\.(run|exec|transaction)\s*\(/g)) {
    ctx.add(peek, match.index, 'peek-writes', `the startup peek calls .${match[1]}()`, 'The peek runs before the direction check: read only (driver.get), no DDL, no write.');
  }
}

function checkSchemaVersions(ctx) {
  const versions = [];
  for (const [rel, source] of ctx.text) {
    const match = /\/schema\/save-doc-v(\d+)\.ts$/.exec(rel);
    if (rel.startsWith(`${SAVE}/schema/`) && !isTest(rel)) {
      for (const loose of source.matchAll(/\bv\.(object|looseObject|any)\s*\(/g)) {
        ctx.add(rel, loose.index, 'schema-strict', `uses v.${loose[1]}`, 'Use v.strictObject (an unknown key is an error, so a migration typo cannot slip through) and precise types.');
      }
    }
    if (match === null) continue;
    const n = Number(match[1]);
    versions.push(n);
    if (!new RegExp(`schemaVersion\\s*:\\s*v\\.literal\\(\\s*${n}\\s*\\)`).test(source)) {
      ctx.add(rel, 0, 'schema-version', `save-doc-v${n}.ts does not pin schemaVersion: v.literal(${n})`, `Set schemaVersion: v.literal(${n}) in SAVE_DOC_V${n}.`);
    }
  }
  const latest = versions.length === 0 ? 0 : Math.max(...versions);
  const docRel = `${SAVE}/schema/save-doc.ts`;
  const doc = ctx.text.get(docRel);
  if (latest === 0) {
    ctx.add(`${SAVE}/schema/save-doc-v1.ts`, -1, 'missing-file', 'no schema/save-doc-vN.ts file', 'Copy save-doc-v1.ts (and the section files) from the templates.');
  } else if (doc !== undefined) {
    if (!new RegExp(`LATEST_SAVE_VERSION\\s*=\\s*${latest}\\b`).test(doc)) ctx.add(docRel, 0, 'schema-version', `LATEST_SAVE_VERSION is not ${latest} (the highest save-doc-vN.ts)`, `Set LATEST_SAVE_VERSION = ${latest} and LATEST_SAVE_SCHEMA = SAVE_DOC_V${latest} together.`);
    if (!new RegExp(`LATEST_SAVE_SCHEMA\\s*=\\s*SAVE_DOC_V${latest}\\b`).test(doc)) ctx.add(docRel, 0, 'schema-version', `LATEST_SAVE_SCHEMA is not SAVE_DOC_V${latest}`, `Point LATEST_SAVE_SCHEMA at SAVE_DOC_V${latest}.`);
  }
  return latest;
}

function checkMigrations(ctx, latest) {
  const listRel = `${SAVE}/migrations/save-migrations.ts`;
  const list = ctx.text.get(listRel) ?? '';
  for (let k = 1; k < latest; k += 1) {
    const step = `${SAVE}/migrations/v${k}-to-v${k + 1}.ts`;
    const source = ctx.text.get(step);
    if (source === undefined) {
      ctx.add(step, -1, 'migration-chain', `no migration step v${k} -> v${k + 1}`, `Write the pure step V${k}_TO_V${k + 1} = { from: ${k}, migrate } and append it to SAVE_MIGRATIONS.`);
      continue;
    }
    if (!new RegExp(`from\\s*:\\s*${k}\\b`).test(source)) ctx.add(step, 0, 'migration-chain', `the step does not declare from: ${k}`, `Set from: ${k}.`);
    if (!new RegExp(`\\bV${k}_TO_V${k + 1}\\b`).test(list)) ctx.add(listRel, 0, 'migration-chain', `SAVE_MIGRATIONS does not list V${k}_TO_V${k + 1}`, 'Append the step to SAVE_MIGRATIONS (ordered, append-only).');
    if (!ctx.text.has(step.replace(/\.ts$/, '.test.ts'))) ctx.add(step, 0, 'migration-chain', 'the step has no test', `Add v${k}-to-v${k + 1}.test.ts: v${k} fixture -> exact expected v${k + 1} JSON, plus a fast-check property.`);
  }
  for (const [rel, source] of ctx.text) {
    if (!/\/migrations\/v\d+-to-v\d+\.ts$/.test(rel)) continue;
    for (const match of source.matchAll(/import\s+(?!type\b)[^;]*?from\s+'([^']+)'/g)) {
      if (!/\/migrations\//.test(match[1])) {
        ctx.add(rel, match.index, 'migration-pure', `imports ${match[1]}`, "A step is frozen plain-JSON code: write literal values; never import today's schema, defaults or runtime code.");
      }
    }
    for (const match of source.matchAll(/\b(Date\.now|new\s+Date|Math\.random)\s*\(/g)) {
      ctx.add(rel, match.index, 'migration-pure', `calls ${match[1]}()`, 'A migration never reads the clock or randomness: the same old document must always give the same new one.');
    }
  }
}

function checkFixtures(ctx, latest) {
  const checksumsRel = `${SAVE}/fixtures/fixture-checksums.ts`;
  const checksums = ctx.text.get(checksumsRel) ?? '';
  const testRel = `${SAVE}/fixtures/save-fixtures.test.ts`;
  const test = ctx.text.get(testRel) ?? '';
  for (let n = 1; n <= latest; n += 1) {
    for (const kind of ['minimal', 'full']) {
      const name = `save-v${n}.${kind}`;
      const rel = `${SAVE}/fixtures/${name}.json`;
      const abs = join(ctx.root, rel);
      if (!existsSync(abs)) {
        ctx.add(rel, -1, 'fixture-missing', `no ${name}.json`, `Write it with the v${n} app (minimal = the default document, full = every section filled), then freeze it.`);
        continue;
      }
      let json;
      try {
        json = JSON.parse(readFileSync(abs, 'utf8'));
      } catch {
        ctx.add(rel, -1, 'fixture-frozen', `${name}.json is not valid JSON`, 'Restore the frozen file from git; fixtures are never edited.');
        continue;
      }
      if (json?.schemaVersion !== n) ctx.add(rel, -1, 'fixture-frozen', `${name}.json has schemaVersion ${json?.schemaVersion}, expected ${n}`, 'Restore the frozen file from git.');
      const recorded = new RegExp(`'${name.replace(/\./g, '\\.')}'\\s*:\\s*'([0-9a-f]{8})'`).exec(checksums)?.[1];
      const actual = fnv1a32(JSON.stringify(json));
      if (recorded === undefined) ctx.add(checksumsRel, -1, 'fixture-missing', `no checksum entry for ${name}`, `Add '${name}': '${actual}' to FIXTURE_CHECKSUMS (with a Gate-Change: trailer).`);
      else if (recorded !== actual) ctx.add(rel, -1, 'fixture-frozen', `${name}.json changed: fnv1a32 is ${actual}, the recorded checksum is ${recorded}`, 'A shipped fixture is frozen: restore it from git. A new format is a new version with its own fixtures, never an edit.');
      if (!test.includes(`'${name}'`)) ctx.add(testRel, -1, 'fixture-untested', `${name} is not in FIXTURES`, `Import ${name}.json and add { name: '${name}', version: ${n}, json } to FIXTURES.`);
    }
  }
}

function checkBootAndBackground(ctx) {
  const appFiles = [...ctx.text.keys()].filter((rel) => rel.startsWith(`${SHELL}/app/`) && !isTest(rel));
  const listeners = appFiles.filter((rel) => /'background'/.test(ctx.text.get(rel)) && /\.checkpoint\s*\(\s*\)/.test(ctx.text.get(rel)));
  if (listeners.length === 0 && ctx.bootDue !== null) {
    ctx.skip(`${SHELL}/app/use-checkpoint-on-background.ts`, 'no-background-checkpoint', ctx.bootDue);
    return;
  }
  if (listeners.length === 0) {
    ctx.add(`${SHELL}/app/use-checkpoint-on-background.ts`, -1, 'no-background-checkpoint', 'no AppState "background" listener calls save.checkpoint()', 'Add useCheckpointOnBackground(save) (template) and call it once in ShellApp: the device backup then copies one self-contained save.db.');
    return;
  }
  // A hook that nobody calls checkpoints nothing. Checked once the Shell's root component exists.
  const shellApp = `${SHELL}/app/shell-app.tsx`;
  const isHookOnly = listeners.every((rel) => /export\s+function\s+use\w+/.test(ctx.text.get(rel)));
  const isCalled = [...ctx.text].some(([rel, source]) => !isTest(rel) && !listeners.includes(rel) && /\buseCheckpointOnBackground\s*\(/.test(source));
  if (ctx.text.has(shellApp) && isHookOnly && !isCalled) {
    ctx.add(shellApp, -1, 'no-background-checkpoint', 'useCheckpointOnBackground is defined but never called', 'Call useCheckpointOnBackground(hydrated.save) once in ShellApp (the Shell root component).');
  }
}
