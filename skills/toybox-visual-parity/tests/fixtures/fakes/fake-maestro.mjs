#!/usr/bin/env node
// Fake "maestro [--driver-host-port <port>] --device <udid> hierarchy" for the self-test: prints
// scenario.hierarchy (a JSON file relative to the fixture folder) after a line of noise, as the real
// CLI may; scenario.otherSession instead when scenario.requireArgs were not passed.
import { existsSync, readFileSync } from 'node:fs';

const scenario = existsSync('scenario.json') ? JSON.parse(readFileSync('scenario.json', 'utf8')) : {};
if (!process.argv.includes('hierarchy')) process.exit(64);
// scenario.requireArgs: arguments this session must pass (the driver port). Without them the call
// reaches "another session's driver", which answers with a screen that is not this app's.
const argv = process.argv.slice(2).join(' ');
const answered = scenario.requireArgs && !argv.includes(scenario.requireArgs.join(' ')) ? scenario.otherSession : scenario.hierarchy;
process.stdout.write('Running on e07-parity\n' + readFileSync(answered, 'utf8'));
