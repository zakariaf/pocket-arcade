// apps/demo-game/game.config.ts (fixture)
export const gameConfig = {
  id: 'demo-game',
  bundleId: 'io.applander.demogame',
  premium: { productId: 'io.applander.demogame.premium' },
  ads: { isEnabled: true },
  links: { privacyPolicy: { host: 'example.com', path: '/demo-game/privacy' } },
};
