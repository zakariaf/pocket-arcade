// save-db.mjs: reads a Pocket Arcade save.db (a COPY of it) and judges its health.
// Shared by inspect-save.mjs and kill-test.mjs. Uses Node's built-in node:sqlite only.

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** FNV-1a 32 over UTF-16 code units, 8 lowercase hex chars: the app's checksum.ts. */
export function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function openSqlite() {
  try {
    return (await import('node:sqlite')).DatabaseSync;
  } catch {
    return null;
  }
}

/**
 * Copies save.db (+ -wal, -shm) into a fresh temporary folder, so the app's own files are never
 * opened in place (opening would checkpoint or lock them). A .sql file is executed into a new
 * temporary database instead (fixtures and hand-made dumps). Returns { path, cleanup }.
 */
export function stageDatabase(DatabaseSync, source) {
  const dir = mkdtempSync(join(tmpdir(), 'inspect-save-'));
  const target = join(dir, 'save.db');
  if (source.endsWith('.sql')) {
    const db = new DatabaseSync(target);
    db.exec(readFileSync(source, 'utf8'));
    db.close();
  } else {
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(source + suffix)) copyFileSync(source + suffix, target + suffix);
    }
  }
  return { path: target, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const SLOT_SQL =
  'SELECT slot, schema_version, app_version, written_at, write_count, checksum, payload FROM save_slots WHERE slot = ?';

/**
 * Inspects a staged database. Returns { lines, problems } where each problem is
 * { rule, message, fix }. `decode(record)` (optional) is the app's own decodeSlot.
 */
export function inspectDatabase(DatabaseSync, path, options = {}) {
  const db = new DatabaseSync(path);
  const lines = [];
  const problems = [];
  const add = (rule, message, fix) => problems.push({ rule, message, fix });
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    if (!tables.has('save_slots')) {
      add('no-save-table', 'save.db has no save_slots table', 'The app never ran its first save (or this is not a Pocket Arcade save.db).');
      return { lines, problems };
    }
    const mode = db.prepare('PRAGMA journal_mode').get()?.journal_mode;
    lines.push(`journal_mode: ${mode}`);
    if (mode !== 'wal') add('journal-mode', `journal_mode is ${mode}, not wal`, 'Run SAVE_DB_PRAGMAS (journal_mode = WAL; synchronous = FULL) on every open.');
    for (const slot of ['current', 'backup']) inspectSlot(db, slot, options, { lines, add });
    const quarantined = tables.has('save_quarantine') ? Number(db.prepare('SELECT COUNT(*) AS n FROM save_quarantine').get().n) : 0;
    lines.push(`quarantine rows: ${quarantined}`);
    if (quarantined > 0 && !options.allowQuarantine) {
      add('quarantine', `save_quarantine holds ${quarantined} row(s): a load found a damaged slot`, 'Read the rows (reason column), find the write that broke the document, fix it; after a kill test this must be 0.');
    }
  } finally {
    db.close();
  }
  return { lines, problems };
}

function inspectSlot(db, slot, options, { lines, add }) {
  const row = db.prepare(SLOT_SQL).get(slot);
  if (row === undefined) {
    lines.push(`${slot}: missing`);
    add('slot-missing', `the ${slot} slot is missing`, 'Every load writes both slots (write-both); a missing slot means boot never finished its first write.');
    return;
  }
  const payload = String(row.payload);
  const facts = [`schema=${row.schema_version}`, `writeCount=${row.write_count}`, `bytes=${payload.length}`, `app=${row.app_version}`];
  let status = 'ok';
  if (fnv1a32(payload) !== row.checksum) {
    status = 'damaged';
    add('checksum', `${slot}: checksum ${row.checksum} does not match the payload (${fnv1a32(payload)})`, 'The row was changed outside encodeSaveDoc or the file rotted; the app will restore the other slot and quarantine this one.');
  }
  let doc;
  try {
    doc = JSON.parse(payload);
  } catch {
    status = 'damaged';
    add('json', `${slot}: the payload is not valid JSON`, 'Only encodeSaveDoc (JSON.stringify of a validated document) may write payloads.');
  }
  if (doc !== undefined) checkDocument(slot, row, doc, options, add);
  if (doc !== undefined && options.decode) {
    const decoded = options.decode({ schemaVersion: row.schema_version, appVersion: row.app_version, writtenAtMs: row.written_at, writeCount: row.write_count, checksum: row.checksum, payload });
    facts.push(`decode=${decoded.kind}`);
    if (decoded.kind !== 'ok') {
      status = 'damaged';
      add('decode', `${slot}: the app's decodeSlot says ${decoded.kind}${decoded.reason ? ` (${decoded.reason})` : ''}`, 'Fix the writer or the migration that produced this document; run the save tests.');
    }
  }
  lines.push(`${slot}: ${status} ${facts.join(' ')}`);
}

function checkDocument(slot, row, doc, options, add) {
  if (doc?.schemaVersion !== row.schema_version) {
    add('schema-version', `${slot}: payload schemaVersion ${doc?.schemaVersion} differs from the row's schema_version ${row.schema_version}`, 'encodeSaveDoc copies doc.schemaVersion into the row; never write the row by hand.');
  }
  if (options.maxVersion !== undefined && row.schema_version > options.maxVersion) {
    add('newer-version', `${slot}: schema_version ${row.schema_version} is newer than ${options.maxVersion}`, 'An older app must open this read-only and never write it.');
  }
  if (options.gameId !== undefined && doc?.gameId !== options.gameId) {
    add('game-id', `${slot}: gameId is ${JSON.stringify(doc?.gameId)}, expected ${JSON.stringify(options.gameId)}`, 'This save belongs to another game; the app treats it as damaged.');
  }
}
