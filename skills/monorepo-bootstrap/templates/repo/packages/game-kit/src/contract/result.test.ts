// packages/game-kit/src/contract/result.test.ts
import { err, ok, type Result } from './result.ts';

type ParseError = { readonly kind: 'not-a-number'; readonly input: string };

function parseCount(input: string): Result<number, ParseError> {
  const value = Number.parseInt(input, 10);
  return Number.isNaN(value) ? err({ kind: 'not-a-number', input }) : ok(value);
}

describe('Result', () => {
  it('wraps a success value', () => {
    expect(parseCount('12')).toStrictEqual({ ok: true, value: 12 });
  });

  it('wraps an expected failure as a kind-tagged value', () => {
    expect(parseCount('twelve')).toStrictEqual({
      ok: false,
      error: { kind: 'not-a-number', input: 'twelve' },
    });
  });
});
