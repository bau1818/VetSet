import type { Address, GeoPoint } from '../data/types';

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
};

export const kmToMiles = (km: number) => km * 0.621371;
export const milesBetween = (a: GeoPoint, b: GeoPoint) => kmToMiles(haversineKm(a, b));

/** Offline estimate used until (or if) the road-network service answers: detour factor + blended suburban speed. */
export const estimateLeg = (a: GeoPoint, b: GeoPoint) => {
  const km = haversineKm(a, b) * 1.32;
  const mins = km < 0.05 ? 0 : 3 + (km / 48) * 60;
  return { seconds: mins * 60, meters: km * 1000 };
};

export const hasGeo = (a?: Partial<GeoPoint> | null): a is GeoPoint =>
  !!a && typeof a.lat === 'number' && typeof a.lng === 'number' && !Number.isNaN(a.lat) && !Number.isNaN(a.lng);

export const pointKey = (p: GeoPoint) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export const fmtAddress = (a: Address, withZip = false) =>
  [a.line1, a.city, withZip ? `${a.state} ${a.zip}`.trim() : a.state].filter(Boolean).join(', ');

export const googleNavUrl = (to: GeoPoint) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;

export const appleNavUrl = (to: GeoPoint) => `https://maps.apple.com/?daddr=${to.lat},${to.lng}&dirflg=d`;

/** Full multi-stop day route in Google Maps (origin → waypoints → destination). */
export const googleRouteUrl = (points: GeoPoint[]) => {
  if (points.length < 2) return '';
  const [origin, ...rest] = points;
  const dest = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1).slice(0, 9);
  const f = (p: GeoPoint) => `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${f(origin)}&destination=${f(dest)}${
    waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.map(f).join('|'))}` : ''
  }&travelmode=driving`;
};
