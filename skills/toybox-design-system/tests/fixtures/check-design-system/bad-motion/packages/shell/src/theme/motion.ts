// packages/shell/src/theme/motion.ts
// Toybox motion tokens as plain data. Components turn them into Reanimated calls, for example
// withTiming(1, { duration: MOTION_MS.pressIn, easing: Easing.bezier(...EASING.easeOut) }).

/** cubic-bezier control points (x1, y1, x2, y2). boing overshoots about 14 %. */
export const EASING = {
  boing: [0.34, 1.7, 0.6, 1],
  slide: [0.2, 0.8, 0.2, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
} as const;

/** Durations and loop lengths in ms. */
export const MOTION_MS = {
  pressIn: 70,
  release: 320,
  fillChange: 120,
  toggleKnob: 300,
  starPop: 540,
  starStagger: 150,
  starDelay: 250,
  stickerSlap: 420,
  toastDrop: 380,
  toastDelay: 500,
  screenPush: 260,
  bob: 1600,
  hop: 900,
  hopStagger: 120,
  holdToConfirm: 2000,
  reducedFade: 120,
  reducedCrossFade: 150,
  winTitleStickerDelay: 700,
  newBestStickerDelay: 950,
} as const;

/**
 * Release spring. mass is written out because Reanimated 4.5.1 defaults it to 4, which makes
 * the release twice as slow and much bouncier. For exact parity with the CSS curve use
 * withTiming(0, { duration: MOTION_MS.release, easing: Easing.bezier(...EASING.boing) }).
 */
export const RELEASE_SPRING = { damping: 12, stiffness: 420, mass: 4 } as const;

/** Press squash at full depth: scale (1 + x, 1 + y) around the centre. */
export const PRESS_SQUASH = {
  button: { x: 0.03, y: -0.06 },
  iconButton: { x: 0.05, y: -0.07 },
  levelTile: { x: 0.04, y: -0.06 },
  quietButtonScale: 0.97,
} as const;

/** Keyframes: t is 0..1 of the duration. */
export const KEYFRAMES = {
  starPop: [
    { t: 0, scale: 0, rotateDeg: -30 },
    { t: 0.55, scale: 1.22, rotateDeg: 8 },
    { t: 0.78, scale: 0.94, rotateDeg: -2 },
    { t: 1, scale: 1, rotateDeg: 0 },
  ],
  /** From 1.7x and the sticker's own tilt minus 14 degrees, fading in. */
  stickerSlap: { fromScale: 1.7, fromExtraRotateDeg: -14 },
  toastDrop: { fromTranslateY: 22, fromScale: 0.9 },
  bob: { translateY: -3 },
  hop: { translateY: -7, peakAt: 0.3, restFrom: 0.6 },
} as const;
