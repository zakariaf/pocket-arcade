// apps/line-siege/game.config.ts (excerpt)
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
          banner: 'ca-app-pub-3940256099942544/2934735716',
          interstitial: 'ca-app-pub-7310520968431056/8165377272',
          rewarded: 'ca-app-pub-3940256099942544/1712485313',
        },
      },
      android: {
        appId: 'ca-app-pub-3940256099942544~3347511713',
        units: {
          banner: 'ca-app-pub-3940256099942544/6300978111',
          interstitial: 'ca-app-pub-3940256099942544/1033173712',
          rewarded: 'ca-app-pub-3940256099942544/5224354917',
        },
      },
    },
  },
};
