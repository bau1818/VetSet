import type { Appointment, Client, DateStr, ID, Invoice, Pet, Reminder } from './types';
import type { DataState } from './store';
import { joinNames } from '../lib/templates';
import { todayStr } from '../lib/time';

type S = Pick<DataState, 'clients' | 'pets' | 'appointments' | 'invoices' | 'services' | 'staff' | 'teams' | 'reminders'>;

export const clientName = (c?: Client) => (c ? `${c.firstName} ${c.lastName}` : 'Unknown client');
export const byId = <T extends { id: ID }>(list: T[], id?: ID) => (id ? list.find((x) => x.id === id) : undefined);

export const petsOf = (s: Pick<S, 'pets'>, clientId: ID, includeDeceased = false) =>
  s.pets.filter((p) => p.clientId === clientId && (includeDeceased || p.status === 'active'));

export const petNames = (s: Pick<S, 'pets'>, ids: ID[]) => joinNames(ids.map((id) => byId(s.pets, id)?.name ?? '?'));

export const serviceNames = (s: Pick<S, 'services'>, ids: ID[]) => ids.map((id) => byId(s.services, id)?.name ?? '?').join(', ');

export const doctorOf = (s: Pick<S, 'teams' | 'staff'>, teamId: ID) => {
  const t = byId(s.teams, teamId);
  return byId(s.staff, t?.doctorId);
};
export const driverOf = (s: Pick<S, 'teams' | 'staff'>, teamId: ID) => {
  const t = byId(s.teams, teamId);
  return byId(s.staff, t?.driverId);
};
export const shortDoctor = (name?: string) => (name ? name.replace(/^Dr\.\s+(\S+)\s+(.+)$/, 'Dr. $2') : '');

export const invoiceBalance = (i: Invoice) => (i.status === 'void' ? 0 : Math.max(0, i.total - i.amountPaid));

export interface ClientStats {
  lastVisit?: DateStr;
  nextAppt?: Appointment;
  lifetimeValue: number;
  balance: number;
  overdue: boolean;
  visits: number;
}

export const clientStats = (s: S, clientId: ID, today = todayStr()): ClientStats => {
  let lastVisit: DateStr | undefined;
  let nextAppt: Appointment | undefined;
  let visits = 0;
  for (const a of s.appointments) {
    if (a.clientId !== clientId) continue;
    if (a.status === 'completed') {
      visits++;
      if (!lastVisit || a.date > lastVisit) lastVisit = a.date;
    } else if (a.date >= today && !['cancelled', 'no_show', 'completed'].includes(a.status)) {
      if (!nextAppt || a.date < nextAppt.date || (a.date === nextAppt.date && a.sequence < nextAppt.sequence)) nextAppt = a;
    }
  }
  let lifetimeValue = 0;
  let balance = 0;
  let overdue = false;
  for (const i of s.invoices) {
    if (i.clientId !== clientId || i.status === 'void') continue;
    lifetimeValue += i.amountPaid;
    balance += invoiceBalance(i);
    if (i.status === 'overdue') overdue = true;
  }
  return { lastVisit, nextAppt, lifetimeValue, balance, overdue, visits };
};

export const remindersFor = (s: Pick<S, 'reminders'>, petIds: ID[], statuses: Reminder['status'][] = ['due', 'contacted']) =>
  s.reminders.filter((r) => petIds.includes(r.petId) && statuses.includes(r.status));

export const petAlerts = (pets: Pet[]) => pets.flatMap((p) => p.alerts.map((a) => ({ pet: p.name, alert: a })));

export const searchClients = (s: Pick<S, 'clients' | 'pets'>, q: string, limit = 8) => {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const digits = t.replace(/\D/g, '');
  const scored: { c: Client; score: number; pet?: Pet }[] = [];
  for (const c of s.clients) {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    let score = 0;
    if (name.startsWith(t) || c.lastName.toLowerCase().startsWith(t)) score = 3;
    else if (name.includes(t)) score = 2;
    else if (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) score = 2;
    else if (c.email.toLowerCase().includes(t) || c.address.line1.toLowerCase().includes(t) || c.address.city.toLowerCase().includes(t)) score = 1;
    const pet = s.pets.find((p) => p.clientId === c.id && p.name.toLowerCase().startsWith(t));
    if (pet) score = Math.max(score, 2.5);
    if (score) scored.push({ c, score, pet });
  }
  return scored.sort((a, b) => b.score - a.score || a.c.lastName.localeCompare(b.c.lastName)).slice(0, limit);
};

/** The practice owner: the lead doctor (first unit's doctor). The office/owner view is theirs. */
export const ownerOf = (s: Pick<S, 'teams' | 'staff'>) => byId(s.staff, s.teams[0]?.doctorId) ?? s.staff.find((x) => x.role === 'doctor');
