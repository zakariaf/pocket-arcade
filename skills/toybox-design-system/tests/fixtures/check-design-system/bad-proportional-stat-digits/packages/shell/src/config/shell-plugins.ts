// packages/shell/src/config/shell-plugins.ts (fixture excerpt: the one plugin list)
const FONTS = './assets/fonts';

export const FONT_PLUGIN = [
  'expo-font',
  {
    fonts: [
      `${FONTS}/Vazirmatn-Regular.ttf`,
      `${FONTS}/Vazirmatn-Bold.ttf`,
      `${FONTS}/LilitaOne.ttf`,
      `${FONTS}/Rubik-Regular.ttf`,
      `${FONTS}/Rubik-Bold.ttf`,
    ],
  },
] as const;
