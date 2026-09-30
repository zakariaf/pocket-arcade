// apps/sky-hop/app.config.ts
import { withShell } from '@demo/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

export default withShell(gameConfig, process.env);
