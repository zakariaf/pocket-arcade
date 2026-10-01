// tracking-text.mjs: the App Tracking Transparency text a built app must carry (a helper, not an
// entry point). Shared by ios-simulator-build (check-sim-app), ios-release-testflight
// (check-store-artifact) and privacy-and-network-audit (audit-app-bundle).
//
// Owner decision O1 (2026-09-30): the app asks for tracking permission (Apple guideline 5.1.2(i))
// after Google's consent form, through expo-tracking-transparency. Apple: "This key is required.
// Your app crashes if it attempts to use the framework without including the key"
// (NSUserTrackingUsageDescription). The Shell sets it through the plugin's userTrackingPermission
// (the en text) and withShell's locales.<lang>.ios.NSUserTrackingUsageDescription for en, de, fa
// and ckb, which prebuild writes into <lang>.lproj/InfoPlist.strings. A built app keeps those as
// binary plists; a hand-written one may be XML or the old "key" = "value"; text form.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ATT_KEY = 'NSUserTrackingUsageDescription';
export const ATT_LANGUAGES = Object.freeze(['en', 'de', 'fa', 'ckb']);

/** The value of `key` in a .strings file (binary or XML plist, or "key" = "value"; text), or null. */
export function stringsValue(path, key, readPlist) {
  if (!existsSync(path)) return null;
  const buffer = readFileSync(path);
  const head = buffer.subarray(0, 8).toString('latin1');
  if (head === 'bplist00' || head.startsWith('<?xml')) {
    const value = readPlist(path)?.[key];
    return typeof value === 'string' ? value : null;
  }
  const isUtf16 = (buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff);
  const text = buffer.toString(isUtf16 ? 'utf16le' : 'utf8');
  const match = new RegExp(`"?${key}"?\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*;`).exec(text);
  return match ? match[1] : null;
}

/**
 * Where the tracking text is missing: Info.plist (every build) and each app language's
 * InfoPlist.strings. Returns [{ file, message }] with file relative to the .app.
 */
export function trackingTextProblems(appDir, info, readPlist) {
  const problems = [];
  const text = info?.[ATT_KEY];
  if (typeof text !== 'string' || text.trim() === '') problems.push({ file: 'Info.plist', message: `${ATT_KEY} is missing or empty, so the tracking prompt would crash the app` });
  for (const lang of ATT_LANGUAGES) {
    const file = `${lang}.lproj/InfoPlist.strings`;
    const path = join(appDir, file);
    const value = stringsValue(path, ATT_KEY, readPlist);
    if (value === null || value.trim() === '') problems.push({ file, message: existsSync(path) ? `has no ${ATT_KEY} (the ${lang} tracking prompt text)` : `is missing, so there is no ${lang} tracking prompt text (${ATT_KEY})` });
  }
  return problems;
}
