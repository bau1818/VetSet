import { chromium } from 'playwright-core';
import sharp from 'sharp';
const URL = process.argv[2] ?? 'http://localhost:8765/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('requestfailed', (r) => errs.push('failed ' + r.url()));
  p.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.goto(URL, { waitUntil: 'networkidle' });
  // load lazy images
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight),
    height: document.body.scrollHeight,
  }));
  console.log(name, JSON.stringify({ ...info, errs }));
  await p.screenshot({ path: `work/page-${name}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
