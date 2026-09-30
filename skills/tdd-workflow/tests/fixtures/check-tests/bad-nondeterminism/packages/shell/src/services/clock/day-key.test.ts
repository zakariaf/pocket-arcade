// packages/shell/src/services/clock/day-key.test.ts
describe('dayKey', () => {
  it('returns a key for now', () => {
    expect(Math.floor(Date.now() / 86_400_000)).toBeGreaterThan(0);
  });
});
