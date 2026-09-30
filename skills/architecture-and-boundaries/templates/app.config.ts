// apps/__GAME_ID__/app.config.ts
import { withShell } from '@e07/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

export default withShell(gameConfig, process.env);
