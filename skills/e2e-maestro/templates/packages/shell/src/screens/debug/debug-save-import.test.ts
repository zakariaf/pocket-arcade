// packages/shell/src/screens/debug/debug-save-import.test.ts
// S15's import reads exactly what "Export save as text" writes, through the real save codec.
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { decodeSaveText } from './debug-save-import.ts';

const DOC = createDefaultSaveDoc('line-siege');
/** What S15's Export save shares: JSON.stringify(doc, null, 1). */
const EXPORTED = JSON.stringify(DOC, null, 1);

describe('decodeSaveText', () => {
  it('reads an exported save back as the same document, with the pasted spaces around it', () => {
    expect(decodeSaveText(`\n ${EXPORTED}\n`, 'line-siege')).toStrictEqual({
      kind: 'ok',
      doc: DOC,
    });
  });

  it('refuses text that is not a saved game', () => {
    for (const text of [
      '',
      'hello',
      '[1, 2]',
      '{"gameId": "line-siege"}',
      '{"schemaVersion": 0}',
    ]) {
      expect(decodeSaveText(text, 'line-siege')).toStrictEqual({
        kind: 'error',
        message: expect.stringContaining('not a saved game') as unknown,
      });
    }
  });

  it('refuses a save from a newer app', () => {
    const newer = JSON.stringify({ ...DOC, schemaVersion: 99 });
    expect(decodeSaveText(newer, 'line-siege')).toStrictEqual({
      kind: 'error',
      message: 'This save is from a newer app (format 99); this build reads format 1.',
    });
  });

  it('names the first field that breaks the save format', () => {
    const broken = JSON.stringify({ ...DOC, settings: { ...DOC.settings, theme: 'neon' } });
    const result = decodeSaveText(broken, 'line-siege');
    expect(result.kind === 'error' ? result.message : '').toMatch(
      /^This save does not match the save format: settings\.theme: /,
    );
  });

  it("refuses another game's save", () => {
    const other = JSON.stringify(createDefaultSaveDoc('flock-tilt'));
    expect(decodeSaveText(other, 'line-siege')).toStrictEqual({
      kind: 'error',
      message: 'This save belongs to another game, not line-siege.',
    });
  });
});
