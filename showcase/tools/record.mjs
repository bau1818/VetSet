// Drives the demo at phone size. `node record.mjs shots` captures curated screenshots (and warms the
// network cache); `node record.mjs video` records every scene through a Chrome DevTools screencast.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blocked, launch, newDemoContext, ORIGIN, readData, ROOT, scrollElementIntoView, sleep, smoothScrollTo, stats } from './lib.mjs';

const MODE = process.argv[2] ?? 'shots';
const ONLY = process.argv[3]; // optional: run a single scene by name while iterating
const SHOTS = join(ROOT, 'out', 'shots-raw');
const FRAMES = join(ROOT, 'work', 'frames');
const LEGS = join(ROOT, 'cache', 'legs.json');
mkdirSync(SHOTS, { recursive: true });
if (MODE === 'video') {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
}

const browser = await launch();
const ctx = await newDemoContext(browser);
// Start with road drive times already known (captured on the screenshot pass) so no scene waits on routing.
if (existsSync(LEGS)) await ctx.addInitScript((legs) => { if (!localStorage.getItem('vetset:legs:v1')) localStorage.setItem('vetset:legs:v1', legs); }, readFileSync(LEGS, 'utf8'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// ---- screencast ---------------------------------------------------------------------------------
let rec = false;
let n = 0;
let last = null;
const frames = [];
const markers = [];
if (MODE === 'video') {
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    const t = Date.now() / 1000;
    last = { data, t };
    if (rec) {
      const f = join(FRAMES, `${String(n++).padStart(6, '0')}.jpg`);
      writeFileSync(f, Buffer.from(data, 'base64'));
      frames.push({ t, f });
    }
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
}

const shot = async (name) => {
  if (MODE !== 'shots') return;
  await sleep(250);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log('  shot', name);
};

async function scene(name, fn) {
  if (ONLY && ONLY !== name) return;
  console.log('scene', name);
  const start = Date.now() / 1000;
  if (MODE === 'video') {
    if (last) {
      const f = join(FRAMES, `${String(n++).padStart(6, '0')}.jpg`);
      writeFileSync(f, Buffer.from(last.data, 'base64'));
      frames.push({ t: start, f });
    }
    rec = true;
  }
  await fn();
  if (MODE === 'video') {
    await sleep(120);
    rec = false;
  }
  markers.push({ name, start, end: Date.now() / 1000 });
}

const tap = async (locator, hold = 0) => {
  await locator.scrollIntoViewIfNeeded();
  await locator.tap();
  if (hold) await sleep(hold);
};
const go = async (path, settle = 3000) => {
  await page.goto(ORIGIN + path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(settle);
};
const avatar = () => page.locator('header button:has(svg.lucide-chevron-down)');

// ---- pick the cast from the demo data --------------------------------------------------------------
await go('/', 5000);
const data = await readData(page);
const lead = data.clients.find((c) => c.status === 'lead' && data.pets.filter((p) => p.clientId === c.id).length === 1);
const leadPet = data.pets.find((p) => p.clientId === lead.id);
const future = data.appointments.filter((a) => a.date >= '2026-10-06' && !['cancelled', 'no_show'].includes(a.status));
const petsOf = (id) => data.pets.filter((p) => p.clientId === id && p.status === 'active');
const richClient = (needVisit) => (c) =>
  c.status === 'active' && c.accessNotes && petsOf(c.id).length >= 2 && petsOf(c.id).some((p) => p.alerts.length) &&
  data.reminders.some((r) => r.clientId === c.id && ['due', 'contacted'].includes(r.status)) && (!needVisit || future.some((a) => a.clientId === c.id));
const profile = data.clients.find(richClient(true)) ?? data.clients.find(richClient(false));
console.log('cast:', `${lead.firstName} ${lead.lastName} (${leadPet.name}, ${leadPet.species})`, '| profile', profile.firstName, profile.lastName);

// ---- scenes --------------------------------------------------------------------------------------
await scene('dashboard', async () => {
  await sleep(1600);
  await shot('01-dashboard');
  await scrollElementIntoView(page, page.getByText('Today’s routes').first(), 70, 1500);
  await sleep(1800);
  await shot('02-todays-routes');
  await scrollElementIntoView(page, page.getByText('Capacity — next 7 days'), 70, 1500);
  await sleep(1600);
  await shot('03-capacity');
  await scrollElementIntoView(page, page.getByText('Needs attention'), 70, 1300);
  await sleep(1500);
});

await go('/schedule?view=week', 2200);
await scene('schedule', async () => {
  await sleep(1400);
  await shot('03b-schedule-week');
  await smoothScrollTo(page, 640, 1700);
  await sleep(1300);
  await smoothScrollTo(page, 1500, 1700);
  await sleep(1100);
});

await go('/book', 1500);
await scene('book', async () => {
  await sleep(900);
  await tap(page.getByPlaceholder('Search name, pet or phone'), 300);
  await page.getByPlaceholder('Search name, pet or phone').pressSequentially(lead.lastName.slice(0, 4), { delay: 120 });
  await sleep(700);
  await tap(page.locator('li button', { hasText: `${lead.firstName} ${lead.lastName}` }).first(), 1000);
  await tap(page.getByRole('button', { name: /^Wellness exam/ }), 450);
  if (leadPet.species !== 'rabbit') await tap(page.getByRole('button', { name: /^Rabies vaccine/ }), 700);
  await scrollElementIntoView(page, page.getByText('Best available times'), 70, 1500);
  await sleep(2400);
  await shot('04-smart-booking');
  await scrollElementIntoView(page, page.locator('.leaflet-container').first(), 90, 1400);
  await sleep(2200);
  await shot('05-slot-on-route');
  await scrollElementIntoView(page, page.getByText('Best available times'), 70, 1100);
  await sleep(700);
  await tap(page.getByRole('button', { name: 'Book', exact: true }).first(), 2400);
  await shot('06-booked');
});

await go('/routes?date=2026-10-08&team=team_east', 3500);
await scene('optimize', async () => {
  await sleep(1400);
  await shot('07-route-planner');
  await smoothScrollTo(page, 520, 1500);
  await sleep(900);
  await smoothScrollTo(page, 0, 1000);
  await sleep(400);
  await tap(page.getByRole('button', { name: 'Optimize', exact: true }), 900);
  await tap(page.getByRole('tab', { name: 'Re-plan windows' }), 2200);
  await shot('08-optimize');
  await tap(page.getByRole('button', { name: /^Apply new order/ }), 2200);
});
if (await page.getByRole('button', { name: 'Done' }).count()) await page.getByRole('button', { name: 'Done' }).tap();
await smoothScrollTo(page, 0, 10);
await sleep(800);

await scene('doctor', async () => {
  await sleep(500);
  await tap(avatar(), 1100);
  await tap(page.getByRole('button', { name: /Doctor · West Unit/ }), 2200);
  await shot('09-doctor-day-sheet');
  const cards = page.locator('main ol > li');
  await scrollElementIntoView(page, cards.nth(1), 70, 1600);
  await sleep(2000);
  await shot('10-doctor-visit-card');
  await scrollElementIntoView(page, cards.nth(2), 70, 1500);
  await sleep(1300);
});

await smoothScrollTo(page, 0, 10);
await scene('driver', async () => {
  await sleep(500);
  await tap(avatar(), 1000);
  await tap(page.getByRole('button', { name: /Driver · West Unit/ }), 2200);
  await shot('11-driver-run-sheet');
  const done = page.getByRole('button', { name: 'Visit done' });
  if (await done.count()) {
    await tap(done, 1500);
    await tap(page.getByRole('button', { name: 'Complete visit' }), 1200);
    await tap(page.getByRole('button', { name: 'Paid now' }), 1500);
    await tap(page.locator('aside').getByRole('button', { name: 'Close' }).first(), 1800);
    await shot('12-driver-next-stop');
  }
  await tap(page.getByRole('button', { name: 'On my way' }), 2400);
  await shot('13-on-my-way-text');
  await tap(page.getByRole('dialog').getByRole('button', { name: 'Close' }), 1000);
});

await tap(avatar(), 600);
await tap(page.getByRole('button', { name: /· Owner/ }), 1500);
await go(`/clients/${profile.id}`, 2500);
await scene('client', async () => {
  await sleep(1300);
  await shot('14-client-profile');
  await scrollElementIntoView(page, page.getByRole('heading', { name: 'Pets' }), 70, 1500);
  await sleep(1800);
  await shot('15-pets');
  await scrollElementIntoView(page, page.getByRole('heading', { name: 'Care reminders' }), 70, 1500);
  await sleep(1500);
});

await go('/messages?tab=recalls', 1800);
await scene('recalls', async () => {
  await sleep(1300);
  await shot('16-care-recalls');
  await tap(page.getByRole('button', { name: 'Remind' }).first(), 2400);
  await shot('17-recall-message');
  await tap(page.getByRole('dialog').getByRole('button', { name: 'Close' }), 900);
  await smoothScrollTo(page, 700, 1600);
  await sleep(1400);
});

await go('/reports', 2000);
await scene('reports', async () => {
  await sleep(1300);
  await shot('18-reports');
  await scrollElementIntoView(page, page.getByText('Revenue by week'), 70, 1500);
  await sleep(1800);
  await shot('19-reports-charts');
  await scrollElementIntoView(page, page.getByText('Visits by type'), 70, 1500);
  await sleep(1400);
});

// Keep the learned drive times for the next pass.
const legs = await page.evaluate(() => localStorage.getItem('vetset:legs:v1'));
if (legs && MODE === 'shots') writeFileSync(LEGS, legs);
if (MODE === 'video') writeFileSync(join(ROOT, 'work', 'markers.json'), JSON.stringify({ markers, frames }, null, 1));
console.log('errors:', errors.length ? errors : 'none');
console.log('blocked requests:', blocked.size ? [...blocked] : 'none', stats);
await browser.close();
