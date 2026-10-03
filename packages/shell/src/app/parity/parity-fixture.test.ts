// packages/shell/src/app/parity/parity-fixture.test.ts
import fixtureSave from './parity-fixture-save.json' with { type: 'json' };
import { PARITY_FIXTURE, parityDateProblem, readParityFixture } from './parity-fixture.ts';

describe('the parity fixture', () => {
  it('is a valid set of save sections on the frames date', () => {
    expect(PARITY_FIXTURE.date).toBe('2026-09-27');
    expect(PARITY_FIXTURE.store).toStrictEqual({ price: 1.99, currency: 'EUR' });
  });

  it('refuses a volume on the 0..1 scale (the save stores integer percent)', () => {
    const broken = { ...fixtureSave, settings: { ...fixtureSave.settings, soundVolume: 0.7 } };

    expect(() => readParityFixture(broken)).toThrow();
  });

  it('refuses a field the save document does not have', () => {
    const broken = { ...fixtureSave, settings: { ...fixtureSave.settings, volume: 70 } };

    expect(() => readParityFixture(broken)).toThrow();
  });

  it('names a request for another day', () => {
    expect(parityDateProblem('2026-09-27')).toBeNull();
    expect(parityDateProblem('2026-09-28')).toBe(
      "date 2026-09-28 is not the fixture's day 2026-09-27",
    );
  });
});
