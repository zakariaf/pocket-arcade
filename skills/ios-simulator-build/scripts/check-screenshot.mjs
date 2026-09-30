#!/usr/bin/env node
// check-screenshot.mjs: checks simulator screenshots for the failures a glance must catch: the
// wrong device size, a blank screen (all black, all white or one colour = the app crashed, is still
// loading, or drew nothing), and a light system banner (a notification) covering the top of the
// app. It never replaces looking at the PNG; it catches the obvious.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-screenshot.mjs reports/ios/<game>/smoke-test-test.png
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { dominantColour, lightBannerRows, readPng } from './lib/png.mjs';

// Pixel sizes of the simulator models on the iOS 26.5 runtime (from the device-type profiles).
const DEVICES = {
  'iPhone 17 Pro Max': [1320, 2868],
  'iPhone 17 Pro': [1206, 2622],
  'iPhone 17': [1206, 2622],
  'iPhone Air': [1260, 2736],
  'iPhone 17e': [1170, 2532],
  'iPhone 16 Pro': [1206, 2622],
  'iPhone 16e': [1170, 2532],
};
// The status bar (62 pt of 874-956 pt) is always drawn by iOS, so it is left out of the blank test.
const STATUS_BAR_SHARE = 0.08;
// A real screen has text, buttons or art; 99% of one colour means nothing was drawn. The black
// frame with a spinner that iOS shows right after boot measures 99.9%; a flat splash with a logo
// stays well below 99%.
const BLANK_SHARE = 0.99;
// A notification banner leaves at least this many clean rows (about 7 pt at 3x) in the top band.
const BANNER_MIN_ROWS = 20;

const SPEC = {
  name: 'check-screenshot',
  summary: 'Checks simulator screenshots: the pixel size matches the simulator model, and the screen is not blank (one colour over 99% of the area below the status bar).',
  usage: '[options] <png-or-folder>...',
  options: {
    device: { type: 'string', default: 'iPhone 17 Pro Max', help: `Simulator model whose size is expected (${Object.keys(DEVICES).join(', ')})` },
    size: { type: 'string', help: 'Expected size as WIDTHxHEIGHT in pixels, instead of --device' },
    'no-banner-check': { type: 'boolean', help: 'Skip the system-banner heuristic (only after opening the PNG: the light band is the app\'s own)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'Rules:',
    '  png-size      the image has the pixel size of the simulator model it was taken on',
    '  blank-screen  below the status bar, no single colour covers 99% of the image',
    '  system-banner a light system banner (a notification) covers the top of the app: rows in the top band',
    '                that are light grey from 2.5% to 97.5% of the width but not at the edges (a heuristic;',
    '                --no-banner-check after reading the PNG when the light band is the app\'s own)',
    '',
    'A folder argument checks every .png inside it (not recursive).',
    'Example: node check-screenshot.mjs reports/ios/line-siege --device "iPhone 17 Pro Max"',
  ].join('\n'),
};

function expectedSize(options) {
  if (options.size) {
    const match = /^(\d+)x(\d+)$/.exec(options.size);
    if (!match) fail(`--size ${options.size} is not WIDTHxHEIGHT`, 'Write it like --size 1320x2868.');
    return [Number(match[1]), Number(match[2])];
  }
  const size = DEVICES[options.device];
  if (!size) fail(`unknown device "${options.device}"`, `Use one of: ${Object.keys(DEVICES).join(', ')}, or pass --size.`);
  return size;
}

function collect(paths) {
  const files = [];
  for (const path of paths) {
    let stat;
    try {
      stat = statSync(path);
    } catch {
      fail(`nothing to check: ${path} does not exist`, 'Pass the screenshot PNG (or its folder) that build:ios:sim printed.');
    }
    if (stat.isDirectory()) files.push(...readdirSync(path).filter((name) => name.endsWith('.png')).sort().map((name) => join(path, name)));
    else files.push(path);
  }
  return files;
}

function describe(hex) {
  if (hex === '#000000') return 'black';
  if (hex === '#FFFFFF') return 'white';
  // rgb(242, 242, 242) is React Navigation's default screen background: a screen with no content.
  if (hex === '#F2F2F2') return "#F2F2F2 (React Navigation's default background, so the screen rendered no content)";
  return hex;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals.length === 0) fail('nothing to check: no screenshot given', 'Pass the PNG that build:ios:sim printed, e.g. reports/ios/<game>/smoke-test-test.png.');
  const [width, height] = expectedSize(options);
  const report = createReporter({ name: 'check-screenshot', json: options.json });
  const files = collect(positionals);
  for (const file of files) {
    const shown = toPosix(relative(process.cwd(), file)) || file;
    const image = readPng(file);
    if (image.width !== width || image.height !== height) {
      report.problem({ file: shown, rule: 'png-size', message: `is ${image.width}x${image.height}, expected ${width}x${height} (${options.size ?? options.device})`, fix: 'Take the screenshot on the e07- simulator of the expected model, or pass the model it was taken on with --device.' });
    }
    const top = Math.round(image.height * STATUS_BAR_SHARE);
    const { hex, share } = dominantColour(image, { top });
    if (share >= BLANK_SHARE) {
      report.problem({ file: shown, rule: 'blank-screen', message: `${(share * 100).toFixed(1)}% of the screen is ${describe(hex)}: the app crashed, is still loading or drew nothing`, fix: 'Open the PNG, read apps/<game>/build/logs/, relaunch with simctl launch --terminate-running-process, wait for the ready signal, and screenshot again.' });
    }
    const bannerRows = options['no-banner-check'] ? 0 : lightBannerRows(image);
    if (bannerRows >= BANNER_MIN_ROWS) {
      report.problem({ file: shown, rule: 'system-banner', message: `a light system banner (a notification, ${bannerRows} rows) covers the top of the app, so the screenshot does not show the app's own top`, fix: 'Dismiss the notification (wait until it slides away, or swipe it up), take the screenshot again and open it. When the light band is really the app\'s own, rerun with --no-banner-check.' });
    }
  }
  return report.finish({ checked: files.length, unit: 'screenshots' });
});
