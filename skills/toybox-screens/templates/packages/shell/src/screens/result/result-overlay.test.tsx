// packages/shell/src/screens/result/result-overlay.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ResultOverlay } from './result-overlay.tsx';

import type {
  DailyResult,
  EndlessResult,
  LoseResult,
  ResultActions,
  WinResult,
} from './result-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

function actions(): ResultActions {
  return {
    onNext: jest.fn(),
    onReplay: jest.fn(),
    onLevels: jest.fn(),
    onTryAgain: jest.fn(),
    onHome: jest.fn(),
    onContinue: jest.fn(),
    onOpenPremium: jest.fn(),
  };
}

const WIN: WinResult = {
  kind: 'win',
  modeText: 'Level 12',
  scoreText: '1,840',
  isNewBest: true,
  isReducedMotion: false,
  stars: 3,
  winTitle: 'The wall holds!',
  progressText: 'Monsters 10 / 10',
  score: 1840,
  bestScore: 1840,
  movesCount: 7,
  par: 7,
  nudgePriceText: '€1.99',
  actions: actions(),
};

const LOSE: LoseResult = {
  kind: 'lose',
  logo: LOGO,
  modeText: 'Level 12',
  isReducedMotion: false,
  loseReason: 'The monsters broke through',
  continueOffer: 'ad',
  actions: actions(),
};

const DAILY: DailyResult = {
  kind: 'daily',
  modeText: 'Daily – 27 Sep',
  scoreText: '1,840',
  isNewBest: false,
  progressText: 'Monsters 10 / 10',
  streakDays: 5,
  isReducedMotion: false,
  actions: actions(),
};

const ENDLESS: EndlessResult = {
  kind: 'endless',
  modeText: 'Endless',
  scoreText: '1,840',
  isNewBest: false,
  bestScore: 4210,
  isReducedMotion: false,
  actions: actions(),
};

/** iPhone 16 Pro: 62 pt status bar, 34 pt home indicator. */
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

/** The bottom padding of the result's scrolling body (ScreenBody's content container). */
function bodyBottomPadding(): unknown {
  const [body] = screen.container.queryAll(
    (node) => node.props['contentContainerStyle'] !== undefined,
  );
  return StyleSheet.flatten(body?.props['contentContainerStyle']).paddingBottom;
}

/** A Chip or Sticker aligns itself to the start: only a centred row around it centres it. */
function expectCentredRow(testID: string): void {
  const part = screen.getByTestId(testID, { includeHiddenElements: true });
  // allow-style-assertion: the row is the fix for chips and stickers left-aligned on the device.
  expect(part.parent).toHaveStyle({ flexDirection: 'row', justifyContent: 'center' });
}

describe('ResultOverlay', () => {
  it('draws every S7 win element with its design testID', async () => {
    await renderWithShell(<ResultOverlay model={WIN} />);

    for (const testID of [
      'result.screen',
      'result.mode-chip',
      'result.stars-3',
      'result.title',
      'result.win-sticker',
      'result.score-card',
      'result.score-card.label',
      'result.score-card.value',
      'result.score-card.new-best',
      'result.score-card.progress-line',
      'result.next-button',
      'result.replay-button',
      'result.levels-button',
      'result.premium-button',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('result.score-card.moves-line')).toHaveTextContent('7 moves – par 7');
    expect(screen.queryByTestId('result.score-card.score-line')).toBeNull();
    // VoiceOver stays inside the overlay instead of wandering onto the finished board.
    const modal = screen.container.queryAll(
      (node) => node.props['accessibilityViewIsModal'] === true,
    );
    expect(modal).toHaveLength(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('prints the score line with the best on a level rated by score (L3)', async () => {
    await renderWithShell(
      <ResultOverlay model={{ ...WIN, movesCount: 12, par: null, score: 1840, bestScore: 2010 }} />,
    );

    expect(screen.getByTestId('result.score-card.score-line')).toHaveTextContent(
      'Score 1,840 – best 2,010',
    );
    expect(screen.queryByTestId('result.score-card.moves-line')).toBeNull();
    expect(screen.queryByText(/moves|par/)).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('centres the mode chip and the stickers in rows (Chip and Sticker align themselves to the start)', async () => {
    const view = await renderWithShell(<ResultOverlay model={WIN} />);
    expectCentredRow('result.mode-chip');
    expectCentredRow('result.win-sticker');
    await view.rerender(<ResultOverlay model={DAILY} />);
    expectCentredRow('result.mode-chip');
    expectCentredRow('result.streak-sticker');
    for (const model of [LOSE, ENDLESS]) {
      await view.rerender(<ResultOverlay model={model} />);
      expectCentredRow('result.mode-chip');
    }
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("keeps the last key's hard shadow inside the scrolling body on a phone (home indicator 34 pt)", async () => {
    // Without the Premium nudge the last block is a raised key: a body that ends at the safe area
    // clipped its 5-6 pt shadow. The body runs under the home indicator and ends with 34 pt, so every
    // key stays where the reference draws it (bottom 840 of 874) and its shadow has room.
    for (const model of [{ ...WIN, nudgePriceText: null }, LOSE, DAILY, ENDLESS]) {
      await renderWithShell(
        <SafeAreaProvider initialMetrics={PHONE_METRICS}>
          <ResultOverlay model={model} />
        </SafeAreaProvider>,
      );
      expect(bodyBottomPadding()).toBe(34);
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    }
  });

  it('draws every S7 lose element and continues with an ad', async () => {
    const user = userEvent.setup();
    await renderWithShell(<ResultOverlay model={LOSE} />);

    for (const testID of [
      'result.logo',
      'result.reason-card',
      'result.reason-card.icon',
      'result.reason-card.label',
      'result.continue-offer',
      'result.continue-ad-button',
      'result.continue-note',
      'result.try-again-button',
      'result.levels-button',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    await user.press(screen.getByRole('button', { name: 'Continue – watch an ad' }));

    expect(LOSE.actions.onContinue).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('offers the free continue to Premium owners and nothing once it is used', async () => {
    const view = await renderWithShell(
      <ResultOverlay model={{ ...LOSE, continueOffer: 'premium' }} />,
    );

    expect(screen.getByTestId('result.continue-premium-button')).toBeOnTheScreen();

    await view.rerender(<ResultOverlay model={{ ...LOSE, continueOffer: null }} />);
    expect(screen.queryByTestId('result.continue-offer')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the daily and endless results', async () => {
    const shared = { modeText: 'Daily – 27 Sep', scoreText: '1,840', isNewBest: false };
    const view = await renderWithShell(
      <ResultOverlay
        model={{
          ...shared,
          kind: 'daily',
          progressText: 'Monsters 10 / 10',
          streakDays: 5,
          isReducedMotion: false,
          actions: actions(),
        }}
      />,
    );

    expect(screen.getByTestId('result.daily-title')).toBeOnTheScreen();
    expect(screen.getByTestId('result.streak-sticker')).toBeOnTheScreen();
    expect(screen.getByTestId('result.come-back-note')).toBeOnTheScreen();
    expect(screen.getByTestId('result.home-button')).toBeOnTheScreen();

    await view.rerender(
      <ResultOverlay
        model={{
          ...shared,
          kind: 'endless',
          bestScore: 4210,
          isReducedMotion: false,
          actions: actions(),
        }}
      />,
    );
    expect(screen.getByTestId('result.endless-title')).toBeOnTheScreen();
    expect(screen.getByText('Best 4,210')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
