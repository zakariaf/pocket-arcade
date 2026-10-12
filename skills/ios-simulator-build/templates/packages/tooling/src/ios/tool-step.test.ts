// packages/tooling/src/ios/tool-step.test.ts
// Runs real node processes in a temporary apps/<game> folder.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runToolStep, tailOf } from './tool-step.ts';

describe('runToolStep', () => {
  let appDir = '';
  beforeEach(() => {
    appDir = join(mkdtempSync(join(tmpdir(), 'tool-step-')), 'apps', 'line-siege');
    mkdirSync(appDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(join(appDir, '..', '..'), { recursive: true, force: true });
  });

  it("logs a step's output to build/logs/<step>.log and returns its stdout and status", () => {
    const script = "process.stdout.write('out ' + process.cwd()); process.stderr.write(' err')";
    const result = runToolStep(
      'probe',
      { file: process.execPath, args: ['-e', script] },
      { appDir, env: process.env },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^out .*apps\/line-siege$/);
    expect(result.logFile).toBe(join(appDir, 'build', 'logs', 'probe.log'));
    expect(readFileSync(result.logFile, 'utf8')).toBe(`${result.stdout} err`);
  });

  it("returns a failing step's status and output for the caller to judge", () => {
    const script = "console.error('error: no signing team'); process.exit(65)";
    const result = runToolStep(
      'archive',
      { file: process.execPath, args: ['-e', script], atRoot: true },
      { appDir, env: process.env },
    );
    expect([result.status, result.output]).toStrictEqual([65, 'error: no signing team\n']);
  });
});

describe('tailOf', () => {
  it("keeps the last lines of a step's output", () => {
    expect(tailOf('one\ntwo\nthree\n', 2)).toBe('two\nthree');
  });
});
