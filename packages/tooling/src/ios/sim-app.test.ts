// packages/tooling/src/ios/sim-app.test.ts
// Reads a real Info.plist with plutil and a real save.db with sqlite3 (both ship with macOS).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  readBundleId,
  readExecutableName,
  readPerfLogPayload,
  readUrlScheme,
  saveDatabaseOf,
} from './sim-app.ts';

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>io.applander.linesiege</string>
<key>CFBundleExecutable</key><string>LineSiege</string>
<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>e07-line-siege</string></array></dict></array>
</dict></plist>
`;

describe('a built app and its data', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sim-app-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the bundle id, the URL scheme and the executable from Info.plist', () => {
    const app = join(dir, 'LineSiege.app');
    mkdirSync(app);
    writeFileSync(join(app, 'Info.plist'), INFO_PLIST);
    expect([readBundleId(app), readUrlScheme(app), readExecutableName(app)]).toStrictEqual([
      'io.applander.linesiege',
      'e07-line-siege',
      'LineSiege',
    ]);
  });

  it("reads the perf log's payload from the data container's save.db, or null without one", () => {
    const database = saveDatabaseOf(dir);
    expect(database).toBe(join(dir, 'Documents', 'SQLite', 'save.db'));
    expect(readPerfLogPayload(database)).toBeNull();
    mkdirSync(join(dir, 'Documents', 'SQLite'), { recursive: true });
    execFileSync('sqlite3', [database, 'CREATE TABLE saves (id INTEGER)']);
    expect(readPerfLogPayload(database)).toBeNull();
    const payload = '[{"kind":"cold-start","atEpochMs":5}]';
    const sql = `CREATE TABLE perf_log (id INTEGER PRIMARY KEY, payload TEXT); INSERT INTO perf_log VALUES (1, '${payload}')`;
    execFileSync('sqlite3', [database, sql]);
    expect(readPerfLogPayload(database)?.trim()).toBe(payload);
  });
});
