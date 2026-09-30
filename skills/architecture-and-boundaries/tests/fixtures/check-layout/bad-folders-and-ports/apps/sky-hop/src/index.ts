// apps/sky-hop/src/index.ts
import { applyMove } from './rules/apply-move.ts';

import type { ShellGameModule } from '@demo/shell/game-host/shell-game-module.ts';

/** SkyHop as the Shell sees it. */
export const skyHopGame: ShellGameModule = { id: 'sky-hop', applyMove };
