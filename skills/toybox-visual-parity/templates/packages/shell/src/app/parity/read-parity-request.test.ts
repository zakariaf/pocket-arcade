// packages/shell/src/app/parity/read-parity-request.test.ts
import { PARITY_LAUNCH_ARGUMENT, readParityRequest } from './read-parity-request.ts';

import type { SettingsReader } from './read-parity-request.ts';

function settingsWith(values: Readonly<Record<string, unknown>>): SettingsReader {
  return { get: (key) => values[key] };
}

describe('readParityRequest', () => {
  it('returns null for a normal launch', () => {
    expect(readParityRequest(settingsWith({}))).toBeNull();
  });

  it('parses the -parity launch argument', () => {
    const settings = settingsWith({
      [PARITY_LAUNCH_ARGUMENT]:
        'frame=s9-daily-challenge&theme=light&lang=en&game=lineSiege&date=2026-09-27&animations=off',
    });

    expect(readParityRequest(settings)).toMatchObject({
      ok: true,
      request: { frame: 's9-daily-challenge', lang: 'en' },
    });
  });

  it('reports a launch argument that is not text', () => {
    expect(readParityRequest(settingsWith({ parity: 12 }))).toStrictEqual({
      ok: false,
      error: 'the -parity launch argument is not text',
    });
  });

  it('reports a date other than the fixture day, which every drawn date hangs on', () => {
    const settings = settingsWith({
      [PARITY_LAUNCH_ARGUMENT]:
        'frame=s4-home&theme=light&lang=en&game=lineSiege&date=2026-09-28&animations=off',
    });

    expect(readParityRequest(settings)).toStrictEqual({
      ok: false,
      error: "date 2026-09-28 is not the fixture's day 2026-09-27",
    });
  });
});
