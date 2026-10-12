// packages/tooling/src/android/toolchain.ts (excerpt)
// Planted: the Play Store image that this Mac happens to have; adb root fails on it.
export const ANDROID_PINS = {
  systemImage: 'system-images;android-35;google_apis_playstore;arm64-v8a',
  ndk: '27.1.12297006',
} as const;
