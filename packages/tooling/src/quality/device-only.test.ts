// packages/tooling/src/quality/device-only.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { deviceOnlyCoveragePatterns, deviceOnlyFiles, hasDeviceOnlyMarker } from './device-only.ts';

const MARKED =
  '// packages/shell/src/app/start-shell.ts\n// device-only: covered by the simulator smoke test\nexport {};\n';

describe('hasDeviceOnlyMarker', () => {
  it('accepts a marker that names the covering check', () => {
    expect(hasDeviceOnlyMarker(MARKED)).toBe(true);
  });

  it('rejects a marker without a reason', () => {
    expect(hasDeviceOnlyMarker('// device-only: yes\nexport {};\n')).toBe(false);
  });

  it('rejects a marker below the first six lines', () => {
    expect(hasDeviceOnlyMarker(`${'\n'.repeat(6)}${MARKED}`)).toBe(false);
  });

  it('rejects a file without the marker', () => {
    expect(hasDeviceOnlyMarker('export const x = 1;\n')).toBe(false);
  });
});

describe('deviceOnlyFiles', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'device-only-'));
  const write = (file: string, text: string): void => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };

  beforeAll(() => {
    write('packages/shell/src/app/start-shell.ts', MARKED);
    write('packages/shell/src/app/shell-app.tsx', MARKED);
    write('packages/shell/src/app/plain.ts', 'export const plain = 1;\n');
    write('packages/shell/src/app/start-shell.test.ts', MARKED);
    write('apps/line-siege/src/board/draw.ts', MARKED);
    // A skill template inside the repo is not app code (the path is built from parts: the skill
    // library's own checks read a literal skills-folder path as a reference to another skill).
    write(['skills', 'demo', 'templates', 'packages', 'shell', 'src', 'x.ts'].join('/'), MARKED);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists only marked source files under apps and packages', () => {
    expect(deviceOnlyFiles(root)).toStrictEqual([
      'apps/line-siege/src/board/draw.ts',
      'packages/shell/src/app/shell-app.tsx',
      'packages/shell/src/app/start-shell.ts',
    ]);
  });

  it('turns each file into one exact coverage ignore pattern', () => {
    const patterns = deviceOnlyCoveragePatterns(root);
    expect(patterns[0]).toBe('<rootDir>/apps/line-siege/src/board/draw\\.ts$');
    const [, shellApp = ''] = patterns;
    expect(
      new RegExp(shellApp.replace('<rootDir>', root)).test(
        `${root}/packages/shell/src/app/shell-app.tsx`,
      ),
    ).toBe(true);
    expect(
      new RegExp(shellApp.replace('<rootDir>', root)).test(
        `${root}/packages/shell/src/app/shell-appXtsx`,
      ),
    ).toBe(false);
  });
});
