import { useEffect, useMemo } from 'react';
import type { Appointment, AppointmentStatus, DateStr, GeoPoint, ID, Team } from './types';
import { useData, type DataState } from './store';
import { hasGeo } from '../lib/geo';
import { simulate, type DayConfig, type DayPlan, type StopInput } from '../lib/routing';
import { ensureMatrix, getLeg, useTravelStore } from '../lib/travel';
import { toMin, weekday } from '../lib/time';

export const ROUTE_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'en_route', 'arrived', 'completed'];
export const LOCKED_STATUSES: AppointmentStatus[] = ['completed', 'arrived', 'en_route'];
export const isOnRoute = (a: Appointment) => ROUTE_STATUSES.includes(a.status);

export const legFn = (a: GeoPoint, b: GeoPoint) => getLeg(a, b);

export const dayConfig = (s: Pick<DataState, 'settings'>, team: Team, date: DateStr): DayConfig | null => {
  const h = team.hours[weekday(date)];
  if (!h) return null;
  return { base: team.base, dayStart: toMin(h.start), dayEnd: toMin(h.end), bufferMins: s.settings.bufferMins, leg: legFn };
};

/** A unit's routed appointments for a day, in stop order. */
export const dayAppointments = (s: Pick<DataState, 'appointments'>, teamId: ID, date: DateStr, excludeId?: ID) =>
  s.appointments
    .filter((a) => a.teamId === teamId && a.date === date && isOnRoute(a) && a.id !== excludeId)
    .sort((a, b) => a.sequence - b.sequence);

export const pointOf = (s: Pick<DataState, 'clients'>, a: Appointment): GeoPoint | undefined => {
  const c = s.clients.find((x) => x.id === a.clientId);
  return c && hasGeo(c.address) ? { lat: c.address.lat, lng: c.address.lng } : undefined;
};

export const toStops = (s: Pick<DataState, 'clients'>, appts: Appointment[]): StopInput[] =>
  appts.flatMap((a) => {
    const point = pointOf(s, a);
    if (!point) return [];
    return [
      {
        id: a.id,
        point,
        durationMins: a.durationMins,
        windowStart: toMin(a.windowStart),
        windowEnd: toMin(a.windowEnd),
        pinned: a.pinned,
        locked: LOCKED_STATUSES.includes(a.status),
      },
    ];
  });

export interface DayRoute {
  team: Team;
  date: DateStr;
  cfg: DayConfig | null;
  appointments: Appointment[];
  stops: StopInput[];
  plan: DayPlan | null;
  points: GeoPoint[];
}

export const buildDayRoute = (s: DataState, team: Team, date: DateStr): DayRoute => {
  const appointments = dayAppointments(s, team.id, date);
  const stops = toStops(s, appointments);
  const cfg = dayConfig(s, team, date);
  const plan = cfg ? simulate(stops, cfg) : stops.length ? simulate(stops, { base: team.base, dayStart: 480, dayEnd: 1020, bufferMins: s.settings.bufferMins, leg: legFn }) : null;
  return { team, date, cfg, appointments, stops, plan, points: [team.base, ...stops.map((x) => x.point)] };
};

/** Subscribe to real road data for these points; returns a version that changes when it arrives. */
export const useRoadData = (points: GeoPoint[]) => {
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
  useEffect(() => {
    if (points.length > 1) void ensureMatrix(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useTravelStore((t) => t.version);
};

export const useDayRoutes = (date: DateStr, teamIds?: ID[]) => {
  const state = useData();
  const teams = state.teams.filter((t) => t.active && (!teamIds || teamIds.includes(t.id)));
  const allPoints = useMemo(() => {
    const pts: GeoPoint[] = [];
    teams.forEach((t) => {
      pts.push(t.base);
      dayAppointments(state, t.id, date).forEach((a) => {
        const p = pointOf(state, a);
        if (p) pts.push(p);
      });
    });
    return pts;
  }, [state.appointments, state.clients, state.teams, date, teamIds?.join()]);
  const version = useRoadData(allPoints);
  return useMemo(
    () => teams.map((t) => buildDayRoute(state, t, date)),
    [state.appointments, state.clients, state.teams, state.settings, date, version, teamIds?.join()],
  );
};

export const useDayRoute = (teamId: ID | undefined, date: DateStr) => {
  const routes = useDayRoutes(date, teamId ? [teamId] : []);
  return routes[0] as DayRoute | undefined;
};
