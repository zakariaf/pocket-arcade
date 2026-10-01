// packages/shell/src/game-host/example-picture-aspect.test.ts
import { EXAMPLE_PICTURE_ASPECT, examplePictureAspectOf } from './example-picture-aspect.ts';

describe('examplePictureAspectOf', () => {
  it('gives every board the Toybox picture shape, 320 x 206, by default', () => {
    expect(EXAMPLE_PICTURE_ASPECT).toBeCloseTo(1.5534, 4);
    expect(examplePictureAspectOf({ isMirroredInRtl: false })).toBe(320 / 206);
  });

  it("uses the board's own aspect when it gives one", () => {
    expect(examplePictureAspectOf({ isMirroredInRtl: false, exampleAspect: 1 })).toBe(1);
  });

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the Toybox shape for an unusable aspect (%p)',
    (exampleAspect) => {
      expect(examplePictureAspectOf({ isMirroredInRtl: true, exampleAspect })).toBe(
        EXAMPLE_PICTURE_ASPECT,
      );
    },
  );
});
