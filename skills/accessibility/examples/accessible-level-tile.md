# Worked example: an accessible level tile

The S8 level tile shows a number and three mini stars (or a padlock). VoiceOver must hear "Level 2: 1 star, button", "Level 3: no stars yet, button" for the current level, or "Level 4, locked, button" followed by a hint on how to unlock it, and the tile must stay at least 44 pt at 200 % text. The tile is the Toybox `LevelTile` (`packages/shell/src/ui/level-tile.tsx`, from the components work); this example is the accessibility half: where its name and hint come from and how the test proves them. The test below passed in the project workspace (jest-expo 57, RNTL 14, the real English catalog through `renderWithShell`).

## Catalog entries (from the copy deck; all four languages exist, English shown)

```json
{
  "levels.level-tile.a11y-label": "Level {level, number}: {starsCount, plural, =0 {no stars yet} one {# star} other {# stars}}",
  "levels.level-tile.locked.a11y-hint": "Shows how to unlock this level.",
  "levels.level-tile.locked.a11y-label": "Level {level, number}, locked"
}
```

The name is one whole sentence with a typed number and a plural (with the same `=0` branch in every language), so it is right in Persian (Persian digits, `one` holding 0) and German. Never glue it: `` `Level ${n}` `` is English for everyone and `check-a11y-code.mjs` rejects it (`literal-a11y-text`).

## Where the name is built: the screen, with t()

The Levels screen (its pack section) computes one label per tile and a hint only for locked tiles, then hands both to the presentational tile:

```tsx
/** The tile's VoiceOver label: "Level 12: 2 stars", "Level 13: no stars yet", "Level 14, locked". */
function tileLabel(t: TFunction, tile: LevelTileModel): string {
  if (tile.state.kind === 'locked') {
    return t('levels.level-tile.locked.a11y-label', { level: tile.level });
  }
  const stars = tile.state.kind === 'completed' ? tile.state.stars : 0;
  return t('levels.level-tile.a11y-label', { level: tile.level, starsCount: stars });
}

// …inside the 6-column grid (flexDirection 'row' + flexWrap: level 1 at the top right in fa/ckb)
<LevelTile
  key={tile.level}
  testID={`levels.level-tile.${String(tile.level)}`}
  numberText={tile.numberText}
  state={tile.state}
  label={tileLabel(t, tile)}
  {...(tile.state.kind === 'locked' ? { hint: t('levels.level-tile.locked.a11y-hint') } : {})}
  onPress={() => {
    onPressTile(tile);
  }}
  width={tileWidth}
  isFocused={tile.level === focusedLevel}
  isReducedMotion={isReducedMotion}
/>
```

`LevelTile` passes `label` and `hint` to `RaisedSurface`, whose `Pressable` sets `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint` and `accessibilityState` (disabled, busy) itself, so no screen can forget them.

What each choice buys:

| Choice | Why |
|---|---|
| One `button` per tile, named by `label` | the whole tile is one element; VoiceOver reads the sentence, not "1" and three unlabelled stars |
| Label from `t()` with a typed number and a plural | correct in all four languages, with the player's digits |
| Hint only on locked tiles | the outcome of tapping a locked tile is not obvious; an open tile needs no hint |
| Mini stars filled vs hollow, padlock, dashed edge on locked tiles | shape cues: meaning never by colour alone |
| `numberText` formatted in the screen hook (`createNumberFormatter`) | the tile shows Persian digits in fa/ckb; the label's `{level, number}` gets them from the catalog |
| Tile height fixed by the Toybox spec, width from the grid (about 51.7 pt), both ≥ 44 | Apple's minimum target without `hitSlop` |
| Stars and padlock carry no labels of their own | the tile's name already says it; decorative parts stay silent |

## The test

```tsx
// packages/shell/src/screens/levels/level-tile-a11y.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { LevelTile } from '@e07/shell/ui/level-tile.tsx';

import type { LevelTileState } from '@e07/shell/ui/level-tile.tsx';
import type { ReactNode } from 'react';

type Probe = { readonly level: number; readonly state: LevelTileState };

const TILES: readonly Probe[] = [
  { level: 1, state: { kind: 'completed', stars: 1 } },
  { level: 2, state: { kind: 'current' } },
  { level: 3, state: { kind: 'locked' } },
];

// The same t() calls as the Levels screen's pack section (a label per tile, a hint when locked).
function Tiles({ onPlay }: { readonly onPlay: (level: number) => void }): ReactNode {
  const t = useT();
  return TILES.map(({ level, state }) => (
    <LevelTile
      key={level}
      testID={`levels.level-tile.${String(level)}`}
      numberText={String(level)}
      state={state}
      label={
        state.kind === 'locked'
          ? t('levels.level-tile.locked.a11y-label', { level })
          : t('levels.level-tile.a11y-label', {
              level,
              starsCount: state.kind === 'completed' ? state.stars : 0,
            })
      }
      {...(state.kind === 'locked' ? { hint: t('levels.level-tile.locked.a11y-hint') } : {})}
      onPress={() => {
        onPlay(level);
      }}
      width={52}
      isReducedMotion
    />
  ));
}

describe('LevelTile for VoiceOver', () => {
  it('reads each tile as one button with its translated number and stars', async () => {
    const onPlay = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<Tiles onPlay={onPlay} />);

    await user.press(screen.getByRole('button', { name: 'Level 1: 1 star' }));

    expect(onPlay).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Level 2: no stars yet' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Level 3, locked' })).toHaveProp(
      'accessibilityHint',
      'Shows how to unlock this level.',
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
```

The role-and-name queries are how VoiceOver finds the tiles (RNTL 14 has no hint matcher, hence `toHaveProp`); the last line is the audit every screen test ends with. The Levels screen's own test ends with the same line. Then:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-a11y-code.mjs .
```
