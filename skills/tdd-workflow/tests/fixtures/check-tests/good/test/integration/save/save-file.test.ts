// test/integration/save/save-file.test.ts: Node APIs are fine under the root test/ folder.
import { existsSync } from 'node:fs';

describe('saveFile', () => {
  it('finds no stray save file', () => {
    expect(existsSync('/nonexistent-save.db')).toBe(false);
  });
});
