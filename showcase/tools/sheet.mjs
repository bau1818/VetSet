import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const [dir, out, cols = 6, w = 300] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => /\.(png|jpg)$/.test(f)).sort();
const h = Math.round((w * 1688) / 780);
const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp(`${dir}/${f}`).resize(Number(w), h, { fit: 'contain', background: '#fff' }).png().toBuffer(), left: (i % cols) * (Number(w) + 10), top: Math.floor(i / cols) * (h + 10) })));
const rows = Math.ceil(files.length / cols);
await sharp({ create: { width: cols * (Number(w) + 10), height: rows * (h + 10), channels: 3, background: '#334155' } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
console.log(files.join(' '));
