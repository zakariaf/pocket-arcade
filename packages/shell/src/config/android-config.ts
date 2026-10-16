// packages/shell/src/config/android-config.ts
// Node world (read by app.config.ts through withShell): the Android part of the Expo config.
// withShell sets `android: androidConfig(game)` and appends `...androidPlugins(game)` to its one
// plugin list. Every Android native setting comes from here, shell-plugins.ts or a plugin in
// packages/shell/plugins/; the generated apps/<id>/android/ is never edited or committed.
import type { GameConfig } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/**
 * The permissions the Shell asks for itself. The SDKs add their own (AdMob, Play Billing,
 * WorkManager); every permission of a built APK must be on android-emulator-build's allowlist.
 */
export const ANDROID_PERMISSIONS: readonly string[] = [
  // admob-ads and premium-purchase: the only network users (spec N3).
  'android.permission.INTERNET',
  // game-audio-and-haptics: the vibration setting.
  'android.permission.VIBRATE',
];

/**
 * Removed from the merged manifest whoever adds them (tools:node="remove"): the Expo template's
 * optional extras and the permissions no Pocket Arcade app may hold (no microphone, camera,
 * location, media, contacts, notifications or Wi-Fi details; spec N3).
 */
export const BLOCKED_ANDROID_PERMISSIONS: readonly string[] = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.CAMERA',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_CONTACTS',
  'android.permission.POST_NOTIFICATIONS',
  // expo-network declares it for getIpAddressAsync only; the connectivity adapter reads
  // getNetworkStateAsync and its listener (ACCESS_NETWORK_STATE), never the Wi-Fi details.
  'android.permission.ACCESS_WIFI_STATE',
];

/** The `android` block: the shared build number is the versionCode (one sequence for both stores). */
export function androidConfig(game: GameConfig): NonNullable<ExpoConfig['android']> {
  return {
    package: game.bundleId,
    versionCode: game.buildNumber,
    // save-persistence-and-migrations: the save follows the player through Google's device backup
    // (spec 8.6, D5); with-backup-rules.ts limits the backup to SQLite/save.db and its WAL pair.
    allowBackup: true,
    permissions: [...ANDROID_PERMISSIONS],
    blockedPermissions: [...BLOCKED_ANDROID_PERMISSIONS],
    // toybox-design-system: light and dark follow the phone (needs expo-system-ui in every app).
    userInterfaceStyle: 'automatic',
  };
}

/** The Android plugins, loaded by Expo from their paths (Node world, packages/shell/plugins/). */
export function androidPlugins(game: GameConfig): PluginEntry[] {
  return [
    // architecture-and-boundaries: the backup rules files and their manifest attributes (D5).
    '@e07/shell/plugins/with-backup-rules.ts',
    // architecture-and-boundaries: android:supportsRtl for fa and ckb (rtl-and-direction).
    '@e07/shell/plugins/with-rtl-support.ts',
    // android-release-play: release builds signed with the game's upload key when its Gradle
    // properties exist; without this line every Play bundle stays debug-signed.
    ['@e07/shell/plugins/with-upload-signing.ts', { game: game.id }],
  ];
}
