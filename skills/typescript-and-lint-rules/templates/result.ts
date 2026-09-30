// packages/game-kit/src/contract/result.ts

/** Outcome of an operation that can fail in an expected, recoverable way. */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

/** Wraps a success value. */
export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

/** Wraps an expected failure. `error` is a `kind`-discriminated union, never a string. */
export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
