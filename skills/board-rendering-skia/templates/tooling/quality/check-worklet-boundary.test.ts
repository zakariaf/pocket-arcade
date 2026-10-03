// packages/tooling/src/quality/check-worklet-boundary.test.ts
import { checkFile, checkRepo } from './check-worklet-boundary.ts';

const FILES: Readonly<Record<string, string>> = {
  'packages/game-kit/src/geom/a.ts':
    "'worklet';\nimport { b } from './b.ts';\nimport type { C } from './c.ts';\n",
  'packages/game-kit/src/geom/b.ts': "'worklet';\nexport const b = 1;\n",
  'packages/game-kit/src/geom/c.ts': 'export type C = number;\n',
  'packages/game-kit/src/geom/bad.ts': "'worklet';\nimport { c } from './c.ts';\n",
};
const read = (path: string): string => FILES[path] ?? '';

describe('worklet boundary', () => {
  it('allows value imports between UI-thread modules and type imports from anywhere', () => {
    expect(checkFile('packages/game-kit/src/geom/a.ts', read)).toStrictEqual([]);
  });

  it('flags a UI-thread module importing a value from a JS-only module', () => {
    expect(checkFile('packages/game-kit/src/geom/bad.ts', read)).toHaveLength(1);
  });

  it.each([
    'board-scene',
    'board-clock-state',
    'run-board-frame',
    'record-board',
    'describe-error',
    'draw-centered-text',
  ])('requires the file-level directive in the Shell board module %s.ts', (name) => {
    const file = `packages/shell/src/game-host/${name}.ts`;
    expect(checkFile(file, () => 'export const frame = 1;\n')).toStrictEqual([
      { file, problem: "missing file-level 'worklet'; directive" },
    ]);
  });

  it('finds no violations in this repository', () => {
    expect(checkRepo()).toStrictEqual([]);
  });
});
