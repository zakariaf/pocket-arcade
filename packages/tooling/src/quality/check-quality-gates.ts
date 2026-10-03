// packages/tooling/src/quality/check-quality-gates.ts
// device-only: covered by npm run verify (the guardrail step) on every push
// Guardrail: the RESOLVED configs must equal quality-gates.json.
// Run by `npm run verify`; a mismatch means a gate was weakened or quality-gates.json is stale.
import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';

import { diffSubset } from './gate-diff.ts';

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = Readonly<Record<string, Json>>;
type Gates = {
  readonly eslint: {
    readonly linterOptions: Json;
    /** Named sets of resolved rule values, e.g. "logic", "component", "test". */
    readonly ruleSets: Readonly<Record<string, JsonObject>>;
    /** Probe file path (it need not exist) -> name of the rule set it must resolve to. */
    readonly probes: Readonly<Record<string, string>>;
  };
  readonly typescript: {
    readonly shared: JsonObject;
    /** tsconfig path or glob -> options it must resolve to (on top of `shared`). */
    readonly projects: Readonly<Record<string, JsonObject>>;
  };
  readonly jest: { readonly coverageThreshold: JsonObject };
  readonly npmScripts: Json;
  readonly claudeSettings: Json;
  readonly knip: Json;
  readonly lefthook: Json;
  readonly npmrcLines: readonly string[];
};

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const npx = (args: readonly string[]): unknown =>
  JSON.parse(execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

function checkEslint(gates: Gates): readonly string[] {
  return Object.entries(gates.eslint.probes).flatMap(([file, ruleSet]) => {
    const resolved = npx(['eslint', '--print-config', file]) as Record<string, unknown>;
    const rules = gates.eslint.ruleSets[ruleSet] ?? null;
    return [
      ...diffSubset(
        gates.eslint.linterOptions,
        resolved['linterOptions'],
        `eslint(${file}).linterOptions`,
      ),
      ...diffSubset(rules, resolved['rules'], `eslint(${file}).rules`),
    ];
  });
}

function checkTypescript(gates: Gates): readonly string[] {
  // A key may be a glob ("apps/*/tsconfig.json"), so every new app is checked without an edit here.
  return Object.entries(gates.typescript.projects).flatMap(([pattern, options]) => {
    const projects = globSync(pattern);
    if (projects.length === 0) {
      return [`tsc(${pattern}): no tsconfig matches this entry`];
    }
    return projects.flatMap((project) => {
      const resolved = npx(['tsc', '-p', project, '--showConfig']) as Record<string, unknown>;
      const expected = { ...gates.typescript.shared, ...options };
      return diffSubset(expected, resolved['compilerOptions'], `tsc(${project})`);
    });
  });
}

function hasSourceFiles(key: string): boolean {
  const pattern = key.endsWith('/') ? `${key}**/*.{ts,tsx}` : key;
  return globSync(pattern).some((file) => !file.includes('.test.'));
}

function checkJest(gates: Gates): readonly string[] {
  const resolved = npx(['jest', '--showConfig']) as {
    globalConfig: { coverageThreshold: unknown };
  };
  const actual = resolved.globalConfig.coverageThreshold as Readonly<Record<string, unknown>>;
  return Object.entries(gates.jest.coverageThreshold).flatMap(([key, expected]) => {
    if (actual[key] === undefined && key !== 'global' && !hasSourceFiles(key)) {
      return [];
    }
    return diffSubset(expected, actual[key], `jest.coverageThreshold[${key}]`);
  });
}

function checkFiles(gates: Gates): readonly string[] {
  const packageJson = readJson('package.json') as { scripts?: unknown };
  const npmrc = readFileSync('.npmrc', 'utf8').split('\n');
  const lefthook = npx(['lefthook', 'dump', '--format', 'json']);
  return [
    ...diffSubset(gates.npmScripts, packageJson.scripts, 'package.json scripts'),
    ...diffSubset(gates.claudeSettings, readJson('.claude/settings.json'), '.claude/settings.json'),
    ...diffSubset(gates.knip, readJson('knip.json'), 'knip.json'),
    ...diffSubset(gates.lefthook, lefthook, 'lefthook.yml'),
    ...gates.npmrcLines
      .filter((line) => !npmrc.includes(line))
      .map((line) => `.npmrc: missing line "${line}"`),
  ];
}

function main(): number {
  const gates = readJson('quality-gates.json') as Gates;
  const problems = [
    ...checkEslint(gates),
    ...checkTypescript(gates),
    ...checkJest(gates),
    ...checkFiles(gates),
  ];
  for (const problem of problems) {
    console.error(`quality-gates: ${problem}`);
  }
  if (problems.length > 0) {
    console.error(
      'A gate differs from quality-gates.json. Restore the gate; never edit the JSON to match.',
    );
    return 1;
  }
  console.log('quality-gates: all resolved configs match quality-gates.json');
  return 0;
}

process.exitCode = main();
