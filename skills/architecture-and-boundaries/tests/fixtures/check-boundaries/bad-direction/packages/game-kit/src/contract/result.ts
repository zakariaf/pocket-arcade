// packages/game-kit/src/contract/result.ts
/** Outcome of an operation that can fail in an expected way. */
export type Result<TValue, TError> = { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

/** Wraps a success value. */
export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}
