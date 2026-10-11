// packages/tooling/src/release/release-options.test.ts
import {
  archiveArgs,
  ascKeyFile,
  exportArgs,
  parseReleaseArgs,
  readAscIds,
  uploadArgs,
  xcodeAuthArgs,
} from './release-options.ts';

const IDS = { keyId: '2X9R4HXF34', issuerId: 'issuer-uuid', teamId: 'TEAM123456' };

describe('parseReleaseArgs', () => {
  it('reads a store release with notes and known issues', () => {
    const options = parseReleaseArgs([
      ...['--app', 'line-siege', '--variant', 'store'],
      ...['--notes', 'new pack', '--notes', 'hint button', '--known-issue', 'none yet'],
    ]);
    expect(options).toStrictEqual({
      game: 'line-siege',
      variant: { appVariant: 'store', adsMode: 'live' },
      notes: ['new pack', 'hint button'],
      knownIssues: ['none yet'],
      resume: null,
    });
  });

  it('reads where a stopped run resumes, and refuses an unknown point', () => {
    const base = ['--app', 'line-siege', '--variant', 'test'];
    expect(parseReleaseArgs([...base, '--resume', 'processing']).resume).toBe('processing');
    expect(() => parseReleaseArgs([...base, '--resume', 'archive'])).toThrow(
      '--resume archive is not one of build|processing',
    );
  });

  it('requires the variant: a release is never a default', () => {
    expect(() => parseReleaseArgs(['--app', 'line-siege'])).toThrow(
      '--app and --variant are required',
    );
  });

  it('rejects test ads in a store release', () => {
    expect(() =>
      parseReleaseArgs(['--app', 'line-siege', '--variant', 'store', '--ads', 'test']),
    ).toThrow('is not allowed');
  });
});

describe('readAscIds', () => {
  it('names every missing ID and the owner step', () => {
    expect(() => readAscIds({ APPLE_TEAM_ID: 'TEAM123456' })).toThrow(
      'ASC_KEY_ID, ASC_ISSUER_ID not set. Owner step O3',
    );
  });

  it('returns the three IDs', () => {
    const env = { ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', APPLE_TEAM_ID: 'T' };
    expect(readAscIds(env)).toStrictEqual({ keyId: 'K', issuerId: 'I', teamId: 'T' });
  });
});

describe('command arguments', () => {
  it('derives the key path from the key ID without reading the key', () => {
    expect(ascKeyFile('/home/owner', 'ABC')).toBe(
      '/home/owner/.appstoreconnect/private_keys/AuthKey_ABC.p8',
    );
  });

  it('archives for any iOS device with automatic API-key signing', () => {
    const auth = xcodeAuthArgs('/k/AuthKey_2X9R4HXF34.p8', IDS);
    const args = archiveArgs({ workspace: 'ios/LineSiege.xcworkspace', scheme: 'LineSiege' }, auth);
    expect(args).toStrictEqual(
      expect.arrayContaining(['generic/platform=iOS', '-allowProvisioningUpdates', 'archive']),
    );
    expect(args).not.toContain('CODE_SIGNING_ALLOWED=NO');
  });

  it('exports test builds with the internal-only options file', () => {
    const args = exportArgs('LineSiege', { appVariant: 'test', adsMode: 'test' }, []);
    expect(args.join(' ')).toContain('export-options-test.plist');
  });

  it('uploads with --wait and the four identifying flags', () => {
    const meta = {
      appleAppId: '6400000000',
      bundleId: 'io.applander.linesiege',
      buildNumber: 8,
      version: '1.0.0',
    };
    const args = uploadArgs('build/export/LineSiege.ipa', meta, IDS);
    expect(args).toStrictEqual(
      expect.arrayContaining([
        '--upload-package',
        '--apple-id',
        '6400000000',
        '--bundle-version',
        '8',
        '--bundle-id',
        'io.applander.linesiege',
        '--wait',
      ]),
    );
  });
});
