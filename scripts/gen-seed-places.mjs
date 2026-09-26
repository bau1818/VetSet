// One-off generator for demo addresses: samples points around suburban centers,
// snaps them to the nearest named local road (OSRM), and reverse-geocodes city/zip (Photon).
// House numbers are invented at seed time, so no address maps to a real household.
import { writeFileSync } from 'node:fs';

const centers = [
  { name: 'Cedar Park', lat: 30.5052, lng: -97.8203, w: 9, spread: 0.022 },
  { name: 'Leander', lat: 30.5788, lng: -97.8531, w: 7, spread: 0.022 },
  { name: 'Round Rock', lat: 30.5083, lng: -97.6789, w: 8, spread: 0.025 },
  { name: 'Georgetown', lat: 30.6333, lng: -97.6780, w: 6, spread: 0.025 },
  { name: 'Pflugerville', lat: 30.4394, lng: -97.6200, w: 5, spread: 0.02 },
  { name: 'Austin', lat: 30.4470, lng: -97.7900, w: 7, spread: 0.022 },
  { name: 'Brushy Creek', lat: 30.5130, lng: -97.7390, w: 4, spread: 0.015 },
  { name: 'Liberty Hill', lat: 30.6649, lng: -97.9225, w: 2, spread: 0.015 },
  { name: 'Hutto', lat: 30.5427, lng: -97.5467, w: 2, spread: 0.015 },
];
const TARGET = 52;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'User-Agent': 'VetSetManager-demo-seed/1.0 (demo data generator)' };
const bad = /(highway|hwy|interstate|\bI ?35\b|\bIH\b|toll|tollway|^US |^TX |^SH |^FM |^RM |^CR |loop|frontage|service road|ramp|expressway|parkway|pkwy)/i;
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pickCenter = () => { const tot = centers.reduce((s, c) => s + c.w, 0); let r = rnd() * tot; for (const c of centers) { if ((r -= c.w) <= 0) return c; } return centers[0]; };

const out = []; const seenStreets = new Set();
let tries = 0;
while (out.length < TARGET && tries < 300) {
  tries++;
  const c = pickCenter();
  const lat = c.lat + gauss() * c.spread, lng = c.lng + gauss() * c.spread * 1.15;
  try {
    const n = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng.toFixed(6)},${lat.toFixed(6)}?number=1`, { headers: UA }).then((r) => r.json());
    await sleep(1100);
    const wp = n.waypoints?.[0];
    if (!wp || !wp.name || bad.test(wp.name) || wp.distance > 400) continue;
    const key = wp.name + '|' + c.name;
    if (seenStreets.has(key)) continue;
    const [slng, slat] = wp.location;
    const g = await fetch(`https://photon.komoot.io/reverse?lon=${slng}&lat=${slat}&limit=1`, { headers: UA }).then((r) => r.json());
    await sleep(1100);
    const p = g.features?.[0]?.properties ?? {};
    if (p.country && p.country !== 'United States') continue;
    seenStreets.add(key);
    out.push({ street: wp.name, city: p.city || p.district || c.name, state: 'TX', zip: p.postcode || '', lat: +slat.toFixed(6), lng: +slng.toFixed(6) });
    console.log(out.length, wp.name, '·', p.city || c.name, p.postcode || '');
  } catch (e) { console.log('err', e.message); await sleep(2000); }
}
writeFileSync(new URL('../src/data/seedPlaces.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote', out.length);
