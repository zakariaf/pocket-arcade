// packages/shell/plugins/with-upload-signing.ts
import { withAppBuildGradle } from 'expo/config-plugins.js';

import { addUploadSigning } from '@e07/shell/config/upload-signing.ts';

import type { ConfigPlugin } from 'expo/config-plugins.js';

type Options = { readonly game: string };

/** Signs Android release builds with the game's upload key when its Gradle properties exist. */
const withUploadSigning: ConfigPlugin<Options> = (config, { game }) =>
  withAppBuildGradle(config, (next) => ({
    ...next,
    modResults: { ...next.modResults, contents: addUploadSigning(next.modResults.contents, game) },
  }));

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withUploadSigning;
