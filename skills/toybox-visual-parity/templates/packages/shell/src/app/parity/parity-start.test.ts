// packages/shell/src/app/parity/parity-start.test.ts
import { PARITY_PLANS } from './parity-plans.ts';
import { isHeldParityStart, parityInitialState } from './parity-start.ts';

describe('parityInitialState', () => {
  it('opens Home alone', () => {
    expect(parityInitialState(PARITY_PLANS['s4-home'])).toStrictEqual({
      routes: [{ name: 'Home' }],
    });
  });

  it('puts every other start on top of Home', () => {
    expect(parityInitialState(PARITY_PLANS['s8-levels'])).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Levels' }],
    });
  });

  it('resumes the saved level run for the Game frames', () => {
    expect(parityInitialState(PARITY_PLANS['s6-pause'])).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }],
    });
  });

  it('opens a Settings page above Settings', () => {
    expect(parityInitialState(PARITY_PLANS['s11b-about-and-credits'])).toStrictEqual({
      index: 2,
      routes: [{ name: 'Home' }, { name: 'Settings' }, { name: 'About' }],
    });
  });

  it('leaves first-run frames and held startup states to the Shell', () => {
    expect(parityInitialState(PARITY_PLANS['s2-language-choice'])).toBeUndefined();
    expect(parityInitialState(PARITY_PLANS['s1-splash'])).toBeUndefined();
    expect(isHeldParityStart(PARITY_PLANS['s1-splash'])).toBe(true);
    expect(isHeldParityStart(PARITY_PLANS['s3-consent-moment'])).toBe(true);
    expect(isHeldParityStart(PARITY_PLANS['s4-home'])).toBe(false);
  });
});
