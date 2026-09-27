// Acceptance check for an idea-hunt toy.
// Usage: node check-toy.mjs ../toys/<slug>.html
//
// Loads the toy straight from disk (file://) in the installed Google Chrome,
// with a controlled clock so runs are repeatable, and checks that:
//   - there are no console errors and no requests to anything but file:/data:
//   - scripted input changes the game state compared with the same wait and no input
//     (animation on its own doesn't count)
//   - on a phone-sized touch screen, taps do the same
// The toy must expose window.__toy = { getState(), probes() }, where probes()
// returns [{type:'click', x, y} | {type:'drag', x1, y1, x2, y2}] in page pixels.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve(process.argv[2]);
const slug = path.basename(file, '.html');
const url = pathToFileURL(file).href;
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
fs.mkdirSync(shots, { recursive: true });

const SETTLE_MS = 500;
const RUN_MS = 3000;
const STEP_MS = 250;

async function run(browser, { input, mobile, tag }) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1000, height: 750 } });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });

  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto(url);
  await page.clock.runFor(SETTLE_MS);

  const hasHook = await page.evaluate(() => !!(window.__toy && typeof window.__toy.getState === 'function'));
  let used = 0;
  let skipped = 0;
  if (input && hasHook) {
    const probes = await page.evaluate(() => (window.__toy.probes ? window.__toy.probes() : []));
    for (const p of probes) {
      if (p.type === 'click') {
        if (mobile) await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
      } else if (p.type === 'drag' && !mobile) {
        await page.mouse.move(p.x1, p.y1);
        await page.mouse.down();
        for (let i = 1; i <= 8; i++) {
          await page.mouse.move(p.x1 + ((p.x2 - p.x1) * i) / 8, p.y1 + ((p.y2 - p.y1) * i) / 8);
        }
        await page.mouse.up();
      } else {
        skipped++;
        continue;
      }
      used++;
      await page.clock.runFor(STEP_MS);
    }
  }
  await page.clock.runFor(Math.max(0, RUN_MS - used * STEP_MS));

  const state = hasHook ? JSON.stringify(await page.evaluate(() => window.__toy.getState())) : null;
  const shot = path.join(shots, `${slug}-${tag}.png`);
  await page.screenshot({ path: shot });
  await ctx.close();
  return { tag, errors, external, hasHook, state, probesUsed: used, probesSkipped: skipped, shot };
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const idleA = await run(browser, { input: false, mobile: false, tag: 'desktop-idle' });
const idleB = await run(browser, { input: false, mobile: false, tag: 'desktop-idle-repeat' });
const act = await run(browser, { input: true, mobile: false, tag: 'desktop-input' });
const mIdle = await run(browser, { input: false, mobile: true, tag: 'phone-idle' });
const mAct = await run(browser, { input: true, mobile: true, tag: 'phone-input' });
await browser.close();

const all = [idleA, idleB, act, mIdle, mAct];
const errors = [...new Set(all.flatMap(r => r.errors))];
const external = [...new Set(all.flatMap(r => r.external))];
const result = {
  toy: slug,
  hook: idleA.hasHook,
  noConsoleErrors: errors.length === 0,
  noExternalRequests: external.length === 0,
  respondsToInput: act.hasHook && act.probesUsed > 0 && act.state !== idleA.state,
  respondsToTouch: mAct.hasHook && mAct.probesUsed > 0 && mAct.state !== mIdle.state,
  deterministicWithoutInput: idleA.state !== null && idleA.state === idleB.state,
  probesUsed: { desktop: act.probesUsed, phone: mAct.probesUsed, phoneSkippedDrags: mAct.probesSkipped },
  errors,
  external,
  screenshots: all.map(r => r.shot),
};
result.pass = result.hook && result.noConsoleErrors && result.noExternalRequests && result.respondsToInput;
console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
