// packages/shell/src/services/ads/fullscreen-ad.ts
// iOS does not background the app for GMA fullscreen ads, so AppState never changes:
// the Shell must pause the game loop and audio itself.
export type GameLifecycle = {
  readonly suspend: (reason: 'fullscreen-ad') => void; // stop frame callbacks, suspend AudioContext
  readonly resume: (reason: 'fullscreen-ad') => void; // resume with clamped dt
};

export async function runFullscreenAd<T>(
  lifecycle: GameLifecycle,
  show: () => Promise<T>,
): Promise<T> {
  lifecycle.suspend('fullscreen-ad');
  try {
    return await show();
  } finally {
    lifecycle.resume('fullscreen-ad');
  }
}
