// packages/shell/src/app/read-variant.ts
/** Reads the variant. */
export function readVariant(): string | undefined {
  return process.env.APP_VARIANT ?? process.env['EXPO_PUBLIC_APP_VARIANT'];
}
