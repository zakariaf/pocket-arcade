// packages/tooling/src/release/release-upload.test.ts
// Steps 11-12 on stand-ins: no git tag is made, no key is read and App Store Connect is never asked.
import { execFileSync } from 'node:child_process';

import { setWhatsNew } from '@e07/tooling/asc/beta-notes.ts';

import { describeAndTag } from './release-upload.ts';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn(() => '') }));
jest.mock('@e07/tooling/asc/beta-notes.ts', () => ({ setWhatsNew: jest.fn() }));
jest.mock('@e07/tooling/asc/asc-credentials.ts', () => ({ loadAscCredentials: jest.fn() }));
jest.mock('@e07/tooling/asc/asc-jwt.ts', () => ({ createAscJwt: () => 'jwt' }));

const CHECKED = 'Line Siege 1.0.0 (8) · test build\nWhat changed\n- checked in preflight';
const INPUT = {
  options: {
    game: 'line-siege',
    variant: { appVariant: 'test', adsMode: 'off' },
    notes: [],
    knownIssues: [],
    resume: null,
  },
  pre: {
    ids: { keyId: 'KEY', issuerId: 'ISSUER', teamId: 'TEAM' },
    keyFile: '/keys/AuthKey_KEY.p8',
    app: {
      name: 'Line Siege',
      bundleId: 'io.applander.linesiege',
      version: '1.0.0',
      appleAppId: '1',
    },
    whatToTest: CHECKED,
  },
  buildNumber: 8,
  restId: 'build-1',
} as const;

describe('describeAndTag (release steps 11 and 12)', () => {
  afterEach(() => {
    jest.mocked(execFileSync).mockReset();
    jest.mocked(setWhatsNew).mockReset();
  });

  it('sets What to Test to the text preflight checked, then tags the build', async () => {
    await expect(describeAndTag(INPUT, {})).resolves.toBe(CHECKED);
    expect(jest.mocked(setWhatsNew)).toHaveBeenCalledWith('jwt', 'build-1', CHECKED);
    expect(jest.mocked(execFileSync)).toHaveBeenCalledWith('git', ['tag', 'line-siege/v1.0.0+8']);
  });

  it('keeps the resume line when the tag fails after What to Test was set', async () => {
    jest.mocked(execFileSync).mockImplementation(() => {
      throw new Error("fatal: tag 'line-siege/v1.0.0+8' already exists");
    });
    await expect(describeAndTag(INPUT, {})).rejects.toThrow(
      "fatal: tag 'line-siege/v1.0.0+8' already exists\nResume: the build is VALID; rerun with --resume processing to set What to Test and tag it.",
    );
  });
});
