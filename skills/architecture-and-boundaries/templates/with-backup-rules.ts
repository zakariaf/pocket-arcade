// packages/shell/plugins/with-backup-rules.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { withAndroidManifest, withDangerousMod } from 'expo/config-plugins.js';

import { applyBackupRules, BACKUP_RULES_FILES } from '@e07/shell/config/backup-rules.ts';

import type { ConfigPlugin } from 'expo/config-plugins.js';

/** Keeps only the save (SQLite/save.db with -wal and -shm) in Android Auto Backup (decision D5). */
const withBackupRules: ConfigPlugin = (config) => {
  const withRules = withDangerousMod(config, [
    'android',
    (next) => {
      const folder = join(next.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      mkdirSync(folder, { recursive: true });
      for (const [name, xml] of Object.entries(BACKUP_RULES_FILES)) {
        writeFileSync(join(folder, `${name}.xml`), xml);
      }
      return next;
    },
  ]);
  return withAndroidManifest(withRules, (next) => ({
    ...next,
    modResults: applyBackupRules(next.modResults),
  }));
};

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withBackupRules;
