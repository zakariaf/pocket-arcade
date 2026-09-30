import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [{ script: 'check-sample.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] }]);
