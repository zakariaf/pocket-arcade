# The Shell icon system

## Contents

- The decision: Skia paths rasterized once, shown as tinted images
- The grid and the layer model
- From layers to one path: build-icon-paths.ts
- The Icon component and the rasterizer
- Sizes and colours per component
- Mirroring in RTL
- Tests: unit and golden
- Adding or changing an icon
- What was verified

## The decision

Every Shell icon is data: one SVG path per icon on a 24-unit grid, drawn with the nonzero fill rule, in `packages/shell/src/ui/icons/icon-paths.ts`. `Icon` rasterizes the path with Skia on the CPU (`Skia.Surface.Make`) into a white PNG at the exact pixel size (`size x PixelRatio.get()`), caches it as a `data:image/png;base64,...` URI, and shows it in a native `Image` tinted with `tintColor`. Colour comes from the theme at display time, so a theme change never re-rasterizes. React Native decodes `data:` URIs locally, so no network is involved.

| Option | Verdict | Evidence (Release build, iOS simulator, 90 level tiles) |
|---|---|---|
| Skia `<Canvas>` per icon | Rejected for repeated icons; allowed for at most 8 art pieces per screen | 264 to 280 ms to lay out, +16 MB (about 0.18 MB and 2.8 ms per canvas) |
| **Skia path rasterized to a tinted `Image`** | **Chosen** | 58 ms, +1 to 2 MB; rasterizing 2 icons took 0.4 ms |
| react-native-svg | Rejected | a new native pod, and `SvgUri` fetches over the network (the no-network audit would have to allow it); duplicates Skia |
| Plain Views | Only for trivial shapes (dots, bars, fills) | cannot draw a gear, crown or speaker |
| Emoji, icon fonts, image files | Rejected | Toybox bans emoji; fonts and files are not drawn in code |

Icons at 24 pt on a 3x screen become 72 px PNGs of about 0.3 to 1.4 KB.

## The grid and the layer model

- `viewBox 0 0 24 24`, one colour. Default size 24 pt; components use 12 to 64 pt.
- Each icon in the design is a list of **layers** drawn in order in one colour: `stroke w` (round caps and joins), `fill` (nonzero), `fill even-odd` (the lock body with its keyhole), and filled shapes also get a `stroke 1.4` with a butt cap and round join (it rounds their corners).
- Stroke widths: 2.5 regular, 3.1 bold (check, close, chevron, dash), 3.6 heavy (gear teeth), 1.4 on filled shapes; rating-star edges 1.8 (2.2 on 13 pt mini stars). Strokes scale with the icon.
- Rects and circles of the design are written as exact path data (arcs), so every layer goes straight into `Skia.Path.MakeFromSVGString`.
- The full list is [icon-catalogue.md](icon-catalogue.md); the machine copy is `templates/packages/tooling/src/art/icon-layers.json` (41 icons plus `rating-fill`, `rating-edge`, `rating-edge-mini`).

## From layers to one path

`Icon` fills one nonzero path per icon, so the layers are flattened at build time by `packages/tooling/src/art/build-icon-paths.ts` (headless Skia on CanvasKit, Node 22.18+ type stripping):

1. Each stroke layer becomes an outline: `Skia.Path.Stroke(path, { width, cap, join: round })`.
2. An even-odd fill layer keeps its rule: `Skia.PathBuilder.MakeFromPath(path).setFillType(EvenOdd).build()`.
3. All layers are unioned: `Skia.Path.MakeFromOp(a, b, Union)`.
4. The union is converted to the nonzero rule: `Skia.Path.AsWinding(union)`. Path ops return even-odd paths, and an SVG string loses the fill type; without this step `mail`, `globe`, `theme` and `eye` fill solid.
5. Numbers are rounded to 2 decimals (0.06 px at 3x: invisible, about half the size).
6. The file is written in exactly the form Prettier prints (keys unquoted when they can be, long entries broken after the key unless the key is shorter than 5 characters), so `--check` compares bytes and lint-staged never rewrites it.

Skia enums are passed as numbers (the script imports Skia types only): `StrokeCap` Butt 0, Round 1; `StrokeJoin` Round 1; `FillType` EvenOdd 1; `PathOp` Union 2. Skia 2.6.2 uses the `Path.*` factory and `PathBuilder` APIs; the older `SkPath.stroke()`, `makeAsWinding()` and `setFillType()` log deprecation notices.

Commands (repo root):

```sh
node packages/tooling/src/art/build-icon-paths.ts          # writes packages/shell/src/ui/icons/icon-paths.ts
node packages/tooling/src/art/build-icon-paths.ts --check  # exits 1 when icon-paths.ts is stale
node packages/tooling/src/art/render-icon-sheet.ts --out reports/art/icon-sheet.png   # contact sheet
node packages/tooling/src/art/build-icon-paths.ts --help    # usage; every art script has --help
```

The generated file is about 131 KB (44 entries). Storing layers and stroking them at raster time would need about 10 KB but would change the rasterizer; kept as is.

## The Icon component and the rasterizer

- `icon-raster.ts`: `getIconUri(name, sizePt, pixelRatio)` rasterizes once per name and pixel size and caches forever (a module-level `Map`).
- `icon.tsx`: `<Icon name color size />` renders a native `Image` with `tintColor={color}`, `width = height = size`. It is decorative: the button or row around it carries the accessibility label. Raw `Image` is allowed only in this file (lint rule).
- Colours come from the caller: `theme.colors.icon`, `onPrimary`, `onPop`, `danger`, `textMuted`, `SHELL_COLORS[scheme].toyInk` (printed parts), `.toastText` (toasts), `.success` (score-panel checks).

## Sizes per component

hero cap 26 · button 24 · icon button 24 · home key 30 · row button chevron 22 · row chevron 20 · icon tile 22 (34 pt stat header tile: 20) · toggle knob 15 · segment check 15 · radio 20 · group tab 16 · sticker 18 (xs 14) · toast 20 · note panel 22 · reason line 28 · art tile 36 (Premium art 64) · level-tile lock 16 · flag 12 · week mark 20 (legend 13) · pause key 26 (state 13) · score-panel check 20 · settings footer 18 · rule line 20 · streak label 18 · mini rating stars 13, inline 22, sticker 18, rating rows 34, result 86 / 102 / 86.

## Mirroring

`DIRECTIONAL_ICONS` = `back`, `chevron`, `forward`, `undo`. `Icon` flips them with `transform: [{ scaleX: -1 }]` when the layout direction is RTL (from the direction context), so no call site can forget it. Play, pause, clocks, stars, logos, pictures and the lock never mirror.

## Tests

- **Unit project** (jest-expo): Skia's JSI module does not load ("Native Skia Module failed to correctly install JSI Bindings!"), so the root `jest.setup.ts` mocks the rasterizer: `jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({ getIconUri: () => 'data:image/png;base64,' }))`. The shared `jest.setup.ts` guards that mock with `if (existsSync(join(__dirname, 'packages/shell/src/ui/icons/icon-raster.ts')))` (a `jest.mock` of a module that does not exist yet fails every suite), so it turns itself on once `icon-raster.ts` exists: there is nothing to uncomment in workflow step 2. `check-icons-and-logos.mjs` fails `icon-raster-mock` only when `icon-raster.ts` exists and a repo's `jest.setup.ts` lost the guarded mock, and unit-and-component-tests' `check-test-setup.mjs` fails the same way. `icon.test.tsx` checks mirroring and size there.
- **Golden project** (`@shopify/react-native-skia/jestEnv.js`, CanvasKit): `icon-raster.golden.test.ts` rasterizes every entry to a PNG data URI.
- Components that render a Skia `<Canvas>` (`LogoTile`, `HazardStrip`, `EmptyStatsPicture`) need no mock of their own: the root `jest.setup.ts` (unit-and-component-tests) mocks `@shopify/react-native-skia` centrally for the unit project (every Skia component an inert `Skia<Component>` host element that keeps its props, every `Skia.*` call a placeholder). Never add a partial local `jest.mock('@shopify/react-native-skia', ...)`: it replaces the central mock, and the icon rasterizer (`Skia.Paint()` at load) then crashes the suite. A suite that fails with "Native Skia Module failed to correctly install JSI Bindings" means the repo's `jest.setup.ts` lacks the central mock: restore it from unit-and-component-tests.

## Adding or changing an icon

1. Draw it in the Toybox style: 24 grid, 2.5 round strokes, solid fills with a 1.4 edge, one colour, no text, readable at 20 pt. Look at [icon-catalogue.md](icon-catalogue.md) for neighbours to match.
2. Add its layers to `packages/tooling/src/art/icon-layers.json` under a kebab-case name. Only an arrow that points along the reading direction goes into `directional` (objects, media controls and clocks never do); the 41 Toybox icons keep exactly `back`, `chevron`, `forward`, `undo` there, and `check-icons-and-logos` fails otherwise.
3. Run `build-icon-paths.ts`, then `render-icon-sheet.ts`, and look at the sheet (Read tool) next to `assets/reference/icons-design.png` of this skill.
4. Run the checks. A new Shell icon is a design change: say so in the report.

## What was verified

On 2026-09-28 (Node 26.4, Skia 2.6.2 on CanvasKit): all 44 entries flattened without errors; a contact sheet was inspected; the design layers drawn as SVG in Chrome and the flattened paths drawn in Chrome differed in 3 of 442,368 pixels (pixelmatch, threshold 0.2), so the flattening is faithful; the unit and golden tests passed; the generated file passes Prettier and the repo's ESLint.
