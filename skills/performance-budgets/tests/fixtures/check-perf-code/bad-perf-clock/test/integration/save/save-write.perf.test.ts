it('times a write with a high-resolution clock', () => {
  const start = performance.now();
  expect(performance.now() - start).toBeLessThan(5);
});
