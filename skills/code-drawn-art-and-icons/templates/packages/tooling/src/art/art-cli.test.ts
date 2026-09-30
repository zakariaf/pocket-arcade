// packages/tooling/src/art/art-cli.test.ts
import { readCli, usageOf } from './art-cli.ts';

import type { CliSpec } from './art-cli.ts';

const SPEC: CliSpec = {
  command: 'node packages/tooling/src/art/render-art.ts',
  summary: 'Renders the app icon and splash.',
  options: {
    app: { type: 'string', value: '<game-id>', help: 'The game to render' },
    check: { type: 'boolean', help: 'Compare with the committed files' },
  },
  notes: ['Exit codes: 0 done, 1 stale, 2 bad input.'],
};

describe('readCli', () => {
  it('returns the values of known flags', () => {
    expect(readCli(SPEC, ['--app', 'line-siege', '--check'])).toStrictEqual({
      kind: 'run',
      values: { app: 'line-siege', check: true },
    });
  });

  it('prints the usage and exits 0 for --help and -h', () => {
    for (const flag of ['--help', '-h']) {
      const outcome = readCli(SPEC, [flag]);
      expect(outcome.kind === 'exit' && outcome.code).toBe(0);
      expect(outcome.kind === 'exit' && outcome.text.split('\n')[0]).toBe(
        'Usage: node packages/tooling/src/art/render-art.ts [--app <game-id>] [--check]',
      );
    }
  });

  it('refuses an unknown flag with exit 2 and a pointer to --help', () => {
    const outcome = readCli(SPEC, ['--chek']);
    expect(outcome.kind === 'exit' && outcome.code).toBe(2);
    expect(outcome.kind === 'exit' && outcome.text).toContain("Unknown option '--chek'");
    expect(outcome.kind === 'exit' && outcome.text).toContain(`Run: ${SPEC.command} --help`);
  });

  it('refuses a flag without its value and a stray positional', () => {
    expect(readCli(SPEC, ['--app']).kind === 'exit').toBe(true);
    expect(readCli(SPEC, ['line-siege']).kind === 'exit').toBe(true);
  });
});

describe('usageOf', () => {
  it('shows a required flag without brackets', () => {
    const app = { type: 'string', value: '<game-id>', isRequired: true, help: 'The game' } as const;
    expect(usageOf({ ...SPEC, options: { app } }).split('\n')[0]).toBe(
      'Usage: node packages/tooling/src/art/render-art.ts --app <game-id>',
    );
  });

  it('lists every option, --help and the notes', () => {
    expect(usageOf(SPEC).split('\n').slice(4)).toStrictEqual([
      'Options:',
      '  --app <game-id>  The game to render',
      '  --check          Compare with the committed files',
      '  -h, --help       Show this help and exit',
      '',
      'Exit codes: 0 done, 1 stale, 2 bad input.',
    ]);
  });
});
