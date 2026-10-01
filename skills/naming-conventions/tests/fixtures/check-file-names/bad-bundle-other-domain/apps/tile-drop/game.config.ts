// apps/tile-drop/game.config.ts
import type { GameConfig } from '@demo/shell/config/game-config.ts';

/** Every per-game value. */
export const gameConfig: GameConfig = {
  id: 'tile-drop',
  bundleId: 'io.pocketarcade.tiledrop',
  premium: { productId: 'io.pocketarcade.tiledrop.premium', priceNote: 'EUR 1.99 tier' },
};
