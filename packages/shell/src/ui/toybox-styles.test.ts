// packages/shell/src/ui/toybox-styles.test.ts
import {
  DIE_CUT_TILTED_LAYER,
  dieCutRing,
  dieCutTiltedLayer,
  focusRing,
  hardShadow,
  TILTED_LAYER,
  tiltedLayer,
} from './toybox-styles.ts';

describe('toybox styles', () => {
  it('draws hard shadows straight down with no blur', () => {
    expect(hardShadow(8, '#1D1B3A')).toStrictEqual({
      boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 0, spreadDistance: 0, color: '#1D1B3A' }],
    });
  });

  it('draws the die-cut ring as a spread with no offset', () => {
    expect(dieCutRing(3.5, '#FFFFFF')).toStrictEqual({
      boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3.5, color: '#FFFFFF' }],
    });
  });

  it('draws the focus ring 3 pt wide and 2 pt away', () => {
    expect(focusRing('#C8157A')).toStrictEqual({
      outlineWidth: 3,
      outlineStyle: 'solid',
      outlineOffset: 2,
      outlineColor: '#C8157A',
    });
  });

  it('rasterizes a tilted printed part, so iOS turns its edges smooth', () => {
    // Fabric draws a border from an image it stretches with nearest filtering: a turned edge, and an
    // inner border such as the calendar's month band, steps at device pixels unless the layer is
    // rasterized and resampled as one picture (as Chrome draws the references).
    expect(TILTED_LAYER).toStrictEqual({
      shouldRasterizeIOS: true,
      renderToHardwareTextureAndroid: true,
    });
  });

  it('gives the Android half of every tilt its own hardware layer too', () => {
    // Android ignores shouldRasterizeIOS: a tilted part renders into one GPU texture
    // (renderToHardwareTextureAndroid) that turns with filtering, or its edges step at device pixels.
    expect(tiltedLayer(-5, undefined)).toMatchObject({
      shouldRasterizeIOS: true,
      renderToHardwareTextureAndroid: true,
    });
    expect(tiltedLayer(-5, undefined).style).toStrictEqual([
      undefined,
      { transform: [{ rotate: '-5deg' }] },
    ]);
  });

  it("turns a die-cut part exactly as every tilt on iOS, without Android's texture", () => {
    // The die-cut ring is an outset box-shadow; Android's hardware texture (renderToHardwareTextureAndroid)
    // is the size of the part's box and cut the ring off there (E18-T20). Every prop iOS reads stays
    // byte for byte what tiltedLayer gives, so no iOS pixel moves.
    const style = [{ borderRadius: 14 }, dieCutRing(3.5, '#FFFFFF')];
    const after = [{ translateY: 2 }];
    const { renderToHardwareTextureAndroid: hasAndroidTexture, ...iosHalf } = tiltedLayer(
      -5,
      style,
      after,
    );

    expect(hasAndroidTexture).toBe(true);
    expect(dieCutTiltedLayer(-5, style, after)).toStrictEqual(iosHalf);
    expect(DIE_CUT_TILTED_LAYER).toStrictEqual({ shouldRasterizeIOS: true });
    expect({ ...DIE_CUT_TILTED_LAYER, renderToHardwareTextureAndroid: true }).toStrictEqual(
      TILTED_LAYER,
    );
  });
});
