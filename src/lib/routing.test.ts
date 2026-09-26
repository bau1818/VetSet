import { describe, expect, it } from 'vitest';
import { findSlots, optimize, rankSlots, simulate, windowAround, type DayConfig, type StopInput } from './routing';

// Toy geometry: 1 unit of latitude or longitude = 10 minutes and 5 miles (Manhattan distance).
const leg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const d = Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);
  return { seconds: d * 600, meters: d * 5 * 1609.344 };
};
const cfg: DayConfig = { base: { lat: 0, lng: 0 }, dayStart: 8 * 60, dayEnd: 17 * 60, bufferMins: 0, leg };
const stop = (id: string, lat: number, lng: number, ws = 8 * 60, we = 17 * 60, dur = 30): StopInput => ({
  id,
  point: { lat, lng },
  durationMins: dur,
  windowStart: ws,
  windowEnd: we,
});

describe('simulate', () => {
  it('computes arrivals, waits and the return leg', () => {
    const p = simulate([stop('a', 1, 0, 9 * 60), stop('b', 2, 0)], cfg);
    // Leaves base 8:50 to arrive at a's 9:00 window start.
    expect(p.leaveBase).toBe(8 * 60 + 50);
    expect(p.stops[0].arrival).toBe(9 * 60);
    expect(p.stops[1].arrival).toBe(9 * 60 + 30 + 10);
    expect(p.driveMins).toBe(10 + 10 + 20);
    expect(p.driveMiles).toBeCloseTo(20);
    expect(p.lateCount).toBe(0);
  });

  it('flags lateness and overtime', () => {
    const p = simulate([stop('a', 5, 0, 8 * 60, 8 * 60 + 20, 500)], cfg);
    expect(p.lateCount).toBe(1);
    expect(p.lateMins).toBeCloseTo(30);
    expect(p.overtimeMins).toBeGreaterThan(0);
  });
});

describe('optimize', () => {
  it('untangles a zig-zag route', () => {
    const zig = [stop('a', 1, 0), stop('b', 3, 0), stop('c', 2, 0), stop('d', 4, 0)];
    const r = optimize(zig, cfg, 'keep-windows');
    // Round trip on a line: any order that sweeps out and back once is optimal (80 min).
    expect(r.plan.driveMins).toBeCloseTo(80);
    expect(r.savedMins).toBeCloseTo(20);
    expect(r.changed).toBe(true);
  });

  it('keeps promised windows when asked to', () => {
    // d is far but promised first thing; keep-windows must still visit it on time.
    const stops = [stop('a', 1, 0), stop('d', 6, 0, 8 * 60, 9 * 60)];
    const kept = optimize(stops, cfg, 'keep-windows');
    expect(kept.plan.lateCount).toBe(0);
    expect(kept.order[0].id).toBe('d');
  });

  it('handles larger days with local search', () => {
    const many = Array.from({ length: 11 }, (_, i) => stop(`s${i}`, (i * 7) % 11, (i * 3) % 5));
    const r = optimize(many, cfg, 'replan-windows');
    expect(r.plan.driveMins).toBeLessThanOrEqual(r.before.driveMins);
    expect(new Set(r.order.map((s) => s.id)).size).toBe(11);
  });

  it('never moves locked (finished) stops', () => {
    const stops = [{ ...stop('done', 5, 0), locked: true }, stop('a', 1, 0), stop('b', 4, 0)];
    const r = optimize(stops, cfg, 'replan-windows');
    expect(r.order[0].id).toBe('done');
  });
});

describe('findSlots', () => {
  it('inserts a new visit next to its neighbour with minimal added driving', () => {
    const day = { teamId: 't1', date: '2026-10-01', cfg, stops: [stop('a', 1, 0), stop('b', 3, 0)] };
    const far = { teamId: 't2', date: '2026-10-01', cfg, stops: [stop('x', 0, 5)] };
    const slots = findSlots({ point: { lat: 2, lng: 0 }, durationMins: 30, windowMins: 120, dayPart: 'any' }, [day, far]);
    const best = slots.sort((p, q) => p.addedDriveMins - q.addedDriveMins)[0];
    expect(best.teamId).toBe('t1');
    expect(best.position).toBe(1);
    expect(best.addedDriveMins).toBeCloseTo(0);
    expect(best.windowStart).toBeLessThanOrEqual(best.eta);
    expect(best.windowEnd).toBeGreaterThan(best.eta);
  });

  it('refuses slots that would make an existing client late', () => {
    const tight = { teamId: 't1', date: '2026-10-01', cfg, stops: [stop('a', 1, 0, 8 * 60, 9 * 60, 30)] };
    const slots = findSlots({ point: { lat: 0, lng: 6 }, durationMins: 120, windowMins: 120, dayPart: 'any' }, [tight]);
    expect(slots.every((s) => s.position === 1)).toBe(true);
  });

  it('honours AM/PM preference and ranks with badges', () => {
    const day = { teamId: 't1', date: '2026-10-02', cfg, stops: [stop('a', 1, 0)] };
    const pm = findSlots({ point: { lat: 1, lng: 1 }, durationMins: 30, windowMins: 120, dayPart: 'pm' }, [day]);
    expect(pm.every((s) => s.eta >= 12 * 60)).toBe(true);
    const ranked = rankSlots(findSlots({ point: { lat: 1, lng: 1 }, durationMins: 30, windowMins: 120, dayPart: 'any' }, [day]), '2026-10-01', 'routine', () => 1);
    expect(ranked[0].badges).toContain('Recommended');
  });
});

describe('windowAround', () => {
  it('wraps the ETA in a promised window on the half hour', () => {
    expect(windowAround(10 * 60 + 12, 120)).toEqual({ start: 9 * 60 + 30, end: 11 * 60 + 30 });
    expect(windowAround(8 * 60 + 5, 60, 8 * 60)).toEqual({ start: 8 * 60, end: 9 * 60 });
  });
});
