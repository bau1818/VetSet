// Curates screenshots (PNG deliverables) and builds the showcase site's assets.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { chromium } from 'playwright-core';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'out', 'shots-raw');
const SHOTS = join(ROOT, 'out', 'screenshots');
const SITE = join(ROOT, 'site');
const IMG = join(SITE, 'img');
rmSync(SHOTS, { recursive: true, force: true });
[SHOTS, IMG, join(SITE, 'fonts')].forEach((d) => mkdirSync(d, { recursive: true }));

export const PHONE = [
  ['01-dashboard', '01-dashboard', 'Office dashboard'],
  ['02-schedule-week', '03b-schedule-week', 'Week schedule by unit'],
  ['03-smart-booking', '04-smart-booking', 'Smart booking: slots ranked by drive time'],
  ['04-slot-on-route', '05-slot-on-route', 'Where the new visit lands on the route'],
  ['05-route-planner', '07-route-planner', 'Route planner with ETAs and windows'],
  ['06-route-optimizer', '08-optimize', 'One-tap route optimization'],
  ['07-doctor-day-sheet', '10-doctor-visit-card', 'Doctor day sheet'],
  ['08-driver-run-sheet', '11-driver-run-sheet', 'Driver run sheet'],
  ['09-on-my-way-text', '13-on-my-way-text', 'On-my-way text with ETA'],
  ['10-client-profile', '14-client-profile', 'Client & pet profile'],
  ['11-care-recalls', '16-care-recalls', 'Care recalls'],
  ['12-reports', '19-reports-charts', 'Reports'],
];
const DESKTOP = [
  ['desktop-dashboard', 'Dashboard on desktop'],
  ['desktop-schedule', 'Day schedule on desktop'],
];

for (const [name, raw] of PHONE) {
  copyFileSync(join(RAW, `${raw}.png`), join(SHOTS, `${name}.png`));
  await sharp(join(RAW, `${raw}.png`)).jpeg({ quality: 84, progressive: true, mozjpeg: true }).toFile(join(IMG, `${name}.jpg`));
  await sharp(join(RAW, `${raw}.png`)).resize(360).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(join(IMG, `${name}-sm.jpg`));
}
for (const [name] of DESKTOP) {
  copyFileSync(join(RAW, `${name}.png`), join(SHOTS, `${name}.png`));
  await sharp(join(RAW, `${name}.png`)).resize(1600).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(join(IMG, `${name}.jpg`));
  await sharp(join(RAW, `${name}.png`)).resize(820).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(join(IMG, `${name}-sm.jpg`));
}

// Fonts (self-hosted Inter, same as the app).
for (const w of [400, 500, 600, 700, 800]) copyFileSync(join(ROOT, 'node_modules/@fontsource/inter/files', `inter-latin-${w}-normal.woff2`), join(SITE, 'fonts', `inter-latin-${w}-normal.woff2`));

// Video + poster (dashboard scene).
copyFileSync(join(ROOT, 'out', 'VetSet-Manager-Tour.mp4'), join(SITE, 'vetset-manager-tour.mp4'));
const posterPng = join(ROOT, 'work', 'poster.png');
execFileSync(ffmpegInstaller.path, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '15.5', '-i', join(ROOT, 'out', 'VetSet-Manager-Tour.mp4'), '-frames:v', '1', posterPng]);
await sharp(posterPng).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(join(IMG, 'tour-poster.jpg'));

// Favicons from the VetSet paw mark.
const PAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0f766e"/><g fill="#fff"><ellipse cx="32" cy="41" rx="11" ry="9"/><ellipse cx="19" cy="27" rx="5" ry="6.5"/><ellipse cx="45" cy="27" rx="5" ry="6.5"/><ellipse cx="26" cy="18" rx="4.5" ry="6"/><ellipse cx="38" cy="18" rx="4.5" ry="6"/></g></svg>`;
writeFileSync(join(SITE, 'favicon.svg'), PAW);
await sharp(Buffer.from(PAW), { density: 300 }).resize(32).png().toFile(join(SITE, 'favicon-32.png'));
await sharp(Buffer.from(PAW.replace('rx="14"', 'rx="0"')), { density: 400 }).resize(180).png().toFile(join(SITE, 'apple-touch-icon.png'));

// Link-preview image (1200x630).
const font = (w) => pathToFileURL(join(SITE, 'fonts', `inter-latin-${w}-normal.woff2`)).href;
const og = `<!doctype html><style>
@font-face{font-family:Inter;font-weight:600;src:url(${font(600)})}@font-face{font-family:Inter;font-weight:800;src:url(${font(800)})}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;font-family:Inter;color:#fff;
background:radial-gradient(520px 420px at 80% 40%,rgba(20,184,166,.35),transparent 65%),linear-gradient(160deg,#06201f,#0b1622)}
.l{position:absolute;left:72px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center}
.b{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800;letter-spacing:-.5px}.b span{color:#9fb7b8;font-weight:600}
h1{font-size:70px;line-height:1.02;font-weight:800;letter-spacing:-2px;margin-top:34px}.g{background:linear-gradient(90deg,#5eead4,#a5b4fc);-webkit-background-clip:text;color:transparent}
p{font-size:25px;color:#bfd0d1;margin-top:22px;line-height:1.4;font-weight:600}
.ph{position:absolute;right:92px;top:60px;width:300px;border-radius:40px;border:10px solid #1c2433;box-shadow:0 0 0 2px #465066,0 30px 70px rgba(0,0,0,.55);overflow:hidden}
.ph img{display:block;width:100%}</style><body>
<div class="l"><div class="b">${PAW.replace('<svg ', '<svg width="54" height="54" ')}<div>VetSet <span>Manager</span></div></div>
<h1>Book smarter.<br><span class="g">Drive less.</span></h1><p>Scheduling, routing and client care for mobile veterinary practices.</p></div>
<div class="ph"><img src="${pathToFileURL(join(IMG, '03-smart-booking.jpg')).href}"></div></body>`;
const ogHtml = join(ROOT, 'work', 'og.html');
writeFileSync(ogHtml, og);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(ogHtml).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(SITE, 'og-image.png') });
await browser.close();
console.log('assets ready');
