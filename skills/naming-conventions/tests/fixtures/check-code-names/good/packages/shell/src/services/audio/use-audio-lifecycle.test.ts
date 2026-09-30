// packages/shell/src/services/audio/use-audio-lifecycle.test.ts
type Props = { readonly isFullscreenAdShowing: boolean };

describe('useAudioLifecycle', () => {
  it('keeps a local props alias in a test', () => {
    const props: Props = { isFullscreenAdShowing: false };

    expect(props.isFullscreenAdShowing).toBe(false);
  });
});
