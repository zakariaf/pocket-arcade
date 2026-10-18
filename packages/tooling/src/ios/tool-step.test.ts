// packages/tooling/src/ios/tool-step.test.ts
// Runs real node processes in a temporary apps/<game> folder.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runStepOrThrow, runToolStep, STEP_TAIL_BYTES, tailOf } from './tool-step.ts';

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

  it('names a command that could not start, in its output and its log', () => {
    const missing = join(appDir, 'no-such-tool');
    const result = runToolStep(
      'missing',
      { file: missing, args: [] },
      { appDir, env: process.env },
    );
    expect(result.status).toBeNull();
    expect(result.output).toBe(`${missing} did not start: spawnSync ${missing} ENOENT\n`);
    expect(readFileSync(result.logFile, 'utf8')).toBe(result.output);
  });

  it('writes the log while the step runs, so a long step can be followed', () => {
    const log = join(appDir, 'build', 'logs', 'archive.log');
    const script = `process.stdout.write('compiling\\n'); let seen = false; try { seen = require('node:fs').readFileSync(${JSON.stringify(log)}, 'utf8').includes('compiling'); } catch {} process.stdout.write('seen ' + String(seen))`;
    const result = runToolStep(
      'archive',
      { file: process.execPath, args: ['-e', script] },
      { appDir, env: process.env },
    );
    expect(result.stdout).toBe('compiling\nseen true');
  });

  it('logs a long output whole and hands back only its tail', () => {
    // 3 MiB of build output: more than a pipe buffer holds, and more than a message needs.
    const script =
      "const line = 'x'.repeat(1023) + '\\n'; for (let i = 0; i < 3072; i += 1) process.stdout.write(line); process.stdout.write('** ARCHIVE FAILED **\\n'); process.exit(65)";
    const result = runToolStep(
      'archive',
      { file: process.execPath, args: ['-e', script] },
      { appDir, env: process.env },
    );
    expect(readFileSync(result.logFile, 'utf8')).toHaveLength(3072 * 1024 + 21);
    expect(result.output.length).toBeLessThanOrEqual(STEP_TAIL_BYTES);
    expect(tailOf(result.output, 1)).toBe('** ARCHIVE FAILED **');
    expect(result.stdout).toBe(result.output);
  });
});

describe('runStepOrThrow', () => {
  let appDir = '';
  beforeEach(() => {
    appDir = join(mkdtempSync(join(tmpdir(), 'tool-step-')), 'apps', 'line-siege');
    mkdirSync(appDir, { recursive: true });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(join(appDir, '..', '..'), { recursive: true, force: true });
  });

  it('names the CLI and the step it starts, and returns when the step passes', () => {
    const command = { file: process.execPath, args: ['-e', "process.stdout.write('ok')"] };
    runStepOrThrow('build:ios:sim', { name: 'prebuild', ...command }, { appDir, env: process.env });
    expect(jest.mocked(console.log).mock.calls).toStrictEqual([['build:ios:sim: prebuild ...']]);
  });

  it("throws with the step's exit status, its log and the last 30 lines of its output", () => {
    const script =
      "for (let i = 1; i <= 40; i += 1) console.log('line ' + String(i)); process.exit(65)";
    const command = { file: process.execPath, args: ['-e', script] };
    const log = join(appDir, 'build', 'logs', 'gradle.log');
    const tail = Array.from({ length: 30 }, (_, index) => `line ${String(index + 11)}`).join('\n');
    expect(() => {
      runStepOrThrow(
        'build:android:emu',
        { name: 'gradle', ...command },
        { appDir, env: process.env },
      );
    }).toThrow(`step "gradle" failed (exit 65), see ${log}:\n${tail}`);
  });
});

describe('tailOf', () => {
  it("keeps the last lines of a step's output", () => {
    expect(tailOf('one\ntwo\nthree\n', 2)).toBe('two\nthree');
  });
});
