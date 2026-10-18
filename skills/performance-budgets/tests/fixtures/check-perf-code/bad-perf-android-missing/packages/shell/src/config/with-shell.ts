// packages/shell/src/config/with-shell.ts (excerpt): the iOS part of the Expo config withShell writes.
export const IOS_INFO_PLIST = {
  ITSAppUsesNonExemptEncryption: false,
  // 120 Hz on ProMotion phones: without it iOS caps third-party apps at 60 fps.
  CADisableMinimumFrameDurationOnPhone: true,
} as const;
