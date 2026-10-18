// packages/shell/src/config/audio-config.ts
// Node world (read by app.config.ts through withShell): the sound part of the Expo config.
// withShell's plugin list includes AUDIO_API_PLUGIN for every app.
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/**
 * react-native-audio-api 0.13.6: override every default that adds background audio, Android
 * permissions or downloads. After prebuild, Info.plist has no UIBackgroundModes audio and no
 * NSMicrophoneUsageDescription, and the Podfile has both DISABLE_AUDIOAPI_* lines.
 */
export const AUDIO_API_PLUGIN: PluginEntry = [
  'react-native-audio-api',
  {
    iosBackgroundMode: false,
    androidPermissions: [],
    androidForegroundService: false,
    disableFFmpeg: true,
    disableStaticExternalLibs: true,
  },
];
