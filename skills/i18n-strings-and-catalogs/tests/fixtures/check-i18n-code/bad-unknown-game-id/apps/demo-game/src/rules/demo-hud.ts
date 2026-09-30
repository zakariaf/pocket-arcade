// The game's HUD goal (pure rules code): a literal id the Shell shows through gameMessageText.
export function demoGoal(piecesCount: number): { readonly id: string; readonly values: { readonly piecesCount: number } } {
  return { id: 'demo-game.hud.pices-left', values: { piecesCount } };
}
// 'demo-game.not-a-real-key' in a comment is not checked.
