import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blocked, launch, newDemoContext, ORIGIN, ROOT, sleep, stats } from './lib.mjs';
const browser = await launch();
const ctx = await newDemoContext(browser, { mobile: false, width: 1440, height: 900, dsf: 2 });
const LEGS = join(ROOT, 'cache', 'legs.json');
if (existsSync(LEGS)) await ctx.addInitScript((legs) => { if (!localStorage.getItem('vetset:legs:v1')) localStorage.setItem('vetset:legs:v1', legs); }, readFileSync(LEGS, 'utf8'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const [path, name] of [['/', 'desktop-dashboard'], ['/schedule', 'desktop-schedule'], ['/routes?date=2026-10-08&team=team_east', 'desktop-routes']]) {
  await page.goto(ORIGIN + path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(2500);
  await page.waitForFunction(() => { const t = [...document.querySelectorAll('img.leaflet-tile')]; return !t.length || t.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 20000 }).catch(() => console.log('  tiles still loading'));
  await sleep(1500);
  const tiles = await page.evaluate(() => [...document.querySelectorAll('img.leaflet-tile')].map((i) => i.complete && i.naturalWidth).filter(Boolean).length);
  console.log('  tiles loaded', tiles);
  await page.screenshot({ path: join(ROOT, 'out', 'shots-raw', `${name}.png`) });
  console.log('shot', name);
}
console.log('errors', errors.length ? errors : 'none', 'blocked', blocked.size ? [...blocked] : 'none', stats);
await browser.close();
