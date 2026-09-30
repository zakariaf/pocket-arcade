#!/usr/bin/env node
// check-sample.mjs: a sample checker (fixture).
const RULE = '__FILL_RULE_ID__';
import { run } from './check-lib.mjs';

run(async () => (RULE ? 0 : 1));
