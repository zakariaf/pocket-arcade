// packages/shell/src/screens/how-to-play/use-how-to-play-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useHowToPlayModel } from './use-how-to-play-model.ts';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const PAGES = [
  { titleId: 'tally.goal', bodyId: 'tally.how-to-play.step-1' },
  { titleId: 'tally.goal', bodyId: 'tally.how-to-play.step-2' },
];

async function howToPlay() {
  const renderHowToPlayPicture = jest.fn(() => null);
  const shell = createHostWrapper({
    host: { howToPlayPages: PAGES, renderHowToPlayPicture, howToPlayPictureAspect: 4 / 3 },
  });
  const view = await renderHook(() => useHowToPlayModel(), { wrapper: shell.wrapper });
  return { ...view, renderHowToPlayPicture };
}

describe('useHowToPlayModel', () => {
  it("shows the game's goal, its steps and the game's own picture for each page", async () => {
    const { result, renderHowToPlayPicture } = await howToPlay();
    expect(result.current.goal).toBe('Hit the target exactly.');
    expect(result.current.steps).toStrictEqual([
      'Tap to add one.',
      'Tap the other side to add two.',
    ]);
    expect(result.current.renderPicture).toBe(renderHowToPlayPicture);
    expect(result.current.pictureAspect).toBe(4 / 3);
  });

  it('pages forward and back within the pages', async () => {
    const { result } = await howToPlay();
    for (const press of [result.current.onNext, result.current.onNext]) {
      await act(() => {
        press();
      });
    }
    expect(result.current.stepIndex).toBe(1);

    for (const press of [result.current.onPrevious, result.current.onPrevious]) {
      await act(() => {
        press();
      });
    }
    expect(result.current.stepIndex).toBe(0);
  });

  it('goes back when done and replays the tutorial as a new run', async () => {
    const { result } = await howToPlay();
    result.current.onDone();
    result.current.onReplayTutorial();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Game', { start: 'new', ref: { kind: 'tutorial' } });
  });

  it('opens on step 2 in its parity frame, as one Next would (s13-how-to-play)', async () => {
    startParitySession({
      frame: 's13-how-to-play',
      plan: PARITY_PLANS['s13-how-to-play'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      const { result } = await howToPlay();
      expect(result.current.stepIndex).toBe(1);
      expect(result.current.isReducedMotion).toBe(true);
    } finally {
      endParitySession();
    }
  });
});
