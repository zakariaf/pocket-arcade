// packages/tooling/src/android/toolchain.ts (excerpt)
// The pinned google_apis image: adb root works there, which the kill test needs.
export const ANDROID_PINS = {
  systemImage: 'system-images;android-35;google_apis;arm64-v8a',
  ndk: '27.1.12297006',
} as const;
