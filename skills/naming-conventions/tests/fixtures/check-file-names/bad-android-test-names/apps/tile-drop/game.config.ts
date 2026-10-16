// apps/tile-drop/game.config.ts
import type { GameConfig } from '@demo/shell/config/game-config.ts';

/** Every per-game value. */
export const gameConfig: GameConfig = {
  id: 'tile-drop',
  bundleId: 'io.applander.tiledrop',
  premium: { productId: 'io.applander.tiledrop.premium', priceNote: 'EUR 1.99 tier' },
};
