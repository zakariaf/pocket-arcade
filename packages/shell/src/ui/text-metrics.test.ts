// packages/shell/src/ui/text-metrics.test.ts
import { chromeBaseline, lineMetricsOf } from './text-metrics.ts';

describe('text metrics (Chrome layout of the Toybox faces)', () => {
  it('rounds the ascent and descent the way the references were laid out', () => {
    expect(lineMetricsOf('Vazirmatn-Bold', 30)).toStrictEqual({ ascent: 31, content: 47 });
    expect(lineMetricsOf('Rubik-Regular', 15)).toStrictEqual({ ascent: 14, content: 18 });
  });

  it('puts the baseline of a stat-list value 4.7 pt under the key baseline offset (S10 en)', () => {
    const value = chromeBaseline('LilitaOne', 22, 24.2);
    const key = chromeBaseline('Rubik-Regular', 15, 19.8);

    expect(value - key).toBeCloseTo(4.7, 1);
  });

  it('falls back to Rubik for an unknown family', () => {
    expect(lineMetricsOf('Unknown', 15)).toStrictEqual({ ascent: 14, content: 18 });
  });
});
