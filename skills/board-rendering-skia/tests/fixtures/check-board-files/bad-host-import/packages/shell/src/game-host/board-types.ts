// packages/shell/src/game-host/board-types.ts
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { FxSample } from '@e07/game-kit/timeline/sample.ts';
import type {
  SkCanvas,
  SkColor,
  SkFont,
  SkPaint,
  SkParagraph,
  SkPath,
  Skia,
} from '@shopify/react-native-skia';

/** Finger state on the UI thread (drag ghosts, hover highlights). Never goes through React. */
export type PointerSample = {
  readonly isDown: boolean;
  readonly x: number;
  readonly y: number;
  readonly hover: BoardTarget | null;
  readonly dragFrom: BoardTarget | null;
};

/** The Skia API object (device module, Jest CanvasKit mock, or headless getSkiaExports().Skia). */
export type SkiaApi = typeof Skia;

export const IDLE_POINTER: PointerSample = {
  isDown: false,
  x: 0,
  y: 0,
  hover: null,
  dragFrom: null,
};

/** Everything that changes per frame on the UI thread: the timeline sample plus the pointer. */
export type BoardFx = FxSample & { readonly pointer: PointerSample };

/**
 * What the board host highlights: UI state held by the host, never game state and never a move
 * (bots, sims, the witness, par, undo and the move counters never see it). It changes on taps and
 * hints only, so it travels as a prop and reaches draw() as frame.highlight.
 */
export type BoardHighlight = {
  /** The target a tap in one of GameEngine.selectRegions selected (Line Siege: a tray slot). */
  readonly selected: BoardTarget | null;
  /** The targets of the hinted move (GameBoard.targetsOfMove of controller.hintedMove()). */
  readonly hinted: readonly BoardTarget[];
};

/** Nothing selected, nothing hinted. */
export const EMPTY_HIGHLIGHT: BoardHighlight = { selected: null, hinted: [] };

/** Palette tokens resolved to Skia colours once per theme (light/dark/colour-blind). */
export type BoardColors<TToken extends string> = {
  readonly scheme: 'light' | 'dark';
  readonly isColorBlind: boolean;
  readonly color: Readonly<Record<TToken, SkColor>>;
};

/** Skia objects built once on the JS thread and reused every frame (no per-frame allocation). */
export type RenderKit = {
  /** Scratch fill paint: set colour/alpha immediately before each draw call. */
  readonly fill: SkPaint;
  /** Scratch stroke paint. */
  readonly stroke: SkPaint;
  /** Bundled font for digits and Latin via drawText (no shaping needed). */
  readonly numberFont: SkFont | null;
  /** Unit-size (0…1) paths, drawn with canvas.scale/translate. */
  readonly paths: Readonly<Partial<Record<string, SkPath>>>;
  /** Shaped, laid-out paragraphs for Arabic-script or multi-word text. */
  readonly labels: Readonly<Partial<Record<string, SkParagraph>>>;
};

/** The six inputs of draw(), grouped to respect max-params 3. */
export type DrawFrame<TView, TToken extends string> = {
  readonly view: TView;
  readonly fx: BoardFx;
  /** The host's selection and hinted targets (EMPTY_HIGHLIGHT when there are none). */
  readonly highlight: BoardHighlight;
  readonly colors: BoardColors<TToken>;
  readonly layout: BoardLayout;
  readonly kit: RenderKit;
};

export type LayoutInput<TView> = {
  readonly width: number;
  readonly height: number;
  readonly view: TView;
  readonly isMirrored: boolean;
};

/** Digit and number formatting from the Shell's i18n (docs on i18n), applied in toView. */
export type ViewFormat = { readonly formatNumber: (value: number) => string };

/** A catalog message id plus values; the Shell renders it with t() for the canvas a11y label. */
export type A11yMessage = {
  readonly id: string;
  readonly values: Readonly<Record<string, number | string>>;
};

/**
 * The rendering members a game module provides (apps/<game>/src/board). TMove is only needed by
 * boards that implement targetsOfMove.
 */
export type GameBoard<TState, TView, TToken extends string, TMove = unknown> = {
  /** Spec 10 "declares whether the board mirrors in RTL" (default false). */
  readonly isMirroredInRtl: boolean;
  /** JS thread, pure: state → flat, serialisable view with digits already localised. */
  readonly toView: (state: TState, format: ViewFormat) => TView;
  /** Worklet: canvas size → layout. Used by draw AND hit-testing. */
  readonly layout: (input: LayoutInput<TView>) => BoardLayout;
  /** Worklet: paints one frame. Must not allocate Skia objects or read clocks. */
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  /** JS thread: build unit paths once per kit (Skia.PathBuilder). */
  readonly buildPaths: (skia: SkiaApi) => Readonly<Partial<Record<string, SkPath>>>;
  /** Spoken summary for VoiceOver (Skia content is invisible to VoiceOver). */
  readonly describe: (view: TView) => A11yMessage;
  /**
   * Points the gesture layer lifts the drag pointer above the finger (hover, ghost and drop
   * target alike); default 0. A board with a lift keeps at least that much canvas below its last
   * row, so the edge rows stay reachable.
   */
  readonly dragLiftPt?: number;
  /** Optional: the board targets a move touches, so the host can outline the hinted move. */
  targetsOfMove?(state: TState, move: TMove): readonly BoardTarget[];
};
