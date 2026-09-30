// apps/tile-drop/game.config.ts
import type { GameConfig } from '@demo/shell/config/game-config.ts';

/** Every per-game value. */
export const gameConfig: GameConfig = {
  id: 'tile-drop',
  bundleId: 'com.example.tiledrop',
  premium: { productId: 'com.example.tiledrop.premium', priceNote: 'EUR 1.99 tier' },
};
