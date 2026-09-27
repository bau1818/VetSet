// Verification: OCR every screenshot and 2 frames/second of the video, plus a text scan of the site,
// against the list of real place names, area codes, streets and old names that must never appear.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ROOT = dirname(fileURLToPath(import.meta.url));
const [, , ...targets] = process.argv; // screenshot dirs, video files, site dirs
const places = JSON.parse(readFileSync(join(ROOT, '..', '..', 'src', 'data', 'seedPlaces.json'), 'utf8'));
const TERMS = [
  'Cedar Park', 'Round Rock', 'Leander', 'Georgetown', 'Pflugerville', 'Austin', 'Brushy Creek', 'Liberty Hill', 'Hutto', 'Avery Ranch', 'Jollyville',
  'Williamson', 'Texas', 'Travis County', 'Milam', 'Post Trail', 'VetSet Demo Practice', 'Elena Ruiz', 'Ruiz',
  ...places.map((p) => p.street),
];
const REGEX = [
  { name: 'area code 512', re: /\(\s*512\s*\)|\b512[-.\s]\d{3}/ },
  { name: 'TX state', re: /\bTX\b/ },
  { name: 'Austin-area ZIP 786xx/787xx', re: /\b78[67]\d{2}\b/ },
];
const norm = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const scan = (text) => {
  const t = norm(text);
  const hits = TERMS.filter((w) => t.toLowerCase().includes(w.toLowerCase()));
  REGEX.forEach(({ name, re }) => re.test(t) && hits.push(name));
  return hits;
};

const worker = await createWorker('eng', 1, { langPath: join(ROOT, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'), gzip: true, cachePath: join(ROOT, 'cache', 'tess') });
const ocr = async (file, upscale = 1) => {
  const buf = upscale > 1 ? await sharp(file).resize({ width: Math.round((await sharp(file).metadata()).width * upscale) }).toBuffer() : readFileSync(file);
  const { data } = await worker.recognize(buf);
  return data.text;
};

const report = { images: 0, frames: 0, siteFiles: 0, hits: [] };

for (const target of targets) {
  const st = statSync(target);
  if (st.isFile() && extname(target) === '.mp4') {
    const dir = join(ROOT, 'work', 'ocr-frames');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    execFileSync(ffmpegInstaller.path, ['-hide_banner', '-loglevel', 'error', '-i', target, '-vf', 'fps=2', join(dir, '%05d.png')]);
    const files = readdirSync(dir).sort();
    for (const f of files) {
      const text = await ocr(join(dir, f));
      report.frames++;
      const hits = scan(text);
      if (hits.length) report.hits.push({ file: `${target} @ ${(parseInt(f) / 2).toFixed(1)}s`, hits });
    }
    continue;
  }
  if (st.isDirectory()) {
    for (const f of readdirSync(target).sort()) {
      const p = join(target, f);
      if (statSync(p).isDirectory()) continue;
      const ext = extname(f).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const text = await ocr(p, 1);
        report.images++;
        const hits = scan(text);
        if (hits.length) report.hits.push({ file: p, hits });
      } else if (['.html', '.css', '.js', '.json', '.txt', '.md', '.svg', '.xml', '.webmanifest'].includes(ext)) {
        report.siteFiles++;
        const hits = scan(readFileSync(p, 'utf8'));
        if (hits.length) report.hits.push({ file: p, hits });
      }
    }
  }
}
await worker.terminate();
writeFileSync(join(ROOT, 'work', 'verify-report.json'), JSON.stringify(report, null, 1));
console.log(`OCR images: ${report.images} · video frames: ${report.frames} · text files: ${report.siteFiles}`);
console.log(report.hits.length ? `HITS (${report.hits.length}):\n` + report.hits.map((h) => `  ${h.file}: ${h.hits.join(', ')}`).join('\n') : 'HITS: 0');
