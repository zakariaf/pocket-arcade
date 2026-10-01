// apps/line-siege/game.config.ts (excerpt): the scaffold's values before owner steps G3 and G5
export const gameConfig = {
  id: 'line-siege',
  bundleId: 'io.applander.linesiege',
  version: '1.0.0',
  buildNumber: 7,
  ads: {
    ids: {
      ios: {
        appId: 'ca-app-pub-7310520968431056~5190264813',
        units: {
          banner: 'ca-app-pub-7310520968431056/4111111111',
          interstitial: 'ca-app-pub-7310520968431056/4222222222',
          rewarded: 'ca-app-pub-7310520968431056/4333333333',
        },
      },
    },
  },
  links: {
    privacyPolicy: { host: 'games.applander.io', path: '/line-siege/privacy' },
    supportEmail: 'support@applander.io',
  },
};
