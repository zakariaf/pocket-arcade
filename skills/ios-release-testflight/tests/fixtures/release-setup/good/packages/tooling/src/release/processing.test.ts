// packages/tooling/src/release/processing.test.ts
import {
  buildsPath,
  findDeliveryId,
  isVersionAboveLastRelease,
  lastReleaseVersion,
  processingStateOf,
} from './processing.ts';

describe('findDeliveryId', () => {
  it('finds the delivery UUID wherever altool puts it', () => {
    const json = { 'success-message': 'ok', details: { 'delivery-uuid': '1f2e-33' } };
    expect(findDeliveryId(json)).toBe('1f2e-33');
    expect(findDeliveryId([{ other: 1 }, { deliveryId: 'abc' }])).toBe('abc');
  });

  it('returns null when there is none', () => {
    expect(findDeliveryId({ product: 'x' })).toBeNull();
  });
});

describe('processingStateOf', () => {
  it('reads attributes.processingState of the first build', () => {
    expect(processingStateOf({ data: [{ attributes: { processingState: 'VALID' } }] })).toBe(
      'VALID',
    );
  });

  it('returns null before the build appears', () => {
    expect(processingStateOf({ data: [] })).toBeNull();
  });
});

describe('buildsPath', () => {
  it('filters by app, build number and version', () => {
    expect(buildsPath('6400000000', 8, '1.0.0')).toBe(
      '/v1/builds?filter[app]=6400000000&filter[version]=8&filter[preReleaseVersion.version]=1.0.0',
    );
  });
});

describe('release versions', () => {
  const TAGS = ['line-siege/v1.0.0+7', 'line-siege/v1.0.0', 'line-siege/v1.2.0+9', 'other/v9.0.0'];

  it('ignores build tags and other games', () => {
    expect(lastReleaseVersion(TAGS, 'line-siege')).toBe('1.0.0');
  });

  it('requires a higher version than the last release', () => {
    expect(isVersionAboveLastRelease('1.0.0', TAGS, 'line-siege')).toBe(false);
    expect(isVersionAboveLastRelease('1.0.1', TAGS, 'line-siege')).toBe(true);
    expect(isVersionAboveLastRelease('1.0.0', [], 'line-siege')).toBe(true);
  });
});
