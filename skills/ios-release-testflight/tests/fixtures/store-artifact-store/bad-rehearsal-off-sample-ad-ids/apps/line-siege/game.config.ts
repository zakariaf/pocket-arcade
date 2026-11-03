// apps/line-siege/game.config.ts (excerpt): Google's sample (test) ids typed in as stand-ins for owner step G5
export const gameConfig = {
  id: 'line-siege',
  bundleId: 'io.applander.linesiege',
  version: '1.0.0',
  buildNumber: 7,
  ads: {
    ids: {
      ios: {
        appId: 'ca-app-pub-3940256099942544~1458002511',
        units: {
          banner: 'ca-app-pub-7310520968431056/4111111111',
          interstitial: 'ca-app-pub-3940256099942544/4411468910',
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
