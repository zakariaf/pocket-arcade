// Wrong: signing files never touch the agent.
import { execFileSync } from 'node:child_process';

execFileSync('security', ['import', 'dist.p12', '-k', 'login.keychain-db']);
