# Drawing a board: draw(), kit, palettes, layout, text, particles

Everything a game's `draw-board.ts`, `layout-board.ts`, `to-view.ts`, `board-palettes.json` and `<game-id>-board.ts` must get right. Read this before writing or reviewing any of them.

## Contents

- The rules of draw()
- The render kit and palettes
- Paths: build once, unit size
- Layout at any canvas size
- RTL: mirror positions, never pixels
- Text: digits, words, fonts
- Particles and effects
- Many sprites: Atlas
- Performance
- Toybox framing and accessibility
- Line Siege: the paint list and shape rules
- The rules shape the templates assume (Tap Flip)

## The rules of draw()

`draw(canvas, frame)` is a worklet in a file that starts with `'worklet';`. It:

- reads only its arguments: `frame.view`, `frame.fx` (timeline sample + pointer), `frame.highlight` (the host's selection and hinted targets), `frame.colors`, `frame.layout`, `frame.kit`;
- allocates no Skia objects (no `Skia.Paint()`, `Skia.Color()`, `Skia.Path…`, `Skia.Font`), reads no clock and no random source, returns nothing;
- imports Skia **types** only (`import type { SkCanvas } …`), and values only from other `'worklet'` modules (`board-layout.ts`, `sample.ts`, `particles.ts`, `draw-centered-text.ts`, `board-ids.ts`). A plain JS function called on the UI thread throws at runtime, not at build time;
- is split into one small function per layer: background, cells, pieces, highlight, vanishing pieces, effects, ghost;
- draws the drag ghost exactly on `frame.fx.pointer.hover`: the gesture layer already lifted the pointer by the board's `dragLiftPt`, so draw never adds an offset (`row - 1` would put the ghost one row away from where the block lands).

Because of these rules the same function runs in the Picture worklet on device, in Jest goldens (CanvasKit) and in headless Node art scripts with identical pixels. Plain `{ x, y, width, height }` objects are accepted wherever Skia wants an `SkRect` (and `{ rect, rx, ry }` for an `SkRRect`), on device and in CanvasKit, so drawing allocates nothing.

Set the paint immediately before each draw call (`kit.fill.setColor(colors.color.piece)`), and restore alpha to 1 after a translucent layer (`kit.fill.setAlphaf(1)`).

**Highlights.** The host passes a `BoardHighlight` (`{ selected, hinted }`, `EMPTY_HIGHLIGHT` when there is nothing) as a prop, and it reaches draw as `frame.highlight`. It is UI state (a tap-then-tap selection and the hinted move), never game state. Draw `selected` (Line Siege rings the selected tray slot) and each target of `hinted` (the template rings hinted cells; Line Siege draws the hinted block as a ghost and rings its slot). A board that can hint implements `targetsOfMove(state, move)` on its `GameBoard`, which the host calls with `controller.hintedMove()`.

**Effect layers wait for their track.** `sampleTimeline` holds a track's `from` values until it starts, so a sample exists at moment 0 for every track of the turn. A layer that is a tween of something already visible (a cell's pop scale, a monster's row) may read those held values. A layer that only exists while its effect plays (a flash, a shockwave band, a glow, a particle burst, a shake) draws only when `entry.ageMs > 0` and `entry.progress < 1`; otherwise every flash and wave of the turn would show at full strength at moment 0, long before its event. The templates and the Line Siege example guard these layers with one helper:

```ts
function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}
```

## The render kit and palettes

`makeBoardKit(skia, { paths, numberTypeface, numberSize })` builds, once per theme on the JS thread: a scratch `fill` paint, a scratch `stroke` paint, `numberFont` (digits and Latin), the unit `paths` from `board.buildPaths(skia)`, and `labels` (shaped Paragraphs). Host objects captured in the kit are shared with the UI thread, not copied.

`makeBoardColors(skia, BOARD_PALETTES, { scheme, isColorBlind })` resolves every token once per theme change; draw reads `colors.color.<token>`.

`board-palettes.json` holds four sets with identical keys: `light`, `dark`, `colorBlindLight`, `colorBlindDark`. Beside it, `board-contrast.json` says which colours sit on which, so the accessibility check can measure them:

```json
{
  "edge": "edge",
  "text": [["label", "cell"]],
  "graphics": [["mark", "lit"], ["hint", "cell"]],
  "shapes": [["lit", "background"], ["lit", "cell"]],
  "distinct": [["lit", "cell"]]
}
```

- `text`: `[fg, bg]` pairs of text (digits, labels) that need 4.5:1.
- `graphics`: `[fg, bg]` icons, marks and rings that need 3:1.
- `shapes`: `[fill, ground]` filled shapes that draw() edges with the `edge` token; each must stand 3:1 off its ink edge or off its ground (the Toybox rule: the ink outline is the boundary WCAG 1.4.11 measures).
- `distinct`: token lists (piece colours, monster kinds) that must stay at least 0.07 apart in OKLab under protan, deutan and tritan simulation, in the two colour-blind sets. Keep these tokens opaque.
- Translucent `#RRGGBBAA` tokens are composited over their ground (and a translucent ground over `background`) before they are measured.

- Tokens are semantic (`filled`, `piece`, `effect`), never visual (`blue`).
- Values are `#RRGGBB`, or `#RRGGBBAA` for translucent tokens such as the ghost.
- Colour-blind sets use a CVD-safe family (the templates use Okabe–Ito colours), and meaning is also carried by shape, because nothing may be told apart by colour alone.
- Prove both with the `accessibility` skill (load it): from the repo root its `check-contrast.mjs .` finds every `apps/*/src/board/board-palettes.json`, and `check-contrast.mjs . --palette apps/<game-id>/src/board/board-palettes.json` checks one board. It detects the board palette shape, checks the declared pairs in all four sets and the `distinct` lists in the colour-blind sets, and fails (`board-pairs`) when `board-contrast.json` is missing or names an unknown token. The game's palette test (`test/integration/a11y/<game-id>-palette.test.ts`, from the same skill) reads the same `distinct` lists. This skill's `check-board-files.mjs` checks that both files exist and that the four sets match.
- `board-palettes.ts` imports the JSON `with { type: 'json' }` and types it as `PaletteSet<BoardToken>`, so a missing token is a type error.
- The Toybox colour-blind switch changes nothing in the Shell UI (its palette is identical); on boards it switches to the colour-blind sets.

## Paths: build once, unit size

Build shapes once, in `buildPaths(skia)`, with the immutable API, at unit size (0…1):

```ts
const piece = skia.PathBuilder.Make().moveTo(0.5, 0.04).lineTo(0.94, 0.5).lineTo(0.5, 0.96).lineTo(0.06, 0.5).close().build();
```

Draw them scaled into a cell with `canvas.save(); canvas.translate(x, y); canvas.scale(size, size); canvas.drawPath(path, paint); canvas.restore();`. Never `Skia.Path.Make()` plus `addCircle`/`moveTo` on the path in new code: Skia 2.6 moved to immutable paths, and in 2.6.2 the old mutators still work but log a deprecation warning and will be removed. `path.transform(m)` still mutates in place: transform a copy with `Skia.PathBuilder.MakeFromPath(path).transform(m).build()`, or use the canvas transform. `Skia.Path.Circle(x, y, r)` is fine for static shapes.

## Layout at any canvas size

`layout(input)` is a pure worklet of the actual canvas size (portrait phone, landscape iPad, iOS 27 resizable windows) and returns a `BoardLayout`:

```ts
type BoardLayout = { width: number; height: number; isMirrored: boolean; regions: readonly GridRegion[] };
type GridRegion = { id: string; x: number; y: number; cell: number; cols: number; rows: number };
```

- `fitGrid({ box, cols, rows })` gives the largest whole-pixel square cell that fits `box`, centred.
- Regions exist only for tappable cells (board, tray, button strip). Free-form worlds (Bank Shot, Halo Drift) scale to `layout.width`/`height` and need no regions.
- `cellRect(layout, { regionId, col, row })` is where to draw a cell (fractional col/row works for mid-animation positions). `hitTest(layout, point, slop)` is the inverse, used by the input hook. Both read the same layout, so drawing and touch can never drift.
- Rearrange for wide canvases instead of shrinking (Line Siege puts its tray beside the board when `width > height × 1.2`).
- A board whose drag ghost floats above the finger (`dragLiftPt`) keeps at least that much canvas below its last row, or no lifted drag could reach the last row: Line Siege's tray lies there in portrait, and its layout keeps a free strip of `DRAG_LIFT_PT` below the board when the tray stands beside it. Its `hit-targets.test.ts` proves every edge row is reachable in both layouts, and `drag-lift.test.ts` that the ghost cell is the placed cell.
- The canvas size comes from `<Canvas onSize={sizeSharedValue}>`; `onLayout` is deprecated on Fabric. Before the first size, `EMPTY_LAYOUT` (no regions) keeps hit-testing inert.
- The template `layout-board.test.ts` proves at random sizes (240…2732 pt), mirrored or not, that every cell stays inside the canvas and `hitTest(cellRect(c)) = c`.

## RTL: mirror positions, never pixels

Boards are physical and never pixel-flip (`scaleX: -1` would mirror letters and digits). A game that opts in (`isMirroredInRtl: true`, e.g. Letter Bugs) gets `layout.isMirrored = isRtl && board.isMirroredInRtl`, and `cellRect`/`hitTest` mirror positions: logical column 0 sits on the physical right edge, glyphs stay readable, touches still land. Draw code never branches on direction.

## Text: digits, words, fonts

- **Digits**: `toView()` formats every number with the Shell's `ViewFormat.formatNumber` for the current locale, so the view holds `'۱۲'`, not `12`. Numbers that must stay Latin (codes, symbols) are formatted with the `en` formatter.
- **Digits in a small shape**: the kit has one number size (`numberSize`, 16 in the goldens), which overflows a half-cell monster or a small cell. `drawFittedText(canvas, { text, rect, maxShare = 0.8 }, { font, paint })` (in `draw-centered-text.ts`) centres the text in `rect` and shrinks it, never grows it, so its measured glyph width and the font size fill at most `maxShare` of the rect's width and height; `fittedScale(font, label)` is the pure part its test checks. Line Siege draws every monster's health with it; the template draws the continue's moves-left label with it.
- **Standalone digits and Latin**: `drawCenteredText(canvas, { text, cx, y }, { font: kit.numberFont, paint: kit.fill })`. Persian and Sorani digits need no shaping, so `drawText` is right for them (verified on device: `۱۲` in Vazirmatn). Text width comes from glyph widths (`font.getGlyphWidths(font.getGlyphIDs(text))`): `SkFont.measureText` is not implemented in the CanvasKit build that Jest and Node use.
- **Words in Persian or Sorani**: a Skia Paragraph built on the JS thread, laid out once per text, size and theme, stored in `kit.labels`, drawn inside the picture with `label.paint(canvas, x, y)`. Build with `Skia.ParagraphBuilder.Make({ textDirection: TextDirection.RTL, textAlign: TextAlign.Center })`; for Arabic-script text set `heightMultiplier: 1.5`. `TextDirection.RTL === 0` is falsy and `LTR === 1`: never write `isRtl && TextDirection.RTL`; compare and pick explicitly.
- **Building a label** (JS thread, once per text, size and theme; `makeBoardKit` returns `labels: {}`, so a game that draws words passes `{ ...kit, labels }` to the canvas). Numeric literals keep the kit free of Skia value imports (Node-safe); verified in the CanvasKit golden environment (height 30 for size 20):

  ```ts
  const RTL = 0;    // TextDirection.RTL (LTR is 1)
  const CENTER = 2; // TextAlign.Center
  function makeLabel(skia: SkiaApi, text: string, color: string, width: number, provider?: SkTypefaceFontProvider): SkParagraph {
    const builder = skia.ParagraphBuilder.Make({ textAlign: CENTER, textDirection: RTL }, provider);
    builder.pushStyle({ color: skia.Color(color), fontFamilies: ['Vazirmatn'], fontSize: 20, heightMultiplier: 1.5 });
    builder.addText(text);
    const paragraph = builder.pop().build();
    paragraph.layout(width);
    return paragraph;
  }
  ```

  On device omit `provider` (the system font manager finds the embedded Vazirmatn); in tests pass a `Skia.TypefaceFontProvider.Make()` with `registerFont(typeface, 'Vazirmatn')`.
- **Fonts on device**: `Skia.FontMgr.System().matchFamilyStyle('Vazirmatn', { weight: 400, width: 5, slant: 0 })` gives the typeface for `makeBoardKit`; paragraphs without a provider resolve `fontFamilies: ['Vazirmatn']` through the same manager. The `expo-font` config plugin embeds the TTFs, so the first frame already has the font; never load fonts at runtime on device. Latin display text uses `'Lilita One'` or `'Rubik'` the same way.
- **Fonts in tests and Node**: `Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes))` from `apps/<game-id>/assets/fonts/Vazirmatn-Regular.ttf`, and a `Skia.TypefaceFontProvider` for paragraphs (Skia's Jest setup mocks `useFonts`/`matchFont` to `null`).

## Particles and effects

`sampleParticle(burst, index, ageMs)` is stateless: every particle position is a pure function of the burst spec, its index and its age, with direction and speed from `hashU32(seed, index)` and 16 committed unit vectors (no `Math.cos`). So bursts replay identically, render at any t in goldens and cost nothing when the clock stops. Bursts are tracks (`channel: 'burst'`), which is how reduced motion removes them. Use `burst.ageMs` for the age and draw only while `isPlaying(burst)` (`ageMs > 0` and `progress < 1`), like every effect layer (see "The rules of draw()").

Shake: a short track whose values offset the whole board with `canvas.translate`; drop it under reduced motion.

## Many sprites: Atlas

Up to about a hundred shapes: draw calls in the Picture. More than a few hundred identical sprites (Halo Drift): pre-render the sprites once per theme into one image (the sprite cache of the art skill, keyed by palette, scheme, colour-blind flag, cell size and pixel ratio), then draw them as one atlas call. Inside a Picture that is `canvas.drawAtlas(sheet, srcs, xforms, kit.fill)` with `SkRSXform`s built once in the kit (`skia.RSXform(1, 0, 0, 0)`) and updated in `draw` with `xform.set(scale, 0, x, y)` (verified in CanvasKit); as a declarative node it is `<Atlas image={sheet.image} sprites={…} transforms={…} />` with `useRSXformBuffer`. An atlas is one draw call. Dispose of pre-rendered images (`.dispose()`) when the theme or palette changes.

## Performance

- Keep one frame in the low thousands of draw calls at most. Each game's `draw-board.test.ts` asserts its own budget on the busiest frame of a turn (the template: 250, Line Siege: 400); no game may exceed 1,000. Raising a budget needs a frame-recorder report from the owner's phone showing a hitch rate ≤ 10 ms/s.
- Recording a Picture costs about one command per draw call; keep static layers cheap (one `drawColor`, simple rects) or cache them.
- Never trigger a React render per frame: HUD numbers change on events only.
- Measured on the simulator: 64 rounded rects + 200 particles + a sim held the 60 fps cap; about 265 draw calls re-recorded every frame held 60 fps. Profile Release builds only.

## Toybox framing and accessibility

- The board area of S5 sits below the Toybox game top bar with margins 4 / 14 / 40 (top / sides / bottom) and belongs to the game: no banner and no stickers over it. The Toybox mockup only draws a dashed placeholder there, so board pixels are proven by this skill's pixel goldens, not by the S5 design screenshot (the visual-parity compare masks the board area).
- Style roles a board may reuse to feel like Toybox: board `sunken` fill with `outline` stroke 3; cell grid `inkSoft` at 35 % opacity, stroke 1.5, radius 5; blocks `accent` with `outline` 2.5; beams and bursts `pop`; ghost moves `inkSoft` stroke 2.5 dashed 4 5; direction arrows `ink` stroke 3.5, round.
- The hex values in the templates and in the Line Siege example are neutral placeholders. For a real game, fill the `light` and `dark` sets from the game's Toybox paints (the `toybox-design-system` skill owns them) through the style roles above, so the board sits in the S5 frame without a seam. Line Siege's paints, for example: light ground `#A5DAF3`, sunken `#D3ECF8`, ink/outline `#1D1B3A`, inkSoft `#43406A`, accent `#FF6B4A`, pop `#FFD23F`; dark ground `#1B1943`, sunken `#221F52`, ink `#F4F2FF`, inkSoft `#B9B4EA`, outline `#E4E0FF`, accent `#FF7D5E`, pop `#FFD84D`. Keep the colour-blind sets CVD-safe, then re-run the golden review.
- Skia content is invisible to VoiceOver. `BoardCanvas` renders the canvas with `accessible`, `accessibilityRole="image"` and `accessibilityLabel` = `t()` of `board.describe(view)` (for example "Level 12, 3 monsters, your turn"). The `describe` id is a catalog key (`<game-id>.board.summary`) that must exist in the game's four catalogs, with counted values named `…Count` and used as plurals (`{piecesCount, plural, one {# piece} other {# pieces}}`).
- No `Pressable` inside the board's `GestureDetector`: the canvas is its only child; Shell controls are siblings.

## Line Siege: the paint list and shape rules

Line Siege v1 draws, top to bottom: the lanes band (one lane per board column, half a cell per lane row, alternate lanes at 70 % opacity), the wall between the lanes and the board with the hearts on it, the 8x8 board, and the 3-slot tray below (portrait) or beside it (wide). Its `board-palettes.json` tokens and what each paints:

| Token | Paints | Shape rule |
|---|---|---|
| `background` | the canvas behind everything | opaque |
| `lane` | the lanes band | alternate lanes at 70 % |
| `wall` | the wall band, and the ink edge of every block, monster, tray slot, beam and ring | the board's `edge` token |
| `cell` | an empty board cell (translucent over `background`) | rounded square |
| `block` | a placed block and the blocks shown in the tray | rounded square with a `wall` edge |
| `ghost` | the dragged block over the hovered cell, and the hinted move's cells | translucent `block` with a `wall` edge |
| `beam` | a cleared column's beam up its lane, and a monster's hit flash | a bar with a `wall` edge |
| `shock` | the shockwave band sweeping up the lanes (and the continue's push-back) | translucent band |
| `number` | monster health digits (`drawFittedText`) | text |
| `tray` | the tray slots | rounded square with a `wall` edge |
| `heart` | the hearts on the wall | filled heart while kept, outline once lost |
| `normal` | a normal monster (violet) | pill with a thin `wall` edge |
| `armoured` | an armoured monster (slate) | squarer body with a thick `wall` ring |
| `fast` | a fast monster (pink) | pill with a chevron pointing at the wall |

The three kinds differ by shape as well as colour, so they stay apart in every set, and the colour-blind sets use Okabe–Ito (normal `#CC79A7`, armoured `#56B4E9`, fast `#E69F00`, block `#0072B2`, heart `#D55E00`, beam `#F0E442`). Its `board-contrast.json` declares: the digits on each kind (text, 4.5:1); the wall on the background and the lanes and the hearts on the wall (graphics, 3:1); the block, ghost and tray on their ground, the beam and each kind on the lanes (edged shapes); and `normal, armoured, fast, block` as one `distinct` list. The effect layers (beam, shock, flash, burst, shake) wait for their track (`isPlaying`), so moment 0 of a golden shows the board before the move plays.

## The rules shape the templates assume (Tap Flip)

Every game template of the skills targets one template game, Tap Flip, so the rules templates (`game-rules-engine`), these board templates and the input template (`board-gestures-and-input`) compile together in one app. A lit cell flips itself and its four neighbours; the board is won when every cell is dark. The board templates expect these rules types:

```ts
// apps/<game-id>/src/rules/<game-id>-types.ts
export type Cell = 0 | 1; // 0 = dark, 1 = lit
export type TapFlipState = { readonly cols: number; readonly rows: number; readonly cells: readonly Cell[]; readonly moves: number; readonly maxMoves: number };
export type TapFlipMove = { readonly kind: 'flip'; readonly col: number; readonly row: number };
export type TapFlipEvent =
  | { readonly kind: 'cells-flipped'; readonly cells: readonly number[] }
  | { readonly kind: 'board-cleared' }
  | { readonly kind: 'moves-added'; readonly count: number };
```

The template board draws the grid (lit cells in `lit` with an `edge` ink outline and a star `mark`), turns each flipped cell over (`flip` track, the first carries the `flip` sound and a light haptic), flashes a `glow` and a particle burst when the board clears, pops the moves-left label when a continue adds moves (`bonus`), and rings hinted cells from `frame.highlight.hinted` (its `targetsOfMove` returns the flipped cell). For a real game, replace the view, the events and the layers, keep the structure and the tests, and imitate Line Siege for anything bigger.

Events are past tense and carry every id and from/to value the animation needs: never "go look at the state".
