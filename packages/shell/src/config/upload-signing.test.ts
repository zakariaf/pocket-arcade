// packages/shell/src/config/upload-signing.test.ts
import { addUploadSigning } from './upload-signing.ts';

/** The signing part of the app/build.gradle that React Native 0.86's template writes. */
const TEMPLATE = [
  'android {',
  '    signingConfigs {',
  '        debug {',
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  '        }',
  '    }',
  '    buildTypes {',
  '        debug {',
  '            signingConfig signingConfigs.debug',
  '        }',
  '        release {',
  '            signingConfig signingConfigs.debug',
  '            minifyEnabled enableMinifyInReleaseBuilds',
  '        }',
  '    }',
  '}',
  '',
].join('\n');

describe('addUploadSigning', () => {
  it("signs release builds with the game's upload key when its Gradle properties exist", () => {
    const gradle = addUploadSigning(TEMPLATE, 'line-siege');
    expect(gradle).toContain(
      "        upload {\n            if (project.hasProperty('E07_LINE_SIEGE_UPLOAD_STORE_FILE')) {\n" +
        "                storeFile file(project.property('E07_LINE_SIEGE_UPLOAD_STORE_FILE'))\n" +
        "                storePassword project.property('E07_LINE_SIEGE_UPLOAD_STORE_PASSWORD')\n" +
        "                keyAlias project.property('E07_LINE_SIEGE_UPLOAD_KEY_ALIAS')\n" +
        "                keyPassword project.property('E07_LINE_SIEGE_UPLOAD_KEY_PASSWORD')\n",
    );
    expect(gradle).toContain(
      "        release {\n            signingConfig project.hasProperty('E07_LINE_SIEGE_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug\n",
    );
  });

  it("signs the release block of React Native 0.86's template, with its comment lines kept", () => {
    // The generated app/build.gradle has two comment lines above the release signing line.
    const comments =
      '            // Caution! In production, you need to generate your own keystore file.\n' +
      '            // see the signed APK page of the React Native docs.\n';
    const generated = TEMPLATE.replace('        release {\n', `        release {\n${comments}`);
    expect(addUploadSigning(generated, 'line-siege')).toContain(
      `        release {\n${comments}            signingConfig project.hasProperty('E07_LINE_SIEGE_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug\n`,
    );
  });

  it('keeps debug builds on the debug key', () => {
    expect(addUploadSigning(TEMPLATE, 'line-siege')).toContain(
      '        debug {\n            signingConfig signingConfigs.debug\n        }',
    );
  });

  it('changes nothing the second time', () => {
    const once = addUploadSigning(TEMPLATE, 'line-siege');
    expect(addUploadSigning(once, 'line-siege')).toBe(once);
  });

  it('fails loudly when the template no longer has the release signing line', () => {
    expect(() => addUploadSigning('android {\n}\n', 'line-siege')).toThrow(
      'app/build.gradle has no signingConfigs block',
    );
  });
});
