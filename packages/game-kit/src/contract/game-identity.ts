// packages/game-kit/src/contract/game-identity.ts
/**
 * Spec 10 IDENTITY: the id and the texts that name the game. The logo (LOGO_ART), the palette and
 * the sound set are typed by the Shell and live in `presentation` (see shell-game-module.ts).
 */
export type GameIdentity = {
  /** kebab-case; equals apps/<id>, GameConfig.id and the save document's gameId. */
  readonly id: string;
  /** Catalog key of the in-game title (store names per language are in game.config.ts). */
  readonly nameId: string;
  /** Catalog key of the S7 win title, '<id>.win-title' ("The wall holds!"). */
  readonly winTitleId: string;
  /** Catalog key of the tagline under the name on S1, S4 and S11b, '<id>.tagline'. */
  readonly taglineId: string;
};
