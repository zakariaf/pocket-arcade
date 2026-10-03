// packages/shell/src/app/perf/cold-start.test.ts
import { markHomeInteractive, markJsEntry } from './cold-start.ts';

describe('cold-start marks', () => {
  it('reports native, JS and total time once per process', () => {
    markJsEntry(10_500);

    expect(markHomeInteractive(10_900, 10_000)).toStrictEqual({
      nativeMs: 500,
      jsMs: 400,
      totalMs: 900,
    });
    expect(markHomeInteractive(20_000, 10_000)).toBeNull();
  });
});
