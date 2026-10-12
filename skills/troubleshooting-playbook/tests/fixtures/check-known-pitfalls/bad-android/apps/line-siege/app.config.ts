// apps/line-siege/app.config.ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withShell } from '@e07/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

export default ({ config }: ConfigContext): ExpoConfig => withShell(config, gameConfig, process.env);
