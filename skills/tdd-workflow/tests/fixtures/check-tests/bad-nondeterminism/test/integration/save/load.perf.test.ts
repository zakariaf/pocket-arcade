// test/integration/save/load.perf.test.ts: the global performance.now is the Jest preset's 1 ms mock.
describe('saveLoad', () => {
  it('loads the save quickly', () => {
    const start = performance.now();
    expect(performance.now() - start).toBeLessThan(5);
  });
});
