#!/usr/bin/env node
// Fake "maestro --device <udid> --driver-host-port <port> hierarchy" for the self-test: prints
// scenario.hierarchy (a JSON file relative to the fixture folder) after a line of noise, as the real
// CLI may, with the marker parity.launch.<nonce> of the last launch added (the fake xcrun writes the
// nonce to $FAKE_PARITY_STATE), as the app's parity root renders it. scenario.otherSession answers
// instead when scenario.requireArgs were not passed (another simulator's driver: no marker of this
// launch), and scenario.omitNonce leaves the marker out. scenario.omitNonceDumps: n leaves it out of
// the first n dumps of each launch only (XCUITest answering before the app's tree is attached).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const scenario = existsSync('scenario.json') ? JSON.parse(readFileSync('scenario.json', 'utf8')) : {};
if (!process.argv.includes('hierarchy')) process.exit(64);
// scenario.requireArgs: arguments this session must pass (the driver port). Without them the call
// reaches "another session's driver", which answers with a screen that is not this app's.
const argv = process.argv.slice(2).join(' ');
const other = scenario.requireArgs && !argv.includes(scenario.requireArgs.join(' '));
const json = JSON.parse(readFileSync(other ? scenario.otherSession : scenario.hierarchy, 'utf8'));
const state = process.env.FAKE_PARITY_STATE && existsSync(process.env.FAKE_PARITY_STATE) ? JSON.parse(readFileSync(process.env.FAKE_PARITY_STATE, 'utf8')) : null;
// Dumps so far of this launch, counted next to the launch state the fake xcrun writes.
let isEarlyDump = false;
if (scenario.omitNonceDumps && process.env.FAKE_PARITY_STATE && state?.nonce) {
  const countPath = `${process.env.FAKE_PARITY_STATE}.dumps.json`;
  const counts = existsSync(countPath) ? JSON.parse(readFileSync(countPath, 'utf8')) : {};
  counts[state.nonce] = (counts[state.nonce] ?? 0) + 1;
  writeFileSync(countPath, JSON.stringify(counts));
  isEarlyDump = counts[state.nonce] <= scenario.omitNonceDumps;
}
if (!other && !scenario.omitNonce && !isEarlyDump && state?.nonce) {
  json.children = [...(json.children ?? []), { attributes: { accessibilityText: state.nonce, 'resource-id': `parity.launch.${state.nonce}`, bounds: '[0,0][1,1]' }, children: [] }];
}
process.stdout.write(`Running on e07-parity\n${JSON.stringify(json, null, 1)}`);
