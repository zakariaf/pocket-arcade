// Wrong: changes every build on the Mac.
import { execFileSync } from 'node:child_process';

execFileSync('xcode-select', ['--switch', '/Applications/Xcode.app']);
