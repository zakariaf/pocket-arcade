// apps/tile-drop/src/index.ts
import { applyMove } from './rules/apply-move.ts';

import type { ShellGameModule } from '@demo/shell/game-host/shell-game-module.ts';

/** TileDrop as the Shell sees it. */
export const tileDropGame: ShellGameModule = { id: 'tile-drop', applyMove };
