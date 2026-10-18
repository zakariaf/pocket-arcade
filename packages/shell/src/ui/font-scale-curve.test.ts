// packages/shell/src/ui/font-scale-curve.test.ts
// Spec 8.11: "Text grows with the phone's text-size setting up to 200%, and layouts reflow rather
// than cut off." A part laid out against a text line must grow as the phone draws that line:
// linearly on iOS, along AOSP's font scale curves on Android 14 and later.
import fc from 'fast-check';

import {
  androidSpToDp,
  curveFor,
  isCurvedScalingOn,
  MAX_TEXT_SCALE,
  scaledSizeOf,
} from './font-scale-curve.ts';

describe('androidSpToDp (AOSP FontScaleConverterFactory, API 35)', () => {
  it.each([
    [8, 2, 16],
    [14, 1.5, 22],
    [30, 1.8, 34.8],
    [14, 1.15, 16.4],
    [100, 2, 100],
  ])('draws %d sp at the table point of scale %d: %d dp', (sp, fontScale, dp) => {
    expect(androidSpToDp(sp, fontScale)).toBeCloseTo(dp, 4);
  });

  it('draws the 200 % body line (25.5 sp) at 36.5 dp, as measured on the T25 emulator', () => {
    expect(androidSpToDp(25.5, 2)).toBeCloseTo(36.5, 4);
  });

  it('draws the 200 % hero key line (36.25 sp) at about 43.5 dp, not 72.5', () => {
    expect(androidSpToDp(36.25, 2)).toBeCloseTo(38 + (6.25 / 70) * 62, 4);
  });

  it('interpolates between two tables for a scale between their keys', () => {
    // 1.4 lies halfway between the 1.3 and 1.5 tables: 14 sp is 18.8 and 22 dp there.
    expect(androidSpToDp(14, 1.4)).toBeCloseTo(20.4, 4);
  });

  it('scales linearly below the first curve and above the last table', () => {
    expect(androidSpToDp(14, 1.03)).toBeCloseTo(14 * 1.03, 4);
    expect(androidSpToDp(14, 2.5)).toBeCloseTo(14 * 2.5, 4);
    expect(androidSpToDp(150, 2)).toBeCloseTo(150, 4);
  });

  it('grows with the size it is given and never draws a size smaller than at 100 %', () => {
    fc.assert(
      fc.property(
        fc.record({
          fontScale: fc.double({ min: 1, max: 2, noNaN: true }),
          small: fc.double({ min: 0, max: 200, noNaN: true }),
          step: fc.double({ min: 0, max: 50, noNaN: true }),
        }),
        ({ fontScale, small, step }) => {
          const lower = androidSpToDp(small, fontScale);
          return lower >= small - 1e-3 && androidSpToDp(small + step, fontScale) >= lower - 1e-3;
        },
      ),
    );
  });
});

describe('scaledSizeOf (spec 8.11: up to 200 %)', () => {
  it('scales linearly where the curves are off: iOS, Android before 14', () => {
    expect(scaledSizeOf(36.25, 2, false)).toBe(72.5);
    expect(scaledSizeOf(36.25, 3.571, false)).toBe(72.5);
  });

  it('follows the curve on Android 14 and later', () => {
    expect(scaledSizeOf(25.5, 2, true)).toBeCloseTo(36.5, 4);
  });

  it('keeps the linear answer exactly where the curves are off, at every text size', () => {
    fc.assert(
      fc.property(
        fc.record({
          size: fc.double({ min: 0, max: 200, noNaN: true }),
          fontScale: fc.double({ min: 0.5, max: 4, noNaN: true }),
        }),
        ({ size, fontScale }) =>
          scaledSizeOf(size, fontScale, false) === size * Math.min(fontScale, 2),
      ),
    );
  });

  it('stops every size at 200 %, as maxFontSizeMultiplier caps it', () => {
    fc.assert(
      fc.property(
        fc.record({
          size: fc.double({ min: 0, max: 200, noNaN: true }),
          fontScale: fc.double({ min: 1, max: 4, noNaN: true }),
          isCurved: fc.boolean(),
        }),
        ({ size, fontScale, isCurved }) => scaledSizeOf(size, fontScale, isCurved) <= size * 2,
      ),
    );
  });
});

describe('isCurvedScalingOn', () => {
  it('turns the curves on for Android 14 (API 34) and later only', () => {
    expect([
      isCurvedScalingOn('android', 34),
      isCurvedScalingOn('android', 35),
      isCurvedScalingOn('android', 33),
      isCurvedScalingOn('android', undefined),
      isCurvedScalingOn('ios', '26.0'),
    ]).toStrictEqual([true, true, false, false, false]);
  });

  it('caps at the same 200 % as maxFontSizeMultiplier', () => {
    expect(MAX_TEXT_SCALE).toBe(2);
  });
});

describe('curveFor (the converted points, made once per font scale)', () => {
  it('hands back the same points for the same font scale, so a lookup allocates nothing', () => {
    expect(curveFor(1.4)).toBe(curveFor(1.4));
    expect(curveFor(2)).toBe(curveFor(2));
  });

  it('pins the 200 % table and the interpolated 1.4 points at 14 sp', () => {
    expect(curveFor(2)?.[3]).toStrictEqual([14, 26]);
    expect(curveFor(1.4)?.[3]?.[1]).toBeCloseTo(20.4, 4);
  });

  it('is null where Android scales linearly: below the first curve and past the last table', () => {
    expect([curveFor(1), curveFor(1.03), curveFor(2.5)]).toStrictEqual([null, null, null]);
  });
});
