// test/integration/i18n/start-shell-imports.test.ts
// Guardrail: Hermes has no Intl.PluralRules or Intl.Locale, so the forced polyfills must be the
// first thing start-shell.ts evaluates. It reads the file with node:fs, so it lives in the root
// test/ folder (the only place with Node types).
import { readFileSync } from 'node:fs';

describe('start-shell.ts', () => {
  it('imports the Intl polyfills before any other module', () => {
    const source = readFileSync('packages/shell/src/app/start-shell.ts', 'utf8');
    const firstImport = source.split('\n').find((line) => line.startsWith('import '));
    expect(firstImport).toBe("import '@e07/shell/i18n/intl-polyfills.ts';");
  });
});
