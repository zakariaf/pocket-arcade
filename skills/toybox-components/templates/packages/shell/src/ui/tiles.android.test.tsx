// packages/shell/src/ui/tiles.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). The die-cut ring is an outset
// box-shadow (dieCutRing): drawn outside the part's own box. Android renders a View with
// renderToHardwareTextureAndroid into a GPU texture the size of that box, so the ring was cut off
// at the box: white wedges in the corners and no ring along the edges (S2's globe tile and the
// "Phone language" sticker on the emulator, E18-T19). Android draws a turned ring and edge
// smoothly without the texture, so a ringed part keeps only iOS's rasterized layer.
import { screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { ArtTile } from './art-tile.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { LevelTile } from './level-tile.tsx';
import { PremiumArt } from './premium-art.tsx';
import { Sticker } from './sticker.tsx';
import { dieCutRing } from './toybox-styles.ts';

import type { ViewStyle } from 'react-native';
import type { TestInstance } from 'test-renderer';

const HIDDEN = { includeHiddenElements: true } as const;

async function renderRingedParts(): Promise<void> {
  await renderWithShell(
    <>
      <Sticker text="Phone language" size="sm" tiltDeg={3} testID="language-choice.phone-badge" />
      <ArtTile icon="globe" testID="language-choice.art" />
      <LevelTile
        numberText="12"
        state={{ kind: 'current' }}
        label="Level 12: no stars yet"
        onPress={jest.fn()}
        testID="levels.level-tile.12"
        isReducedMotion
        width={54}
      />
      <PremiumArt testID="premium.art" />
    </>,
  );
}

/** The die-cut ring each part draws, by testID (light scheme). */
const RINGED_PARTS = [
  { testID: 'language-choice.phone-badge', ring: COMPONENT_SPECS.sticker.ring },
  { testID: 'language-choice.art', ring: COMPONENT_SPECS.art.ring },
  { testID: 'levels.level-tile.12.flag', ring: COMPONENT_SPECS.levelTile.flag.ring },
  { testID: 'premium.art', ring: COMPONENT_SPECS.premiumArt.ring },
] as const;

/** True when a host element's style draws an outset spread (a ring) outside its box. */
function drawsOutsetRing(node: TestInstance): boolean {
  const style = StyleSheet.flatten(node.props['style'] as ViewStyle | undefined) ?? {};
  const shadows = Array.isArray(style.boxShadow) ? style.boxShadow : [];
  return shadows.some((shadow) => Number(shadow.spreadDistance ?? 0) > 0);
}

describe('die-cut parts on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it("keeps each die-cut ring out of Android's hardware texture, which would cut it off", async () => {
    await renderRingedParts();

    for (const { testID, ring } of RINGED_PARTS) {
      const part = screen.getByTestId(testID, HIDDEN);
      // The ring is still there, as the design draws it ...
      expect(part).toHaveStyle(dieCutRing(ring, SHELL_COLORS.light.cut));
      // ... and still turns as one rasterized layer on iOS ...
      expect(part).toHaveProp('shouldRasterizeIOS', true);
      // ... but Android draws it without a texture clipped to the part's box.
      expect(part).not.toHaveProp('renderToHardwareTextureAndroid');
    }
  });

  it('renders no element with an outset ring into a hardware texture', async () => {
    await renderRingedParts();

    const ringed = screen.container.queryAll(drawsOutsetRing);
    expect(ringed.length).toBeGreaterThanOrEqual(RINGED_PARTS.length);
    for (const node of ringed) {
      expect(node).not.toHaveProp('renderToHardwareTextureAndroid');
    }
  });
});
