#!/usr/bin/env node
// Fake Android emulator for the self-test: "-avd <name> -port <port> ..." adds a booted emulator
// emulator-<port> running that AVD to the shared fake state, then exits (the real one keeps running).
import { done, loadState, logCall, saveState } from './fake-android-state.mjs';

const args = process.argv.slice(2);
logCall('emulator', args);
const state = loadState();
const name = args[args.indexOf('-avd') + 1];
const port = args[args.indexOf('-port') + 1];
if (!name || !port) done('fake emulator: needs -avd and -port\n', 1);
if (!state.avds.includes(name)) done(`PANIC: Unknown AVD name [${name}]\n`, 1);
state.emulators = [...state.emulators, { serial: `emulator-${port}`, avd: name, state: 'device' }];
state.booted = true;
saveState(state);
done('');
