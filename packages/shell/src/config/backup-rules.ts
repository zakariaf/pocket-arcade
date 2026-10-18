// packages/shell/src/config/backup-rules.ts
// Node world (read by packages/shell/plugins/with-backup-rules.ts at prebuild): the Android Auto
// Backup rules. The phone's own device backup may hold the save so progress follows a player to a
// new phone (spec 8.6, decision D5); it is the operating system's feature, not our network request.
// Only the save database is included: expo-sqlite keeps it in the app's files directory under
// SQLite/, with its WAL and shared-memory files beside it, and everything else stays out (consent
// and ad SDK state is never restored onto another phone).

import { updateMainApplication } from './main-application.ts';

import type { AndroidManifest } from './main-application.ts';

/** The save database and its WAL pair, relative to the app's files directory (domain "file"). */
export const SAVE_FILES: readonly string[] = [
  'SQLite/save.db',
  'SQLite/save.db-wal',
  'SQLite/save.db-shm',
];

const includes = (indent: string): string[] =>
  SAVE_FILES.map((path) => `${indent}<include domain="file" path="${path}"/>`);

/** android:fullBackupContent, read by Android 11 and lower. */
export const FULL_BACKUP_CONTENT_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<full-backup-content>',
  ...includes('  '),
  '</full-backup-content>',
  '',
].join('\n');

/** android:dataExtractionRules, read by Android 12 and later (cloud backup and device transfer). */
export const DATA_EXTRACTION_RULES_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<data-extraction-rules>',
  '  <cloud-backup>',
  ...includes('    '),
  '  </cloud-backup>',
  '  <device-transfer>',
  ...includes('    '),
  '  </device-transfer>',
  '</data-extraction-rules>',
  '',
].join('\n');

/** The files the plugin writes to android/app/src/main/res/xml/, by resource name. */
export const BACKUP_RULES_FILES: Readonly<Record<string, string>> = {
  backup_rules: FULL_BACKUP_CONTENT_XML,
  data_extraction_rules: DATA_EXTRACTION_RULES_XML,
};

/** Auto Backup on: the one source of the Expo android.allowBackup and the manifest attribute. */
export const IS_BACKUP_ALLOWED = true;

/** A manifest boolean attribute's value. */
const stringBooleanOf = (isOn: boolean): 'true' | 'false' => (isOn ? 'true' : 'false');

const BACKUP_ATTRIBUTES = {
  'android:allowBackup': stringBooleanOf(IS_BACKUP_ALLOWED),
  'android:fullBackupContent': '@xml/backup_rules',
  'android:dataExtractionRules': '@xml/data_extraction_rules',
} as const;

/** The manifest with backup on and both rule files named on its <application>; input unchanged. */
export function applyBackupRules(manifest: AndroidManifest): AndroidManifest {
  return updateMainApplication(manifest, (main) => ({
    ...main,
    $: { ...main.$, ...BACKUP_ATTRIBUTES },
  }));
}
