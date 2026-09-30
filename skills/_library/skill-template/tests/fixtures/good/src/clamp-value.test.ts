import { clampValue } from './clamp-value.ts';

it('keeps a value inside the range', () => {
  expect(clampValue(12, { min: 0, max: 10 })).toBe(10);
});
