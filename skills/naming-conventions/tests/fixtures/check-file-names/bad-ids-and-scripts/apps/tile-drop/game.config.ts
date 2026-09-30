// apps/tile-drop/game.config.ts
import type { GameConfig } from '@demo/shell/config/game-config.ts';

/** Every per-game value. */
export const gameConfig: GameConfig = {
  id: 'tiledrop',
  bundleId: 'com.Example.tile_drop',
  premium: { productId: 'com.example.tiledrop.pro', priceNote: 'EUR 1.99 tier' },
};
