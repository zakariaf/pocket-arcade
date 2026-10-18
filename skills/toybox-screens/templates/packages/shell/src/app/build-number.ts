// packages/shell/src/app/build-number.ts
// The native build number of this build: withShell writes one number as ios.buildNumber and
// android.versionCode, and each platform reads its own. Pure, and free of the test-only gate, so the
// version line (read-version-text.ts) and the test-only perf report's header share it without an
// import loop through app/test-only.ts.

/** The part of the embedded app config (Constants.expoConfig) that carries the build number. */
export type NativeBuildConfig = {
  readonly ios?: { readonly buildNumber?: string };
  readonly android?: { readonly versionCode?: number };
};

/** iOS's buildNumber, or Android's versionCode on Android; undefined when the config lacks it. */
export function buildNumberOf(
  config: NativeBuildConfig | null | undefined,
  os: string,
): string | undefined {
  if (os !== 'android') return config?.ios?.buildNumber;
  const versionCode = config?.android?.versionCode;
  return versionCode === undefined ? undefined : String(versionCode);
}
