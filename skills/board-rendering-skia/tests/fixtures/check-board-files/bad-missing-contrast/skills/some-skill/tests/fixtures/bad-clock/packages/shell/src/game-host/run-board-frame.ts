// packages/shell/src/game-host/run-board-frame.ts
// A planted bug inside the in-repo skill library: REPO_SCAN_IGNORES keeps it silent.
export function runBoardFrame(info: { readonly timeSinceFirstFrame: number }): number {
  return info.timeSinceFirstFrame;
}
