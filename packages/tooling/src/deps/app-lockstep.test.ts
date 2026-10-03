// packages/tooling/src/deps/app-lockstep.test.ts
import { findLockstepDrift, type AppManifest } from './app-lockstep.ts';

describe('findLockstepDrift', () => {
  it('accepts apps that share every version', () => {
    const manifests = new Map<string, AppManifest>([
      ['line-siege', { dependencies: { expo: '57.0.25', '@e07/shell': '*' } }],
      ['flock-tilt', { dependencies: { expo: '57.0.25', '@e07/shell': '*' } }],
    ]);
    expect(findLockstepDrift(manifests)).toStrictEqual([]);
  });

  it('reports a package pinned differently in two apps', () => {
    const manifests = new Map<string, AppManifest>([
      ['line-siege', { dependencies: { expo: '57.0.25' } }],
      ['flock-tilt', { dependencies: { expo: '57.0.24' } }],
    ]);
    expect(findLockstepDrift(manifests)).toStrictEqual([
      'expo differs between apps: line-siege=57.0.25, flock-tilt=57.0.24',
    ]);
  });
});
