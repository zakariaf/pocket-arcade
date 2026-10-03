// packages/shell/src/services/save/checksum.test.ts
import fc from 'fast-check';

import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';

describe('fnv1a32', () => {
  // spec 8.6: "The previous good copy is kept as a backup. A damaged save falls back to it
  // (S14)." The checksum is how a damaged row is told apart from a good one.
  it('gives the pinned FNV-1a 32 test vectors (spec 8.6)', () => {
    expect(fnv1a32('')).toBe('811c9dc5');
    expect(fnv1a32('a')).toBe('e40c292c');
  });

  it('changes when one character of a save row changes', () => {
    expect(fnv1a32('{"schemaVersion":1}')).not.toBe(fnv1a32('{"schemaVersion":2}'));
  });

  it('gives 8 lowercase hex characters for any text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(fnv1a32(text)).toMatch(/^[0-9a-f]{8}$/);
      }),
    );
  });
});
