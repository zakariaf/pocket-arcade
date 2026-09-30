// packages/shell/src/config/app-variant.ts
export const APP_VARIANTS = ['test', 'store'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];
/** Reads the build variant; Node code may use bracket access and any variable. */
export function readVariant(env: Readonly<Record<string, string | undefined>>): string {
  return env['APP_VARIANT'] ?? process.env['ADS_MODE'] ?? 'test';
}
