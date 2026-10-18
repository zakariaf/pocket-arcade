// packages/shell/plugins/with-backup-rules.ts
import { withAndroidManifest } from 'expo/config-plugins.js';

const withBackupRules = (config: object): object => withAndroidManifest(config, (next) => next);

export default withBackupRules;
