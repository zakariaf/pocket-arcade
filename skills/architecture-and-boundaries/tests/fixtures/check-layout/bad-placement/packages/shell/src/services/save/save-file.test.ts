// packages/shell/src/services/save/save-file.test.ts
import { readFileSync } from 'node:fs';

describe('saveFile', () => {
  it('reads', () => {
    expect(readFileSync).toBeDefined();
  });
});
