// Pure routing engine: simulate a unit's day, optimize stop order, and find the cheapest
// place to insert a new visit. No UI or storage dependencies — see routing.test.ts.
import type { GeoPoint } from '../data/types';
import { roundTo } from './time';

export interface LegCost {
  seconds: number;
  meters: number;
}
export type LegFn = (a: GeoPoint, b: GeoPoint) => LegCost;

export interface StopInput {
  id: string;
  point: GeoPoint;
  durationMins: number;
  /** Minutes from midnight. */
  windowStart: number;
  windowEnd: number;
  pinned?: boolean;
  /** Already finished or in progress — keeps its place at the front when optimizing. */
  locked?: boolean;
}

export interface DayConfig {
  base: GeoPoint;
  dayStart: number;
  dayEnd: number;
  bufferMins: number;
  leg: LegFn;
}

export interface PlannedStop {
  id: string;
  legMins: number;
  legMiles: number;
  arrival: number;
  start: number;
  waitMins: number;
  lateMins: number;
  depart: number;
}

export interface DayPlan {
  stops: PlannedStop[];
  leaveBase: number;
  returnBase: number;
  returnLegMins: number;
  returnLegMiles: number;
  driveMins: number;
  driveMiles: number;
  serviceMins: number;
  waitMins: number;
  lateMins: number;
  lateCount: number;
  overtimeMins: number;
}

const M_PER_MI = 1609.344;

/** Walk the route in order and compute arrival/departure for every stop. */
export function simulate(order: StopInput[], cfg: DayConfig): DayPlan {
  const stops: PlannedStop[] = [];
  let prev = cfg.base;
  let driveMins = 0;
  let driveMiles = 0;
  let serviceMins = 0;
  let waitMins = 0;
  let lateMins = 0;
  let lateCount = 0;

  // Leave base just in time for the first window (never before the unit's start of day).
  let leaveBase = cfg.dayStart;
  if (order.length) {
    const first = cfg.leg(cfg.base, order[0].point).seconds / 60;
    leaveBase = Math.max(cfg.dayStart, order[0].windowStart - first);
  }
  let t = leaveBase;

  for (const s of order) {
    const l = cfg.leg(prev, s.point);
    const legMins = l.seconds / 60;
    const legMiles = l.meters / M_PER_MI;
    const arrival = t + legMins;
    const start = Math.max(arrival, s.windowStart);
    const wait = start - arrival;
    const late = Math.max(0, arrival - s.windowEnd);
    const depart = start + s.durationMins + cfg.bufferMins;
    stops.push({ id: s.id, legMins, legMiles, arrival, start, waitMins: wait, lateMins: late, depart });
    driveMins += legMins;
    driveMiles += legMiles;
    serviceMins += s.durationMins;
    waitMins += wait;
    if (late > 0.5) {
      lateMins += late;
      lateCount++;
    }
    t = depart;
    prev = s.point;
  }
  const back = cfg.leg(prev, cfg.base);
  const returnLegMins = order.length ? back.seconds / 60 : 0;
  const returnLegMiles = order.length ? back.meters / M_PER_MI : 0;
  const returnBase = order.length ? t - cfg.bufferMins + returnLegMins : leaveBase;
  driveMins += returnLegMins;
  driveMiles += returnLegMiles;

  return {
    stops,
    leaveBase,
    returnBase,
    returnLegMins,
    returnLegMiles,
    driveMins,
    driveMiles,
    serviceMins,
    waitMins,
    lateMins,
    lateCount,
    overtimeMins: Math.max(0, returnBase - cfg.dayEnd),
  };
}

/** Cache leg lookups by object identity — optimizers evaluate the same pairs thousands of times. */
export const withMemo = (cfg: DayConfig): DayConfig => {
  const cache = new Map<GeoPoint, Map<GeoPoint, LegCost>>();
  return {
    ...cfg,
    leg: (a, b) => {
      let row = cache.get(a);
      if (!row) cache.set(a, (row = new Map()));
      let v = row.get(b);
      if (!v) {
        v = cfg.leg(a, b);
        row.set(b, v);
      }
      return v;
    },
  };
};

export type OptimizeMode = 'keep-windows' | 'replan-windows';

/** Lower is better. Lateness and overtime dominate so feasible plans always win. */
export const planCost = (p: DayPlan, mode: OptimizeMode) =>
  p.driveMins + p.lateMins * 8 + p.lateCount * 30 + p.overtimeMins * 4 + (mode === 'keep-windows' ? p.waitMins * 0.25 : 0);

const relax = (s: StopInput, cfg: DayConfig): StopInput =>
  s.pinned || s.locked ? s : { ...s, windowStart: cfg.dayStart, windowEnd: cfg.dayEnd };

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

export interface OptimizeResult {
  order: StopInput[];
  plan: DayPlan;
  before: DayPlan;
  savedMins: number;
  savedMiles: number;
  changed: boolean;
}

/**
 * Re-order a day's stops to minimise drive time.
 * keep-windows: promised arrival windows are respected (lateness is heavily penalised).
 * replan-windows: unpinned windows are ignored; caller assigns fresh windows from the new ETAs.
 */
export function optimize(stops: StopInput[], rawCfg: DayConfig, mode: OptimizeMode): OptimizeResult {
  const cfg = withMemo(rawCfg);
  const locked = stops.filter((s) => s.locked);
  const free = stops.filter((s) => !s.locked);
  const work = mode === 'replan-windows' ? free.map((s) => relax(s, cfg)) : free;
  const byId = new Map(stops.map((s) => [s.id, s]));

  const evalOrder = (o: StopInput[]) => planCost(simulate([...locked, ...o], cfg), mode);
  const beforePlan = simulate(stops, cfg);

  let best = work.slice();
  let bestCost = evalOrder(best);

  if (work.length <= 8) {
    for (const p of permutations(work)) {
      const c = evalOrder(p);
      if (c < bestCost - 1e-6) {
        best = p;
        bestCost = c;
      }
    }
  } else {
    // Nearest-neighbour seeds + 2-opt + relocate local search.
    const seeds: StopInput[][] = [work.slice()];
    const nn: StopInput[] = [];
    const left = work.slice();
    let cur = locked.length ? locked[locked.length - 1].point : cfg.base;
    while (left.length) {
      let bi = 0;
      let bd = Infinity;
      left.forEach((s, i) => {
        const d = cfg.leg(cur, s.point).seconds + Math.max(0, s.windowStart - cfg.dayStart) * 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const [s] = left.splice(bi, 1);
      nn.push(s);
      cur = s.point;
    }
    seeds.push(nn);
    seeds.push(work.slice().sort((a, b) => a.windowStart - b.windowStart));
    for (const seed of seeds) {
      let o = seed.slice();
      let c = evalOrder(o);
      let improved = true;
      let guard = 0;
      while (improved && guard++ < 60) {
        improved = false;
        for (let i = 0; i < o.length - 1; i++) {
          for (let k = i + 1; k < o.length; k++) {
            const cand = [...o.slice(0, i), ...o.slice(i, k + 1).reverse(), ...o.slice(k + 1)];
            const cc = evalOrder(cand);
            if (cc < c - 1e-6) {
              o = cand;
              c = cc;
              improved = true;
            }
          }
        }
        for (let i = 0; i < o.length; i++) {
          for (let j = 0; j < o.length; j++) {
            if (i === j) continue;
            const cand = o.slice();
            const [s] = cand.splice(i, 1);
            cand.splice(j, 0, s);
            const cc = evalOrder(cand);
            if (cc < c - 1e-6) {
              o = cand;
              c = cc;
              improved = true;
            }
          }
        }
      }
      if (c < bestCost - 1e-6) {
        best = o;
        bestCost = c;
      }
    }
  }

  // Report with original windows restored for keep-windows; relaxed windows for replan.
  const finalOrder = [...locked, ...best.map((s) => (mode === 'replan-windows' ? s : byId.get(s.id)!))];
  const plan = simulate(finalOrder, cfg);
  const changed = finalOrder.some((s, i) => s.id !== stops[i]?.id);
  return {
    order: finalOrder.map((s) => byId.get(s.id)!),
    plan,
    before: beforePlan,
    savedMins: beforePlan.driveMins - plan.driveMins,
    savedMiles: beforePlan.driveMiles - plan.driveMiles,
    changed,
  };
}

/** Promise a window around an ETA: e.g. ETA 10:12 with 120-min windows → 9:30–11:30. */
export const windowAround = (eta: number, windowMins: number, dayStart = 0) => {
  const lead = Math.min(60, Math.round(windowMins / 3));
  const start = Math.max(roundTo(dayStart, 15, 'floor'), roundTo(eta - lead, 30, 'floor'));
  return { start, end: start + windowMins };
};

// ---- smart slot finder ----------------------------------------------------------------------

export interface CandidateDay {
  teamId: string;
  date: string;
  cfg: DayConfig;
  stops: StopInput[];
}

export interface SlotRequest {
  point: GeoPoint;
  durationMins: number;
  windowMins: number;
  dayPart: 'any' | 'am' | 'pm';
  /** Minutes-from-midnight bounds within the day, e.g. not before 10:00 today. */
  notBefore?: Record<string, number>;
}

export interface SlotOption {
  teamId: string;
  date: string;
  position: number; // index in the day's stop list where the new stop is inserted
  eta: number;
  windowStart: number;
  windowEnd: number;
  addedDriveMins: number;
  addedMiles: number;
  dayPlan: DayPlan;
  stopsThatDay: number;
  prevStopId?: string;
  nextStopId?: string;
  nearestStopId?: string;
  nearestStopMiles?: number;
  overtimeMins: number;
}

export function findSlots(req: SlotRequest, days: CandidateDay[]): SlotOption[] {
  const out: SlotOption[] = [];
  for (const day of days) {
    const { stops } = day;
    const cfg = withMemo(day.cfg);
    const base = simulate(stops, cfg);
    const lockedCount = stops.filter((s) => s.locked).length;
    const bestByPart = new Map<string, SlotOption>();
    const floor = req.notBefore?.[day.date] ?? cfg.dayStart;

    // Nearest existing stop (for the "near 3 booked visits" explanation).
    let nearestStopId: string | undefined;
    let nearestStopMiles = Infinity;
    for (const s of stops) {
      const mi = cfg.leg(req.point, s.point).meters / M_PER_MI;
      if (mi < nearestStopMiles) {
        nearestStopMiles = mi;
        nearestStopId = s.id;
      }
    }

    for (let pos = lockedCount; pos <= stops.length; pos++) {
      const newStop: StopInput = {
        id: '__new__',
        point: req.point,
        durationMins: req.durationMins,
        windowStart: Math.max(cfg.dayStart, floor),
        windowEnd: cfg.dayEnd,
      };
      const order = [...stops.slice(0, pos), newStop, ...stops.slice(pos)];
      const plan = simulate(order, cfg);
      const ns = plan.stops[pos];
      if (ns.start < floor) continue;
      if (plan.lateMins > base.lateMins + 2) continue; // would make an existing client late
      if (plan.overtimeMins > Math.max(base.overtimeMins, 0) + 10) continue;
      const part = ns.start < 12 * 60 ? 'am' : 'pm';
      if (req.dayPart !== 'any' && req.dayPart !== part) continue;

      const w = windowAround(ns.start, req.windowMins, cfg.dayStart);
      const opt: SlotOption = {
        teamId: day.teamId,
        date: day.date,
        position: pos,
        eta: ns.start,
        windowStart: w.start,
        windowEnd: w.end,
        addedDriveMins: plan.driveMins - base.driveMins,
        addedMiles: plan.driveMiles - base.driveMiles,
        dayPlan: plan,
        stopsThatDay: stops.length,
        prevStopId: stops[pos - 1]?.id,
        nextStopId: stops[pos]?.id,
        nearestStopId,
        nearestStopMiles: Number.isFinite(nearestStopMiles) ? nearestStopMiles : undefined,
        overtimeMins: plan.overtimeMins,
      };
      const cur = bestByPart.get(part);
      if (!cur || opt.addedDriveMins < cur.addedDriveMins) bestByPart.set(part, opt);
    }
    out.push(...bestByPart.values());
  }
  return out;
}

export interface RankedSlot extends SlotOption {
  score: number;
  badges: string[];
}

/** Rank by added driving, nudged toward sooner dates (more strongly for urgent visits). */
export function rankSlots(
  slots: SlotOption[],
  today: string,
  urgency: 'routine' | 'soon' | 'urgent',
  daysOut: (date: string) => number,
): RankedSlot[] {
  const perDay = urgency === 'urgent' ? 25 : urgency === 'soon' ? 6 : 1.5;
  const ranked = slots
    .map((s) => ({ ...s, score: s.addedDriveMins + daysOut(s.date) * perDay + s.overtimeMins * 2, badges: [] as string[] }))
    .sort((a, b) => a.score - b.score);
  if (!ranked.length) return ranked;
  const minDrive = Math.min(...ranked.map((r) => r.addedDriveMins));
  const soonest = ranked.reduce((a, b) => (a.date < b.date || (a.date === b.date && a.eta < b.eta) ? a : b));
  ranked.forEach((r) => {
    if (r === ranked[0]) r.badges.push('Recommended');
    if (Math.abs(r.addedDriveMins - minDrive) < 0.5) r.badges.push('Least driving');
    if (r === soonest) r.badges.push(r.date === today ? 'Today' : 'Soonest');
    if (r.stopsThatDay === 0) r.badges.push('Open day');
    else if ((r.nearestStopMiles ?? 99) < 2.5) r.badges.push('Neighbor on route');
    if (r.overtimeMins > 0) r.badges.push('Runs late');
  });
  return ranked;
}
