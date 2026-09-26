import type { GeoPoint, Service, Settings, Team } from '../data/types';
import { hasGeo, milesBetween } from './geo';
import { getLeg } from './travel';

export const MIN_VISIT_MINS = 20;

/** Visit length: each service's time for the first pet plus its per-pet increment for the others. */
export const visitDuration = (services: Service[], petCount: number): number => {
  const pets = Math.max(1, petCount);
  const total = services.reduce((sum, s) => sum + s.durationMins + s.extraPetMins * (pets - 1), 0);
  return Math.max(MIN_VISIT_MINS, Math.ceil(total / 5) * 5);
};

export const servicesSubtotal = (services: Service[], petCount: number) =>
  services.reduce((sum, s) => sum + s.price * Math.max(1, petCount), 0);

/** Road miles from the unit's base when we have them, otherwise a straight-line estimate. */
export const milesFromBase = (team: Team | undefined, point: Partial<GeoPoint> | undefined): number | undefined => {
  if (!team || !hasGeo(point)) return undefined;
  const leg = getLeg(team.base, point);
  return leg.estimated ? milesBetween(team.base, point) * 1.25 : leg.meters / 1609.344;
};

export interface TripFee {
  fee: number;
  label: string;
  outOfArea: boolean;
  miles?: number;
}

export const tripFeeFor = (settings: Settings, miles: number | undefined): TripFee => {
  const zones = [...settings.tripFeeZones].sort((a, b) => a.maxMiles - b.maxMiles);
  if (miles === undefined) return { fee: zones[0]?.fee ?? 0, label: zones[0]?.label ?? 'Standard', outOfArea: false };
  const zone = zones.find((z) => miles <= z.maxMiles);
  if (zone) return { fee: zone.fee, label: zone.label, outOfArea: false, miles };
  return { fee: settings.outOfAreaFee, label: 'Outside service area', outOfArea: true, miles };
};
