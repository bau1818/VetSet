// Business operations. Each one updates the store (and therefore the repository) atomically enough
// for a single-user demo; with Supabase these become RPCs / transactions.
import { addMonths, format, parseISO } from 'date-fns';
import type {
  Appointment,
  AppointmentStatus,
  Channel,
  Client,
  Communication,
  DateStr,
  ID,
  Invoice,
  MessageTemplate,
  Pet,
  Task,
  TimeStr,
} from './types';
import { patch, upsert, upsertMany, useData } from './store';
import { dayAppointments } from './planning';
import { byId, clientName, doctorOf, petNames, shortDoctor } from './selectors';
import { uid } from '../lib/id';
import { fillTemplate } from '../lib/templates';
import { fmtDate, fmtTime, fmtWindow, shiftDate, todayStr } from '../lib/time';
import { money } from '../lib/format';

const now = () => new Date().toISOString();
const state = () => useData.getState();
const actor = () => 'Office';

/** Renumber a unit's day so sequences are 1..n in the given order. */
export const resequence = (teamId: ID, date: DateStr, orderedIds?: ID[]) => {
  const s = state();
  const day = dayAppointments(s, teamId, date);
  const order = orderedIds ? orderedIds.map((id) => day.find((a) => a.id === id)!).filter(Boolean) : day;
  const rest = day.filter((a) => !order.includes(a));
  const changed = [...order, ...rest]
    .map((a, i) => (a.sequence === i + 1 ? null : { ...a, sequence: i + 1 }))
    .filter(Boolean) as Appointment[];
  upsertMany('appointments', changed);
};

export interface BookInput {
  clientId: ID;
  petIds: ID[];
  serviceIds: ID[];
  teamId: ID;
  date: DateStr;
  windowStart: TimeStr;
  windowEnd: TimeStr;
  /** Index in the unit's day route to insert at. */
  position: number;
  durationMins: number;
  tripFee: number;
  estimatedTotal: number;
  reason: string;
  internalNotes?: string;
  source: Appointment['source'];
  pinned?: boolean;
}

export const bookAppointment = (input: BookInput, rescheduleId?: ID): Appointment => {
  const s = state();
  const existing = rescheduleId ? byId(s.appointments, rescheduleId) : undefined;
  const day = dayAppointments(s, input.teamId, input.date, rescheduleId);
  const appt: Appointment = {
    ...(existing ?? { createdAt: now(), status: 'scheduled' as AppointmentStatus, internalNotes: '' }),
    id: existing?.id ?? uid('apt'),
    clientId: input.clientId,
    petIds: input.petIds,
    serviceIds: input.serviceIds,
    teamId: input.teamId,
    date: input.date,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    sequence: input.position + 1,
    durationMins: input.durationMins,
    status: existing && existing.status === 'confirmed' ? 'scheduled' : existing?.status ?? 'scheduled',
    reason: input.reason,
    internalNotes: input.internalNotes ?? existing?.internalNotes ?? '',
    tripFee: input.tripFee,
    estimatedTotal: input.estimatedTotal,
    pinned: input.pinned ?? false,
    source: input.source,
  } as Appointment;
  upsert('appointments', appt);
  const order = [...day.slice(0, input.position).map((a) => a.id), appt.id, ...day.slice(input.position).map((a) => a.id)];
  resequence(input.teamId, input.date, order);
  if (existing && (existing.teamId !== input.teamId || existing.date !== input.date)) resequence(existing.teamId, existing.date);

  // Close the loop on recalls this visit covers.
  const covered = s.reminders.filter((r) => input.petIds.includes(r.petId) && input.serviceIds.includes(r.serviceId) && r.status !== 'booked');
  upsertMany('reminders', covered.map((r) => ({ ...r, status: 'booked' as const })));

  logCommunication({
    clientId: input.clientId,
    appointmentId: appt.id,
    channel: 'note',
    direction: 'out',
    subject: existing ? 'Appointment rescheduled' : 'Appointment booked',
    body: `${existing ? 'Moved to' : 'Booked for'} ${fmtDate(input.date, 'EEE, MMM d')}, arriving ${fmtWindow(input.windowStart, input.windowEnd)}.`,
  });
  return appt;
};

export const setStatus = (id: ID, status: AppointmentStatus, extra: Partial<Appointment> = {}) => {
  const stamp: Partial<Appointment> = {};
  if (status === 'confirmed') stamp.confirmedAt = now();
  if (status === 'en_route') stamp.enRouteAt = now();
  if (status === 'arrived') stamp.arrivedAt = now();
  if (status === 'completed') stamp.completedAt = now();
  if (status === 'cancelled') stamp.cancelledAt = now();
  patch('appointments', id, { status, ...stamp, ...extra });
};

export const cancelAppointment = (id: ID, reason: string, status: 'cancelled' | 'no_show' = 'cancelled') => {
  const a = byId(state().appointments, id);
  if (!a) return;
  setStatus(id, status, status === 'cancelled' ? { cancelReason: reason } : {});
  resequence(a.teamId, a.date);
  const s = state();
  upsertMany(
    'reminders',
    s.reminders.filter((r) => a.petIds.includes(r.petId) && a.serviceIds.includes(r.serviceId) && r.status === 'booked').map((r) => ({ ...r, status: 'due' as const })),
  );
  logCommunication({
    clientId: a.clientId,
    appointmentId: id,
    channel: 'note',
    direction: 'out',
    subject: status === 'no_show' ? 'No-show' : 'Appointment cancelled',
    body: reason || (status === 'no_show' ? 'Client was not home.' : 'Cancelled.'),
  });
};

/** Completes a visit: creates the invoice and rolls recalls forward. */
export const completeAppointment = (id: ID, opts: { paidNow?: boolean; method?: Invoice['method'] } = {}) => {
  const s = state();
  const a = byId(s.appointments, id);
  if (!a) return;
  setStatus(id, 'completed');
  const lines = a.serviceIds.map((sid) => {
    const svc = byId(s.services, sid)!;
    return { description: svc.name, qty: a.petIds.length, unitPrice: svc.price };
  });
  if (a.tripFee) lines.push({ description: 'House-call trip fee', qty: 1, unitPrice: a.tripFee });
  const total = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const number = Math.max(1000, ...s.invoices.map((i) => Number(i.number.replace(/\D/g, '')) || 0)) + 1;
  const today = todayStr();
  const inv: Invoice = {
    id: uid('inv'),
    number: `INV-${number}`,
    clientId: a.clientId,
    appointmentId: a.id,
    lines,
    total,
    amountPaid: opts.paidNow ? total : 0,
    status: opts.paidNow ? 'paid' : 'sent',
    issuedAt: today,
    dueAt: shiftDate(today, s.settings.invoiceDueDays),
    paidAt: opts.paidNow ? today : undefined,
    method: opts.paidNow ? opts.method ?? 'card' : undefined,
  };
  upsert('invoices', inv);

  // Recalls: next due date for each recall-able service, per pet.
  const reminders = [...state().reminders];
  a.serviceIds.forEach((sid) => {
    const svc = byId(s.services, sid);
    if (!svc?.recallMonths) return;
    a.petIds.forEach((pid) => {
      const due = format(addMonths(parseISO(a.date), svc.recallMonths!), 'yyyy-MM-dd');
      const ex = reminders.find((r) => r.petId === pid && r.serviceId === sid);
      upsert('reminders', ex ? { ...ex, dueDate: due, status: 'due', contactCount: 0, lastContactAt: undefined } : { id: uid('rem'), clientId: a.clientId, petId: pid, serviceId: sid, dueDate: due, status: 'due', contactCount: 0 });
    });
  });
  return inv;
};

export const recordPayment = (invoiceId: ID, amount: number, method: Invoice['method']) => {
  const inv = byId(state().invoices, invoiceId);
  if (!inv) return;
  const amountPaid = Math.min(inv.total, inv.amountPaid + amount);
  patch('invoices', invoiceId, {
    amountPaid,
    method,
    status: amountPaid >= inv.total ? 'paid' : inv.status,
    paidAt: amountPaid >= inv.total ? todayStr() : inv.paidAt,
  });
  logCommunication({ clientId: inv.clientId, channel: 'note', direction: 'in', subject: 'Payment received', body: `${money(amount, true)} by ${method} on ${inv.number}.` });
};

/** Apply a new stop order (and optionally new promised windows) to a unit's day. */
export const applyRouteOrder = (teamId: ID, date: DateStr, orderedIds: ID[], windows?: Record<ID, { start: TimeStr; end: TimeStr }>) => {
  const s = state();
  if (windows) {
    const changed = Object.entries(windows)
      .map(([id, w]) => {
        const a = byId(s.appointments, id);
        if (!a || (a.windowStart === w.start && a.windowEnd === w.end)) return null;
        return { ...a, windowStart: w.start, windowEnd: w.end };
      })
      .filter(Boolean) as Appointment[];
    upsertMany('appointments', changed);
    changed.forEach((a) =>
      logCommunication({
        clientId: a.clientId,
        appointmentId: a.id,
        channel: 'note',
        direction: 'out',
        subject: 'Arrival window updated',
        body: `Route optimized — new window ${fmtWindow(a.windowStart, a.windowEnd)}. Client needs to be notified.`,
      }),
    );
  }
  resequence(teamId, date, orderedIds);
};

export const logCommunication = (c: Omit<Communication, 'id' | 'createdAt' | 'by'> & { by?: string }) => {
  const entry: Communication = { id: uid('com'), createdAt: now(), by: c.by ?? actor(), ...c };
  upsert('communications', entry);
  return entry;
};

/** Render a template for an appointment/client with all merge fields filled in. */
export const renderTemplate = (tpl: MessageTemplate | undefined, ctx: { clientId: ID; appointmentId?: ID; petIds?: ID[]; extra?: Record<string, string | number> }) => {
  if (!tpl) return '';
  const s = state();
  const client = byId(s.clients, ctx.clientId);
  const appt = ctx.appointmentId ? byId(s.appointments, ctx.appointmentId) : undefined;
  const doctor = appt ? doctorOf(s, appt.teamId) : undefined;
  const balance = s.invoices.filter((i) => i.clientId === ctx.clientId).reduce((t, i) => t + Math.max(0, i.total - i.amountPaid), 0);
  return fillTemplate(tpl.body, {
    client_first: client?.firstName,
    pet_names: petNames(s, ctx.petIds ?? appt?.petIds ?? []),
    date: appt ? fmtDate(appt.date, 'EEEE, MMM d') : undefined,
    window: appt ? fmtWindow(appt.windowStart, appt.windowEnd) : undefined,
    doctor: shortDoctor(doctor?.name),
    business: s.settings.businessName,
    phone: s.settings.phone,
    balance: money(balance),
    ...ctx.extra,
  });
};

export const templateByKey = (key: MessageTemplate['key']) => state().templates.find((t) => t.key === key);

export const sendMessage = (opts: { clientId: ID; appointmentId?: ID; channel: Channel; subject: string; body: string }) =>
  logCommunication({ ...opts, direction: 'out' });

export const saveClient = (c: Client) => upsert('clients', c);
export const savePet = (p: Pet) => upsert('pets', p);

export const newClientDraft = (): Client => ({
  id: uid('cl'),
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  preferredContact: 'sms',
  address: { line1: '', city: '', state: 'TX', zip: '' },
  accessNotes: '',
  tags: [],
  referralSource: '',
  preferredTime: 'any',
  status: 'active',
  notes: '',
  createdAt: now(),
});

export const newPetDraft = (clientId: ID): Pet => ({
  id: uid('pet'),
  clientId,
  name: '',
  species: 'dog',
  breed: '',
  sex: 'U',
  color: '',
  alerts: [],
  status: 'active',
  notes: '',
});

export const addTask = (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => upsert('tasks', { ...t, id: uid('tsk'), createdAt: now(), done: false });
export const toggleTask = (id: ID) => {
  const t = byId(state().tasks, id);
  if (t) patch('tasks', id, { done: !t.done });
};

export const markPetDeceased = (petId: ID) => {
  patch('pets', petId, { status: 'deceased' });
  const s = state();
  upsertMany('reminders', s.reminders.filter((r) => r.petId === petId && r.status !== 'dismissed').map((r) => ({ ...r, status: 'dismissed' as const })));
};

export const describeAppt = (a: Appointment) => {
  const s = state();
  return `${clientName(byId(s.clients, a.clientId))} · ${petNames(s, a.petIds)} · ${fmtDate(a.date)} ${fmtTime(a.windowStart, true)}`;
};
