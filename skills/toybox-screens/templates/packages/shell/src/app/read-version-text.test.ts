// packages/shell/src/app/read-version-text.test.ts
// no-shell-context: reads expo-constants only (mocked with the pilot's test build values).
import { readVersionText, versionTextOf } from './read-version-text.ts';

let mockParityBuildNumber: string | null = null;
jest.mock('@e07/shell/app/test-only.ts', () => ({
  TEST_ONLY: { parityBuildNumber: () => mockParityBuildNumber },
}));

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('readVersionText', () => {
  it('joins the marketing version and the build number', () => {
    expect(readVersionText()).toBe('1.0.0 (8)');
  });

  it("shows the design fixture's build number during a parity capture", () => {
    mockParityBuildNumber = '42';
    expect(readVersionText()).toBe('1.0.0 (42)');
    mockParityBuildNumber = null;
  });

  it('shows the version alone when the build number is unknown', () => {
    expect(versionTextOf('1.2.0', undefined)).toBe('1.2.0');
  });
});
