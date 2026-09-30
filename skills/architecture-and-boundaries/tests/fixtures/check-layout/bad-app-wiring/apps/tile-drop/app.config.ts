// apps/tile-drop/app.config.ts
import { withShell } from '@demo/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

const config = withShell(gameConfig, process.env);

export default { ...config, name: 'Tile Drop' };
