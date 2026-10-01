// apps/line-siege/game.config.ts (excerpt): the scaffold's values before owner steps G3 and G5
export const gameConfig = {
  id: 'line-siege',
  bundleId: 'io.applander.linesiege',
  version: '1.0.0',
  buildNumber: 7,
  ads: {
    ids: {
      ios: {
        appId: 'ca-app-pub-1234567890123456~1234567890',
        units: {
          banner: 'ca-app-pub-1234567890123456/1111111111',
          interstitial: 'ca-app-pub-1234567890123456/2222222222',
          rewarded: 'ca-app-pub-1234567890123456/3333333333',
        },
      },
    },
  },
  links: {
    privacyPolicy: { host: 'example.com', path: '/line-siege/privacy' },
    supportEmail: 'support@example.com',
  },
};
