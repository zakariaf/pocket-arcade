import { execFileSync } from 'node:child_process';

export const udid = execFileSync('xcrun', ['simctl', 'create', 'Test Phone', 'iPhone 17 Pro Max']);
