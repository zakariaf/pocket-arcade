// packages/tooling/src/quality/gate-diff.ts

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diffArray(expected: readonly Json[], actual: unknown, where: string): readonly string[] {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    return [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
  }
  return expected.flatMap((item, index) =>
    diffSubset(item, actual[index], `${where}[${String(index)}]`),
  );
}

/**
 * Lists every place where `actual` differs from `expected`. Objects are compared key by key
 * (keys only in `actual`, such as defaults filled in by a tool, are allowed); arrays must have
 * the same length and matching items; primitives must be equal.
 */
export function diffSubset(expected: Json, actual: unknown, where: string): readonly string[] {
  if (Array.isArray(expected)) {
    return diffArray(expected, actual, where);
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return [`${where}: expected an object, got ${JSON.stringify(actual)}`];
    }
    return Object.entries(expected).flatMap(([key, value]) =>
      diffSubset(value, actual[key], `${where}.${key}`),
    );
  }
  return expected === actual
    ? []
    : [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}
