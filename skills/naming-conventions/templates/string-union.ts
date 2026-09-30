// __FILE_PATH__
// A closed set of names: the values exist at runtime (an `as const` array, UPPER_CASE) and the
// type is derived from them (PascalCase), so the two never drift. Replaces an enum.

/** __SUMMARY__ */
export const __VALUES_CONSTANT__ = [__VALUES__] as const;

/** One of __VALUES_CONSTANT__. */
export type __UNION_TYPE__ = (typeof __VALUES_CONSTANT__)[number];

/** Narrows unknown input (a save field, a deep-link parameter) to __UNION_TYPE__. */
export function is__UNION_TYPE__(value: unknown): value is __UNION_TYPE__ {
  return __VALUES_CONSTANT__.some((item) => item === value);
}
