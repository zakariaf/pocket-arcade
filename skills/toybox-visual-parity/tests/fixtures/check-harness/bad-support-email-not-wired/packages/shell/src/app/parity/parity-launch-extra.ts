// packages/shell/src/app/parity/parity-launch-extra.ts
// Test builds only (read-parity-request.ts reads it, reached through test-only.ts). Android has no
// launch arguments in NSUserDefaults: capture-app.mjs --platform android starts the activity with
// "am start ... --es parity <query>", and the Shell's native module ParityLaunch
// (packages/shell/android/src/main/java/io/applander/shell/ParityLaunchModule.kt) hands back that
// string extra of the launch intent. Nothing outside app/parity/ asks for the module.
import { requireOptionalNativeModule } from 'expo';

export type ParityLaunchModule = { readonly getLaunchExtra: (key: string) => string | null };

/** The shape read-parity-request.ts reads launch values through (React Native Settings on iOS). */
export type SettingsReader = { readonly get: (key: string) => unknown };

/** A reader over the module's extras; without the module (Jest, a build without it) every value is null. */
export function launchExtrasReader(module: ParityLaunchModule | null): SettingsReader {
  return { get: (key) => module?.getLaunchExtra(key) ?? null };
}

/** This launch's intent extras, through the Shell's ParityLaunch module. */
export function androidLaunchExtras(): SettingsReader {
  return launchExtrasReader(requireOptionalNativeModule<ParityLaunchModule>('ParityLaunch'));
}
