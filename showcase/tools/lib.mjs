// Shared harness: serves the showcase build of VetSet from a fake domain inside Chrome (Playwright),
// answers fonts locally, replays public map/routing responses from a disk cache, and blocks the rest.
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const APP_DIST = process.env.APP_DIST ?? join(ROOT, '..', '..', 'dist-showcase');
export const ORIGIN = 'https://app.vetset.demo';
export const FIXED_TIME = new Date('2026-10-06T10:40:00'); // a Tuesday mid-morning: a full day in progress
const CACHE = join(ROOT, 'cache', 'net');
mkdirSync(CACHE, { recursive: true });

const FONT_DIR = join(ROOT, 'node_modules', '@fontsource', 'inter', 'files');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const CACHED_HOSTS = ['router.project-osrm.org', 'server.arcgisonline.com'];

export const blocked = new Set();
export const stats = { local: 0, cacheHit: 0, cacheMiss: 0 };

const fontCss = () =>
  [400, 500, 600, 700]
    .map((w) => `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:swap;src:url(${ORIGIN}/__fonts/inter-latin-${w}-normal.woff2) format('woff2')}`)
    .join('\n');

async function handle(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.origin === ORIGIN) {
    stats.local++;
    if (url.pathname.startsWith('/__fonts/')) {
      return route.fulfill({ body: readFileSync(join(FONT_DIR, url.pathname.slice(9))), contentType: 'font/woff2' });
    }
    let p = join(APP_DIST, decodeURIComponent(url.pathname));
    if (!extname(p) || !existsSync(p)) p = join(APP_DIST, 'index.html');
    return route.fulfill({ body: readFileSync(p), contentType: MIME[extname(p)] ?? 'application/octet-stream' });
  }
  if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: fontCss(), contentType: 'text/css' });
  if (CACHED_HOSTS.includes(url.hostname)) {
    const key = join(CACHE, createHash('sha1').update(req.url()).digest('hex'));
    if (existsSync(key + '.bin')) {
      stats.cacheHit++;
      const meta = JSON.parse(readFileSync(key + '.json', 'utf8'));
      return route.fulfill({ status: meta.status, body: readFileSync(key + '.bin'), contentType: meta.type, headers: { 'access-control-allow-origin': '*' } });
    }
    stats.cacheMiss++;
    try {
      const res = await route.fetch();
      const body = await res.body();
      if (res.ok()) {
        writeFileSync(key + '.bin', body);
        writeFileSync(key + '.json', JSON.stringify({ status: res.status(), type: res.headers()['content-type'] ?? 'application/octet-stream', url: req.url() }));
      }
      return route.fulfill({ status: res.status(), body, contentType: res.headers()['content-type'], headers: { 'access-control-allow-origin': '*' } });
    } catch {
      return route.abort();
    }
  }
  blocked.add(`${url.hostname}${url.pathname.slice(0, 40)}`);
  return route.abort();
}

const RIPPLE = `(() => {
  const draw = (x, y) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:' + (x - 24) + 'px;top:' + (y - 24) + 'px;width:48px;height:48px;border-radius:50%;background:rgba(20,184,166,.28);border:2.5px solid rgba(13,148,136,.9);pointer-events:none;z-index:2147483647;transform:scale(.35);opacity:1;transition:transform .5s cubic-bezier(.2,.7,.3,1),opacity .6s ease-out';
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = 'scale(1.35)'; d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 700);
  };
  addEventListener('pointerdown', (e) => draw(e.clientX, e.clientY), true);
})();`;

export async function launch() {
  return chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--force-device-scale-factor=2'] });
}

export async function newDemoContext(browser, { mobile = true, width = 390, height = 844, dsf = 2, storageState } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    storageState,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  await context.route('**/*', handle);
  await context.clock.setFixedTime(FIXED_TIME);
  await context.addInitScript(RIPPLE);
  return context;
}

/** Read the demo practice's data straight from the page's storage. */
export const readData = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vetset:data:v1') || 'null'));

export async function smoothScrollTo(page, y, ms = 1400) {
  await page.evaluate(
    ({ y, ms }) =>
      new Promise((resolve) => {
        const from = scrollY;
        const to = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          scrollTo(0, from + (to - from) * e);
          k < 1 ? requestAnimationFrame(step) : resolve();
        };
        requestAnimationFrame(step);
      }),
    { y, ms },
  );
}

export async function scrollElementIntoView(page, locator, offset = 90, ms = 1300) {
  const top = await locator.evaluate((el, off) => el.getBoundingClientRect().top + scrollY - off, offset);
  await smoothScrollTo(page, top, ms);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
