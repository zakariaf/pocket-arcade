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
