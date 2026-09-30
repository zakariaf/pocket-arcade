// Wrong: changes the Xcode for every process on the Mac.
import { execFileSync } from 'node:child_process';

execFileSync('sudo', ['xcode-select', '-s', '/Applications/Xcode.app']);
