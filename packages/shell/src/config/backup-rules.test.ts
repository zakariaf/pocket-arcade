// packages/shell/src/config/backup-rules.test.ts
import {
  applyBackupRules,
  BACKUP_RULES_FILES,
  DATA_EXTRACTION_RULES_XML,
  FULL_BACKUP_CONTENT_XML,
  SAVE_FILES,
} from './backup-rules.ts';

import type { AndroidManifest } from './backup-rules.ts';

// The android XML namespace, without spelling out its URL in app code (N3 lint).
const ANDROID_NAMESPACE = 'android-namespace';

function manifestWith(attributes: Record<string, string>): AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': ANDROID_NAMESPACE },
      queries: [],
      application: [{ $: { 'android:name': '.MainApplication', ...attributes } }],
    },
  };
}

const INCLUDES = [
  '<include domain="file" path="SQLite/save.db"/>',
  '<include domain="file" path="SQLite/save.db-wal"/>',
  '<include domain="file" path="SQLite/save.db-shm"/>',
];

describe('backup rules', () => {
  it("keeps the save in the phone's own device backup (spec 8.6, decision D5)", () => {
    expect(SAVE_FILES).toStrictEqual([
      'SQLite/save.db',
      'SQLite/save.db-wal',
      'SQLite/save.db-shm',
    ]);
    for (const include of INCLUDES) {
      expect(FULL_BACKUP_CONTENT_XML).toContain(include);
      expect(DATA_EXTRACTION_RULES_XML.split(include)).toHaveLength(3);
    }
  });

  it('writes the Android 11 rules exactly, with nothing but the save included', () => {
    expect(FULL_BACKUP_CONTENT_XML).toBe(
      [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<full-backup-content>',
        '  <include domain="file" path="SQLite/save.db"/>',
        '  <include domain="file" path="SQLite/save.db-wal"/>',
        '  <include domain="file" path="SQLite/save.db-shm"/>',
        '</full-backup-content>',
        '',
      ].join('\n'),
    );
  });

  it('gives Android 12 and later the same files for the cloud backup and a device transfer', () => {
    expect(DATA_EXTRACTION_RULES_XML).toMatch(
      /<data-extraction-rules>\n {2}<cloud-backup>\n(.+\n){3} {2}<\/cloud-backup>\n {2}<device-transfer>\n(.+\n){3} {2}<\/device-transfer>\n<\/data-extraction-rules>\n$/,
    );
  });

  it('names the two res/xml files the plugin writes', () => {
    expect(BACKUP_RULES_FILES).toStrictEqual({
      backup_rules: FULL_BACKUP_CONTENT_XML,
      data_extraction_rules: DATA_EXTRACTION_RULES_XML,
    });
  });

  it('turns backup on and points the application at both rule files, keeping its other attributes', () => {
    const manifest = manifestWith({ 'android:allowBackup': 'false', 'android:label': 'Probe' });
    const next = applyBackupRules(manifest);
    expect(next.manifest.application?.[0]?.$).toStrictEqual({
      'android:name': '.MainApplication',
      'android:label': 'Probe',
      'android:allowBackup': 'true',
      'android:fullBackupContent': '@xml/backup_rules',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
    expect(manifest.manifest.application?.[0]?.$['android:allowBackup']).toBe('false');
  });

  it('refuses a manifest without an application', () => {
    expect(() =>
      applyBackupRules({ manifest: { $: { 'xmlns:android': ANDROID_NAMESPACE }, queries: [] } }),
    ).toThrow('AndroidManifest.xml has no <application>');
  });
});
