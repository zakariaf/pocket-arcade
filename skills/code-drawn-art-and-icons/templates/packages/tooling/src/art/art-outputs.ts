// packages/tooling/src/art/art-outputs.ts
// What render-art.ts writes into apps/<game>/assets/generated/, and the geometry each platform asks
// for. Pure data: render-art.ts draws each output; check-app-art (code-drawn-art-and-icons) proves
// the PNGs against the same numbers.

/** How an output is drawn (render-art.ts `draw`). */
export type ArtVariant =
  'light' | 'dark' | 'tinted' | 'splash' | 'adaptive' | 'monochrome' | 'android-splash';

export type ArtOutput = {
  readonly file: string;
  readonly variant: ArtVariant;
  readonly scheme: 'light' | 'dark';
  /** Width and height in px. */
  readonly size: number;
};

/** Every generated file: the five iOS outputs first, then Android and Google Play. */
export const ART_OUTPUTS: readonly ArtOutput[] = [
  { file: 'icon-light.png', variant: 'light', scheme: 'light', size: 1024 },
  { file: 'icon-dark.png', variant: 'dark', scheme: 'dark', size: 1024 },
  { file: 'icon-tinted.png', variant: 'tinted', scheme: 'dark', size: 1024 },
  { file: 'splash-logo.png', variant: 'splash', scheme: 'light', size: 1024 },
  { file: 'splash-logo-dark.png', variant: 'splash', scheme: 'dark', size: 1024 },
  // Android 8+ adaptive icon: the glyph on transparency; the accent is its background colour.
  { file: 'android-icon-foreground.png', variant: 'adaptive', scheme: 'light', size: 1024 },
  // Android 13+ themed icon: one colour, the shape carried by alpha (the launcher tints it).
  { file: 'android-icon-monochrome.png', variant: 'monochrome', scheme: 'light', size: 1024 },
  // Android 12+ splash icon (light and dark): the S1 tile inside the masking circle.
  { file: 'android-splash-icon.png', variant: 'android-splash', scheme: 'light', size: 1024 },
  { file: 'android-splash-icon-dark.png', variant: 'android-splash', scheme: 'dark', size: 1024 },
  // Google Play's store listing icon: the light icon at 512 px (uploaded at Android step 8).
  { file: 'play-icon-512.png', variant: 'light', scheme: 'light', size: 512 },
];

/** Apple: the glyph inside the central area; Toybox uses 62 % of the icon. */
export const ICON_GLYPH = 0.62;

/** Adaptive icon: a 108 dp canvas whose central 66 dp circle is never masked. */
export const ADAPTIVE_SAFE_DIAMETER = 66 / 108;

/** The logo's square at 43 % of the canvas: its corners stay inside the 66 dp circle. */
export const ADAPTIVE_GLYPH = 0.43;

/** Android 12 splash icon: a 288 dp canvas masked to a 192 dp circle. */
export const ANDROID_SPLASH_CIRCLE = 192 / 288;

/** The splash tile with its ring spans 46 % of the canvas, so its corners stay inside the circle. */
export const ANDROID_SPLASH_FIT = 0.46;
