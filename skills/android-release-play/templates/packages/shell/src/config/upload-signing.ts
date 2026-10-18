// packages/shell/src/config/upload-signing.ts
// The release signing config of the generated app/build.gradle (Play App Signing's upload key).
// React Native's template signs release builds with the debug key; this adds a signing config
// `upload` that reads the game's own Gradle properties (E07_<GAME>_UPLOAD_*, which the owner's
// ~/.gradle/gradle.properties holds) and uses it for release builds when they exist. Without them
// (an emulator build, a keyless rehearsal) the release stays on the debug key, and the store-AAB
// gate refuses such a bundle. The key and its passwords are only ever read by Gradle.

/**
 * E07_<GAME>_UPLOAD_ (line-siege -> E07_LINE_SIEGE_UPLOAD_): the one prefix of the game's upload-key
 * Gradle properties, which release:android's aab-signing.ts names too.
 */
export function uploadPropertyPrefixOf(game: string): string {
  return `E07_${game.toUpperCase().replaceAll('-', '_')}_UPLOAD_`;
}

function uploadConfigOf(prefix: string): string {
  const property = (name: string): string => `project.property('${prefix}${name}')`;
  return [
    '        upload {',
    `            if (project.hasProperty('${prefix}STORE_FILE')) {`,
    `                storeFile file(${property('STORE_FILE')})`,
    `                storePassword ${property('STORE_PASSWORD')}`,
    `                keyAlias ${property('KEY_ALIAS')}`,
    `                keyPassword ${property('KEY_PASSWORD')}`,
    '            }',
    '        }',
  ].join('\n');
}

const SIGNING_BLOCK = /^(\s*)signingConfigs \{\n/m;
// React Native's template keeps two comment lines above the release signing line; any number of
// them may sit between `release {` and the line, and they are kept.
const RELEASE_SIGNING =
  /(\n\s*release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug\n/;

/** app/build.gradle with the upload signing config added; unchanged when it is already there. */
export function addUploadSigning(gradle: string, game: string): string {
  if (gradle.includes('signingConfigs.upload')) return gradle;
  const prefix = uploadPropertyPrefixOf(game);
  if (!SIGNING_BLOCK.test(gradle)) {
    throw new Error(
      'app/build.gradle has no signingConfigs block: React Native changed its template',
    );
  }
  if (!RELEASE_SIGNING.test(gradle)) {
    throw new Error(
      'app/build.gradle has no release signingConfig line: React Native changed its template',
    );
  }
  return gradle
    .replace(SIGNING_BLOCK, (block) => `${block}${uploadConfigOf(prefix)}\n`)
    .replace(
      RELEASE_SIGNING,
      (_line, head: string) =>
        `${head}signingConfig project.hasProperty('${prefix}STORE_FILE') ? signingConfigs.upload : signingConfigs.debug\n`,
    );
}
