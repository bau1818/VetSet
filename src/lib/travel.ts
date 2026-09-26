// Road-network travel times. Uses the public OSRM server (no API key) with a polite request
// queue and a persistent cache; every lookup has an instant offline estimate so the UI never blocks.
// Swap OSRM_URL for a self-hosted OSRM, Mapbox or Google Distance Matrix in production.
import { create } from 'zustand';
import type { GeoPoint } from '../data/types';
import { estimateLeg, pointKey } from './geo';

const OSRM_URL = 'https://router.project-osrm.org';
const CACHE_KEY = 'vetset:legs:v1';
const MAX_CACHE = 6000;
const MIN_GAP_MS = 1100;
const MAX_TABLE = 90;

export interface Leg {
  seconds: number;
  meters: number;
  estimated: boolean;
}

type Entry = [number, number]; // seconds, meters
const legs = new Map<string, Entry>();
const geometries = new Map<string, [number, number][]>();
const failed = new Set<string>();

try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) for (const [k, v] of JSON.parse(raw) as [string, Entry][]) legs.set(k, v);
} catch {
  /* cache is optional */
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
const persist = () => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const entries = [...legs.entries()];
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(-MAX_CACHE)));
    } catch {
      /* quota: ignore */
    }
  }, 500);
};

/** Bumps whenever real road data lands, so memoized plans recompute. */
export const useTravelStore = create<{ version: number; pending: number; offline: boolean }>(() => ({
  version: 0,
  pending: 0,
  offline: false,
}));
const bump = () => useTravelStore.setState((s) => ({ version: s.version + 1 }));
const setPending = (d: number) => useTravelStore.setState((s) => ({ pending: Math.max(0, s.pending + d) }));

const legKey = (a: GeoPoint, b: GeoPoint) => `${pointKey(a)}>${pointKey(b)}`;

export const getLeg = (a: GeoPoint, b: GeoPoint): Leg => {
  if (pointKey(a) === pointKey(b)) return { seconds: 0, meters: 0, estimated: false };
  const hit = legs.get(legKey(a, b));
  if (hit) return { seconds: hit[0], meters: hit[1], estimated: false };
  const est = estimateLeg(a, b);
  return { ...est, estimated: true };
};

export const legMinutes = (a: GeoPoint, b: GeoPoint) => getLeg(a, b).seconds / 60;
export const legMiles = (a: GeoPoint, b: GeoPoint) => getLeg(a, b).meters / 1609.344;

// ---- polite sequential request queue --------------------------------------------------------
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
let backoffUntil = 0;

const queued = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = async () => {
    const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
};

const fetchJson = async (url: string) => {
  if (Date.now() < backoffUntil) throw new Error('routing service backing off');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code && json.code !== 'Ok') throw new Error(json.code);
    useTravelStore.setState({ offline: false });
    return json;
  } catch (e) {
    backoffUntil = Date.now() + 45_000;
    useTravelStore.setState({ offline: true });
    throw e;
  } finally {
    clearTimeout(t);
  }
};

const coordList = (pts: GeoPoint[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

const inflight = new Map<string, Promise<void>>();

/** Make sure every ordered pair among `points` has road data. Resolves when done (or failed → estimates stay). */
export const ensureMatrix = (points: GeoPoint[]): Promise<void> => {
  const uniq = [...new Map(points.map((p) => [pointKey(p), p])).values()];
  if (uniq.length < 2) return Promise.resolve();
  const missing = uniq.filter((a) => uniq.some((b) => a !== b && !legs.has(legKey(a, b))));
  if (!missing.length) return Promise.resolve();

  const reqKey = uniq.map(pointKey).sort().join(';');
  if (failed.has(reqKey) && Date.now() < backoffUntil) return Promise.resolve();
  const existing = inflight.get(reqKey);
  if (existing) return existing;

  // Rows = points with any missing outgoing leg, columns = every point. Points not in `missing`
  // already have all their outgoing legs cached, so one direction covers the whole matrix.
  const chunks: { src: GeoPoint[]; dst: GeoPoint[] }[] = [];
  const colChunk = Math.max(10, MAX_TABLE - Math.min(missing.length, 30));
  for (let i = 0; i < missing.length; i += 30) {
    const src = missing.slice(i, i + 30);
    for (let j = 0; j < uniq.length; j += colChunk) chunks.push({ src, dst: uniq.slice(j, j + colChunk) });
  }

  setPending(1);
  const job = (async () => {
    for (const { src, dst } of chunks) {
      const all = [...src, ...dst];
      const sources = src.map((_, i) => i).join(';');
      const destinations = dst.map((_, i) => i + src.length).join(';');
      const json = await queued(() =>
        fetchJson(`${OSRM_URL}/table/v1/driving/${coordList(all)}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`),
      );
      src.forEach((a, i) =>
        dst.forEach((b, j) => {
          const sec = json.durations?.[i]?.[j];
          const m = json.distances?.[i]?.[j];
          if (typeof sec === 'number' && typeof m === 'number') legs.set(legKey(a, b), [sec, m]);
        }),
      );
    }
    persist();
    bump();
  })()
    .catch(() => {
      failed.add(reqKey);
    })
    .finally(() => {
      inflight.delete(reqKey);
      setPending(-1);
    });
  inflight.set(reqKey, job);
  return job;
};

/** Road-following polyline for an ordered list of points; falls back to straight segments. */
export const getRouteGeometry = async (points: GeoPoint[]): Promise<[number, number][]> => {
  const straight = points.map((p) => [p.lat, p.lng] as [number, number]);
  if (points.length < 2) return straight;
  const key = points.map(pointKey).join(';');
  const hit = geometries.get(key);
  if (hit) return hit;
  try {
    const json = await queued(() =>
      fetchJson(`${OSRM_URL}/route/v1/driving/${coordList(points)}?overview=full&geometries=geojson&steps=false`),
    );
    const coords: [number, number][] = json.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
    // Legs from the route are real too — cache them.
    json.routes[0].legs.forEach((leg: { duration: number; distance: number }, i: number) => {
      legs.set(legKey(points[i], points[i + 1]), [leg.duration, leg.distance]);
    });
    geometries.set(key, coords);
    persist();
    bump();
    return coords;
  } catch {
    return straight;
  }
};
