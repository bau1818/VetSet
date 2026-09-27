// Composes the 1920x1080 pitch video: HTML-rendered backgrounds and captions (exact brand fonts),
// the phone recording inside a rounded bezel, title/problem/end cards and crossfades.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { chromium } from 'playwright-core';

const ROOT = dirname(fileURLToPath(import.meta.url));
const W = join(ROOT, 'work');
const L = join(W, 'layers');
const C = join(W, 'clips');
[L, C].forEach((d) => mkdirSync(d, { recursive: true }));
const FF = ffmpegInstaller.path;
const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const hash = (o) => createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 10);

const OUT = process.argv[2] ?? join(ROOT, 'out', 'VetSet-Manager-Tour.mp4');
const FPS = 30;
const XF = 0.35;
const SCREEN = { x: 1176, y: 90, w: 416, h: 900, r: 50 };

const { markers, frames } = JSON.parse(readFileSync(join(W, 'markers.json'), 'utf8'));

const SCENES = {
  dashboard: { eyebrow: 'Office dashboard', title: 'Your whole day at a glance.', body: 'Both vans’ routes, today’s progress, open capacity and what needs attention — in one view.' },
  schedule: { eyebrow: 'Schedule', title: 'The week, unit by unit.', body: 'Every visit with its arrival window, plus the drive time each day will take.' },
  book: { eyebrow: 'Smart booking', title: 'Best slots, ranked by drive time.', body: 'VetSet checks every unit’s route for the next two weeks and suggests the times that add the least driving.' },
  optimize: { eyebrow: 'Route optimization', title: 'Reorder the day in one tap.', body: 'See the minutes and miles saved, apply the new order, then let each client know their new arrival window.' },
  doctor: { eyebrow: 'Doctor day sheet', title: 'What the doctor needs, every stop.', body: 'Pets, handling alerts, visit reasons, care that’s due and open balances — before walking in the door.' },
  driver: { eyebrow: 'Driver run sheet', title: 'Next stop, gate code, go.', body: 'Close out a visit and mark it paid, then navigate and send the next client an on-my-way text.' },
  client: { eyebrow: 'Client & pet records', title: 'Every household in one place.', body: 'Contact details, access notes, pets with handling alerts, upcoming visits and balances together.' },
  recalls: { eyebrow: 'Care reminders', title: 'Keep every pet on schedule.', body: 'See which pets are due, send a reminder from a template, and book them onto a route that’s already nearby.' },
  reports: { eyebrow: 'Reports', title: 'See how the practice runs.', body: 'Revenue, visits, time with patients versus time on the road, and where new clients come from.' },
};
const SPEED = { book: 1.05 };

const fontUrl = (w) => pathToFileURL(join(ROOT, 'node_modules/@fontsource/inter/files', `inter-latin-${w}-normal.woff2`)).href;
const PAW = (s, r = 0.26) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${64 * r}" fill="#0f766e"/><g fill="#fff"><ellipse cx="32" cy="41" rx="11" ry="9"/><ellipse cx="19" cy="27" rx="5" ry="6.5"/><ellipse cx="45" cy="27" rx="5" ry="6.5"/><ellipse cx="26" cy="18" rx="4.5" ry="6"/><ellipse cx="38" cy="18" rx="4.5" ry="6"/></g></svg>`;
const BASE_CSS = `
${[400, 500, 600, 700, 800].map((w) => `@font-face{font-family:Inter;font-weight:${w};src:url(${fontUrl(w)}) format('woff2')}`).join('')}
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;
background:radial-gradient(900px 700px at 78% 40%,rgba(20,184,166,.30),transparent 62%),radial-gradient(800px 600px at 8% 95%,rgba(99,102,241,.16),transparent 65%),linear-gradient(160deg,#06201f 0%,#0a1c24 55%,#0b1622 100%)}
.brand{position:absolute;left:140px;top:84px;display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700;letter-spacing:-.4px}
.brand span{color:#9fb7b8;font-weight:500}
.demo{position:absolute;left:140px;bottom:78px;display:inline-flex;align-items:center;gap:10px;font-size:20px;font-weight:600;color:#cfe3e2;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);border-radius:999px;padding:9px 18px}
.demo i{width:9px;height:9px;border-radius:50%;background:#f5b53b}
.eyebrow{font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#5eead4}
h1{font-size:74px;line-height:1.05;font-weight:800;letter-spacing:-2px;margin-top:22px;text-wrap:balance}
p.body{font-size:32px;line-height:1.42;color:#bfd0d1;margin-top:28px;text-wrap:pretty}
`;

function sceneHtml(s) {
  const { x, y, w, h, r } = SCREEN;
  return `<!doctype html><style>${BASE_CSS}
.copy{position:absolute;left:140px;top:0;bottom:0;width:860px;display:flex;flex-direction:column;justify-content:center}
.glow{position:absolute;left:${x - 140}px;top:${y + 60}px;width:${w + 280}px;height:${h - 120}px;border-radius:50%;background:radial-gradient(closest-side,rgba(20,184,166,.35),transparent);filter:blur(30px)}
.bezel{position:absolute;left:${x - 14}px;top:${y - 14}px;width:${w + 28}px;height:${h + 28}px;border-radius:${r + 14}px;background:linear-gradient(145deg,#2b3446,#131926);box-shadow:0 0 0 2px #465066,0 50px 110px rgba(0,0,0,.6)}
.screen{position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;background:#000}
.btn{position:absolute;left:${x - 17}px;top:${y + 190}px;width:4px;height:90px;border-radius:3px;background:#3b4459}
</style><body>
<div class="brand">${PAW(50)}<div>VetSet <span>Manager</span></div></div>
<div class="copy"><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><p class="body">${s.body}</p></div>
<div class="glow"></div><div class="btn"></div><div class="bezel"></div><div class="screen"></div>
<div class="demo"><i></i>Demo data · fictional practice</div>
</body>`;
}

const cardHtml = (kind) => {
  const center = `.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 260px}`;
  if (kind === 'title')
    return `<!doctype html><style>${BASE_CSS}${center}
.name{font-size:104px;font-weight:800;letter-spacing:-3px;margin-top:40px}.name span{color:#9fb7b8;font-weight:600}
.tag{font-size:38px;color:#cfe0e0;margin-top:22px;font-weight:500}</style><body>
<div class="wrap">${PAW(150)}<div class="name">VetSet <span>Manager</span></div><div class="tag">Scheduling, routing and client care for mobile veterinary practices.</div></div></body>`;
  if (kind === 'problem')
    return `<!doctype html><style>${BASE_CSS}${center}h1{font-size:88px}p.body{font-size:36px;max-width:1180px}</style><body>
<div class="brand">${PAW(50)}<div>VetSet <span>Manager</span></div></div>
<div class="wrap"><div class="eyebrow">The house-call puzzle</div><h1>Every new booking reshapes the day.</h1>
<p class="body">Mobile vets juggle drive time, promised arrival windows and client details — often across phone calls, texts and spreadsheets.</p></div></body>`;
  return `<!doctype html><style>${BASE_CSS}${center}
.name{font-size:64px;font-weight:800;letter-spacing:-1.5px;margin-top:30px}.name span{color:#9fb7b8;font-weight:600}
h1{font-size:92px;margin-top:40px}.cta{margin-top:46px;display:inline-flex;align-items:center;gap:14px;font-size:30px;font-weight:700;background:linear-gradient(135deg,#14b8a6,#0f766e);border-radius:18px;padding:22px 34px;box-shadow:0 18px 50px rgba(20,184,166,.35)}
.url{margin-top:22px;font-size:26px;color:#9fb7b8}</style><body>
<div class="wrap">${PAW(110)}<div class="name">VetSet <span>Manager</span></div><h1>Less time driving.<br>More time caring.</h1>
<div class="cta">Try the live demo →</div><div class="url">vetset-manager.vercel.app</div></div></body>`;
};

async function renderLayers(items) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const { html, out } of items) {
    if (existsSync(out)) continue;
    const f = out.replace(/\.png$/, '.html');
    writeFileSync(f, html);
    await page.goto(pathToFileURL(f).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out });
  }
  await browser.close();
}

// ---- layers --------------------------------------------------------------------------------------
const order = ['title', 'problem', ...markers.map((m) => m.name), 'end'];
const layerJobs = [];
const layerOf = {};
for (const name of order) {
  const html = SCENES[name] ? sceneHtml(SCENES[name]) : cardHtml(name);
  const out = join(L, `${name}-${hash(html)}.png`);
  layerOf[name] = out;
  layerJobs.push({ html, out });
}
await renderLayers(layerJobs);
const MASK = join(L, `mask-${SCREEN.w}x${SCREEN.h}r${SCREEN.r}.png`);
if (!existsSync(MASK))
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN.w}" height="${SCREEN.h}"><rect width="100%" height="100%" fill="#000"/><rect width="${SCREEN.w}" height="${SCREEN.h}" rx="${SCREEN.r}" fill="#fff"/></svg>`)).png().toFile(MASK);

// ---- clips ---------------------------------------------------------------------------------------
const CARD_DUR = { title: 4.2, problem: 6.2, end: 6.5 };
const clips = [];
for (const name of order) {
  if (CARD_DUR[name]) {
    const dur = CARD_DUR[name];
    const out = join(C, `${name}-${hash([layerOf[name], dur])}.mp4`);
    if (!existsSync(out)) ff(['-loop', '1', '-framerate', String(FPS), '-i', layerOf[name], '-t', String(dur), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-r', String(FPS), out]);
    clips.push({ name, out, dur });
    continue;
  }
  const m = markers.find((x) => x.name === name);
  const fr = frames.filter((f) => f.t >= m.start && f.t <= m.end);
  const speed = SPEED[name] ?? 1;
  const dur = (m.end - m.start) / speed;
  const out = join(C, `${name}-${hash([layerOf[name], m, fr.length, speed, SCREEN])}.mp4`);
  if (!existsSync(out)) {
    const list = join(C, `${name}.txt`);
    const lines = [];
    fr.forEach((f, i) => {
      const next = i + 1 < fr.length ? fr[i + 1].t : m.end;
      lines.push(`file '${f.f}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file '${fr[fr.length - 1].f}'`);
    writeFileSync(list, lines.join('\n'));
    const raw = join(C, `${name}-raw.mp4`);
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `setpts=PTS/${speed},fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', raw]);
    const { x, y, w, h } = SCREEN;
    ff([
      '-i', raw, '-loop', '1', '-framerate', String(FPS), '-i', layerOf[name], '-loop', '1', '-framerate', String(FPS), '-i', MASK,
      '-filter_complex',
      `[0:v]scale=${w}:${h}:flags=lanczos,format=rgba[s];[2:v]format=gray[m];[s][m]alphamerge[sm];[1:v][sm]overlay=${x}:${y}:shortest=1,fps=${FPS},format=yuv420p[v]`,
      '-map', '[v]', '-t', dur.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', out,
    ]);
  }
  clips.push({ name, out, dur });
}

// ---- crossfade chain -----------------------------------------------------------------------------
const inputs = clips.flatMap((c) => ['-i', c.out]);
const parts = clips.map((_, i) => `[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[c${i}]`);
let acc = 'c0';
let t = clips[0].dur;
clips.slice(1).forEach((c, k) => {
  const i = k + 1;
  const off = (t - XF).toFixed(3);
  parts.push(`[${acc}][c${i}]xfade=transition=fade:duration=${XF}:offset=${off}[x${i}]`);
  acc = `x${i}`;
  t = t - XF + c.dur;
});
parts.push(`[${acc}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(t - 0.8).toFixed(3)}:d=0.8[v]`);
ff([...inputs, '-filter_complex', parts.join(';'), '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', OUT]);
console.log('video', OUT, 'duration', t.toFixed(1) + 's', clips.map((c) => `${c.name}:${c.dur.toFixed(1)}`).join(' '));
writeFileSync(join(W, 'timeline.json'), JSON.stringify({ total: t, clips: clips.map((c) => ({ name: c.name, dur: c.dur })) }, null, 1));
