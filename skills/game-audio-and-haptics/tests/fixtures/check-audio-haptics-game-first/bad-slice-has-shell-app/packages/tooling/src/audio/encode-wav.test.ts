// packages/tooling/src/audio/encode-wav.test.ts
import { encodeWav } from './encode-wav.ts';

function text(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

describe('encodeWav', () => {
  it('writes a 44-byte RIFF header for 16-bit mono PCM', () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -1]), 48_000);
    const view = new DataView(bytes.buffer);
    expect(bytes).toHaveLength(44 + 3 * 2);
    expect([text(bytes, 0, 4), text(bytes, 8, 12), text(bytes, 36, 40)]).toStrictEqual([
      'RIFF',
      'WAVE',
      'data',
    ]);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('clamps and scales samples to signed 16-bit integers', () => {
    const view = new DataView(encodeWav(new Float32Array([0.5, -2]), 8000).buffer);
    expect(view.getInt16(44, true)).toBe(16384);
    expect(view.getInt16(46, true)).toBe(-32767);
  });
});
