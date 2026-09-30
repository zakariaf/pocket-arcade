// Wrong: stops other agents' simulators too.
import { execFileSync } from 'node:child_process';

execFileSync('xcrun', ['simctl', 'shutdown', 'all']);
