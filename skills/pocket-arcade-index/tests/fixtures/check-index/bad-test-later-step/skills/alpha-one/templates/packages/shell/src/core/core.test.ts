// packages/shell/src/core/core.test.ts
import { coreStore } from './core.ts';

describe('coreStore', () => {
  it('starts at two', () => {
    expect(coreStore.getState().value).toBe(2);
  });
});
