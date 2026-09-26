import clsx from 'clsx';
import {
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  KeyRound,
  Mail,
  MapPin,
  MessageSquareText,
  Navigation,
  Pencil,
  Phone,
  Pin,
  PlusCircle,
  Receipt,
  TriangleAlert,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Appointment, Invoice } from '../data/types';
import { cancelAppointment, completeAppointment, setStatus } from '../data/actions';
import { byId, clientName, clientStats, doctorOf, driverOf, petsOf, remindersFor } from '../data/selectors';
import { patch, useData } from '../data/store';
import { compose, toast, useUi } from '../data/ui';
import { useDayRoute } from '../data/planning';
import { appleNavUrl, fmtAddress, googleNavUrl, hasGeo, milesBetween } from '../lib/geo';
import { money, phoneHref } from '../lib/format';
import { servicesSubtotal, visitDuration } from '../lib/pricing';
import { ageFromDob, fmtDate, fmtDuration, fmtTime, fmtWindow, relDay, toMin, toTime } from '../lib/time';
import { Badge, Button, Chip, Drawer, Field, IconButton, Input, LinkButton, Modal, Select, SpeciesIcon, StatusBadge, Textarea } from './ui';

export function AppointmentDrawer() {
  const id = useUi((u) => u.appointmentId);
  const close = () => useUi.getState().openAppointment(undefined);
  return (
    <Drawer open={!!id} onClose={close}>
      {id && <AppointmentPanel id={id} onClose={close} />}
    </Drawer>
  );
}

function AppointmentPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useData();
  const navigate = useNavigate();
  const a = byId(s.appointments, id);
  const route = useDayRoute(a?.teamId, a?.date ?? '');
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState<'cancelled' | 'no_show' | null>(null);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState(a?.internalNotes ?? '');

  if (!a) return <div className="p-6 text-sm text-slate-500">Appointment not found.</div>;
  const client = byId(s.clients, a.clientId);
  const team = byId(s.teams, a.teamId);
  const doctor = doctorOf(s, a.teamId);
  const driver = driverOf(s, a.teamId);
  const pets = a.petIds.map((pid) => byId(s.pets, pid)).filter(Boolean) as NonNullable<ReturnType<typeof byId<(typeof s.pets)[number]>>>[];
  const services = a.serviceIds.map((sid) => byId(s.services, sid)).filter(Boolean) as (typeof s.services)[number][];
  const stats = client ? clientStats(s, client.id) : undefined;
  const due = remindersFor(s, a.petIds).filter((r) => !a.serviceIds.includes(r.serviceId));
  const planned = route?.plan?.stops.find((p) => p.id === a.id);
  const invoice = s.invoices.find((i) => i.appointmentId === a.id);
  const comms = s.communications.filter((c) => c.appointmentId === a.id).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  const geo = client && hasGeo(client.address) ? client.address : undefined;
  const active = !['completed', 'cancelled', 'no_show'].includes(a.status);

  const addService = (serviceId: string) => {
    const ids = [...a.serviceIds, serviceId];
    const srv = ids.map((x) => byId(s.services, x)!).filter(Boolean);
    patch('appointments', a.id, { serviceIds: ids, durationMins: visitDuration(srv, a.petIds.length), estimatedTotal: servicesSubtotal(srv, a.petIds.length) + a.tripFee });
    const r = s.reminders.find((x) => a.petIds.includes(x.petId) && x.serviceId === serviceId);
    if (r) patch('reminders', r.id, { status: 'booked' });
    toast(`${byId(s.services, serviceId)?.name} added to this visit`);
  };

  const primary = (() => {
    switch (a.status) {
      case 'requested':
      case 'scheduled':
        return (
          <>
            <Button variant="primary" icon={CheckCircle2} onClick={() => { setStatus(a.id, 'confirmed'); toast('Marked confirmed'); }}>
              Mark confirmed
            </Button>
            <Button icon={MessageSquareText} onClick={() => compose({ clientId: a.clientId, appointmentId: a.id, templateKey: 'confirm' })}>
              Send confirmation
            </Button>
          </>
        );
      case 'confirmed':
        return (
          <Button
            variant="primary"
            icon={Car}
            onClick={() => {
              setStatus(a.id, 'en_route');
              const eta = planned ? fmtTime(planned.arrival) : fmtTime(a.windowStart);
              compose({ clientId: a.clientId, appointmentId: a.id, templateKey: 'on_my_way', extra: { eta, minutes: planned ? Math.round(planned.legMins) : 20 } });
            }}
          >
            On my way
          </Button>
        );
      case 'en_route':
        return (
          <Button variant="primary" icon={MapPin} onClick={() => { setStatus(a.id, 'arrived'); toast('Arrived — visit started'); }}>
            Arrived
          </Button>
        );
      case 'arrived':
        return (
          <Button variant="primary" icon={CheckCircle2} onClick={() => setCompleting(true)}>
            Complete visit
          </Button>
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={a.status} />
            {a.pinned && (
              <Badge tone="amber" icon={Pin}>
                Time pinned
              </Badge>
            )}
            {planned && planned.lateMins > 0 && active && (
              <Badge tone="red" icon={TriangleAlert}>
                ETA {Math.round(planned.lateMins)} min past window
              </Badge>
            )}
          </div>
          <Link to={`/clients/${a.clientId}`} onClick={onClose} className="block truncate text-lg font-semibold text-slate-900 hover:text-brand-700">
            {clientName(client)}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <CalendarClock className="size-4 text-slate-400" /> {relDay(a.date)} · {fmtWindow(a.windowStart, a.windowEnd)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: team?.color }} /> {team?.name} · {doctor?.name}
            </span>
          </p>
        </div>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {(primary || active) && (
          <div className="flex flex-wrap gap-2">
            {primary}
            {active && (
              <Button icon={CalendarClock} onClick={() => { onClose(); navigate(`/book?reschedule=${a.id}`); }}>
                Reschedule
              </Button>
            )}
            {active && <Button variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        )}

        {planned && active && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Stop</p>
              <p className="tabular font-semibold text-slate-900">
                {a.sequence} of {route?.appointments.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">ETA</p>
              <p className={clsx('tabular font-semibold', planned.lateMins > 0 ? 'text-red-600' : 'text-slate-900')}>{fmtTime(planned.arrival)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Drive in</p>
              <p className="tabular font-semibold text-slate-900">{Math.round(planned.legMins)} min</p>
            </div>
          </div>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Visit</h4>
          <div className="space-y-2">
            {pets.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                  <SpeciesIcon species={p.species} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {p.name} <span className="font-normal text-slate-500">· {p.breed} · {ageFromDob(p.dob)}{p.weightLbs ? ` · ${p.weightLbs} lb` : ''}</span>
                  </p>
                  {p.alerts.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.alerts.map((al) => (
                        <Badge key={al} tone="red" icon={TriangleAlert}>
                          {al}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {services.map((sv) => (
              <li key={sv.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-700">
                  {sv.name}
                  {a.petIds.length > 1 && <span className="text-slate-400"> × {a.petIds.length}</span>}
                </span>
                <span className="tabular text-slate-500">{money(sv.price * a.petIds.length)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-700">House-call trip fee</span>
              <span className="tabular text-slate-500">{money(a.tripFee)}</span>
            </li>
            <li className="flex items-center justify-between bg-slate-50 px-3 py-2 font-medium">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Clock className="size-4 text-slate-400" /> {fmtDuration(a.durationMins)} on site
              </span>
              <span className="tabular text-slate-900">Est. {money(a.estimatedTotal)}</span>
            </li>
          </ul>
          {a.reason && <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-700">Reason:</span> {a.reason}</p>}
          {due.length > 0 && active && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-medium text-sky-900">Also due for these pets</p>
              <ul className="mt-1.5 space-y-1.5">
                {due.map((r) => {
                  const sv = byId(s.services, r.serviceId);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-sky-900">
                        {byId(s.pets, r.petId)?.name}: {sv?.name} <span className="text-sky-700">· due {fmtDate(r.dueDate, 'MMM d')}</span>
                      </span>
                      <Button size="xs" variant="secondary" icon={PlusCircle} onClick={() => addService(r.serviceId)}>
                        Add
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {client && (
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Location & contact</h4>
            <div className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="flex items-start gap-2 text-slate-800">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {fmtAddress(client.address, true)}
              </p>
              {client.accessNotes && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900">
                  <KeyRound className="mt-0.5 size-4 shrink-0" /> {client.accessNotes}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {geo && (
                  <>
                    <LinkButton href={googleNavUrl(geo)} size="sm" icon={Navigation}>
                      Google Maps
                    </LinkButton>
                    <LinkButton href={appleNavUrl(geo)} size="sm" icon={Navigation}>
                      Apple Maps
                    </LinkButton>
                  </>
                )}
                <LinkButton href={phoneHref(client.phone)} size="sm" icon={Phone}>
                  Call
                </LinkButton>
                <Button size="sm" icon={MessageSquareText} onClick={() => compose({ clientId: client.id, appointmentId: a.id, templateKey: 'reminder' })}>
                  Text
                </Button>
                <Button size="sm" icon={Mail} onClick={() => compose({ clientId: client.id, appointmentId: a.id, templateKey: 'follow_up' })}>
                  Email
                </Button>
              </div>
              {stats && stats.balance > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-red-800">
                  <CircleDollarSign className="size-4" /> Open balance {money(stats.balance, true)}
                  {stats.overdue ? ' (overdue)' : ''} — collect at visit
                </p>
              )}
            </div>
          </section>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Crew</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5"><UserRound className="size-4 text-slate-500" /> {doctor?.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5"><Car className="size-4 text-slate-500" /> {driver?.name} · {team?.vehicle}</span>
          </div>
        </section>

        <section>
          <Field label="Internal notes (not shared with client)">
            <Textarea
              value={notes}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== a.internalNotes && patch('appointments', a.id, { internalNotes: notes })}
              placeholder="Add a note for the doctor, driver or office…"
            />
          </Field>
        </section>

        {invoice && <InvoiceSummary invoice={invoice} />}

        {comms.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Activity</h4>
            <ol className="space-y-2 border-l border-slate-200 pl-4">
              {comms.slice(0, 8).map((c) => (
                <li key={c.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-slate-300" />
                  <p className="font-medium text-slate-700">{c.subject}</p>
                  <p className="text-slate-500">{c.body}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {c.by}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {active && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" size="sm" icon={XCircle} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setCancelling('cancelled')}>
              Cancel appointment
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCancelling('no_show')}>
              Mark no-show
            </Button>
          </div>
        )}
      </div>

      <EditVisitModal open={editing} onClose={() => setEditing(false)} appt={a} />
      <CancelModal mode={cancelling} onClose={() => setCancelling(null)} appt={a} onDone={onClose} />
      <CompleteModal open={completing} onClose={() => setCompleting(false)} appt={a} />
    </>
  );
}

function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  const bal = invoice.total - invoice.amountPaid;
  return (
    <section className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
      <span className="flex items-center gap-2 text-slate-700">
        <Receipt className="size-4 text-slate-400" /> {invoice.number} · {money(invoice.total, true)}
      </span>
      {bal > 0 ? <Badge tone={invoice.status === 'overdue' ? 'red' : 'amber'}>{money(bal, true)} due</Badge> : <Badge tone="green">Paid</Badge>}
    </section>
  );
}

function EditVisitModal({ open, onClose, appt }: { open: boolean; onClose: () => void; appt: Appointment }) {
  const s = useData();
  const [petIds, setPetIds] = useState(appt.petIds);
  const [serviceIds, setServiceIds] = useState(appt.serviceIds);
  const [reason, setReason] = useState(appt.reason);
  const [ws, setWs] = useState(appt.windowStart);
  const [we, setWe] = useState(appt.windowEnd);
  const [pinned, setPinned] = useState(appt.pinned);
  const pets = petsOf(s, appt.clientId);
  const srv = useMemo(() => serviceIds.map((x) => byId(s.services, x)!).filter(Boolean), [serviceIds, s.services]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = () => {
    patch('appointments', appt.id, {
      petIds,
      serviceIds,
      reason,
      windowStart: ws,
      windowEnd: toMin(we) > toMin(ws) ? we : toTime(toMin(ws) + 60),
      pinned,
      durationMins: visitDuration(srv, petIds.length),
      estimatedTotal: servicesSubtotal(srv, petIds.length) + appt.tripFee,
    });
    toast('Visit updated');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit visit"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!petIds.length || !serviceIds.length}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Pets</p>
          <div className="flex flex-wrap gap-1.5">
            {pets.map((p) => (
              <Chip key={p.id} selected={petIds.includes(p.id)} onClick={() => setPetIds(toggle(petIds, p.id))}>
                <SpeciesIcon species={p.species} /> {p.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Services</p>
          <div className="flex flex-wrap gap-1.5">
            {s.services.filter((x) => x.active).map((sv) => (
              <Chip key={sv.id} selected={serviceIds.includes(sv.id)} onClick={() => setServiceIds(toggle(serviceIds, sv.id))} className="!py-1 !text-xs">
                {sv.name}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {fmtDuration(visitDuration(srv, petIds.length))} on site · est. {money(servicesSubtotal(srv, petIds.length) + appt.tripFee)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrival window from">
            <Input type="time" step={900} value={ws} onChange={(e) => setWs(e.target.value)} />
          </Field>
          <Field label="to">
            <Input type="time" step={900} value={we} onChange={(e) => setWe(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-700" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <span>
            <span className="font-medium">Pin this time.</span> Route optimization will never move this visit’s window (use for time-sensitive or end-of-life visits).
          </span>
        </label>
        <Field label="Reason for visit (client-facing)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function CancelModal({ mode, onClose, appt, onDone }: { mode: 'cancelled' | 'no_show' | null; onClose: () => void; appt: Appointment; onDone: () => void }) {
  const s = useData();
  const navigate = useNavigate();
  const [reason, setReason] = useState('Client schedule conflict');
  const [done, setDone] = useState(false);
  const client = byId(s.clients, appt.clientId);
  const matches = useMemo(() => {
    if (!client || !hasGeo(client.address)) return [];
    const origin = client.address;
    return s.waitlist
      .filter((w) => w.status === 'waiting')
      .map((w) => {
        const c = byId(s.clients, w.clientId);
        return { w, c, miles: c && hasGeo(c.address) ? milesBetween(origin, c.address) : 99 };
      })
      .sort((x, y) => x.miles - y.miles)
      .slice(0, 3);
  }, [client, s.waitlist, s.clients]);

  const close = () => {
    setDone(false);
    onClose();
    if (done) onDone();
  };

  return (
    <Modal open={!!mode} onClose={close} title={done ? 'Fill the gap?' : mode === 'no_show' ? 'Mark as no-show' : 'Cancel appointment'}>
      {!done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {clientName(client)} · {fmtDate(appt.date)} · {fmtWindow(appt.windowStart, appt.windowEnd)}
          </p>
          {mode === 'cancelled' && (
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {['Client schedule conflict', 'Pet feeling better', 'Weather', 'Rescheduled by client', 'Practice cancelled', 'Other'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Keep appointment</Button>
            <Button
              variant="danger"
              onClick={() => {
                cancelAppointment(appt.id, mode === 'cancelled' ? reason : '', mode ?? 'cancelled');
                toast(mode === 'no_show' ? 'Marked as no-show' : 'Appointment cancelled — route updated', 'info');
                setDone(true);
              }}
            >
              {mode === 'no_show' ? 'Mark no-show' : 'Cancel appointment'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">The route has been re-sequenced. These waitlisted clients live closest to the freed-up stop:</p>
          {matches.length === 0 && <p className="text-sm text-slate-500">No one is on the waitlist right now.</p>}
          <ul className="space-y-2">
            {matches.map(({ w, c, miles }) => (
              <li key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{clientName(c)}</span>
                  <span className="block text-xs text-slate-500">
                    {miles.toFixed(1)} mi away · {w.urgency} · {w.serviceIds.map((x) => byId(s.services, x)?.name).join(', ')}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    close();
                    navigate(`/book?waitlist=${w.id}&date=${appt.date}&team=${appt.teamId}`);
                  }}
                >
                  Offer slot
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CompleteModal({ open, onClose, appt }: { open: boolean; onClose: () => void; appt: Appointment }) {
  const [method, setMethod] = useState<Invoice['method']>('card');
  const finish = (paidNow: boolean) => {
    const inv = completeAppointment(appt.id, { paidNow, method });
    toast(inv ? `Visit completed · ${inv.number} ${paidNow ? 'paid' : 'sent'}` : 'Visit completed');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Complete visit" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">An invoice for {money(appt.estimatedTotal)} will be created, and recall reminders for the services performed will roll forward automatically.</p>
        <Field label="Collected at the visit by">
          <Select value={method} onChange={(e) => setMethod(e.target.value as Invoice['method'])}>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="transfer">Bank transfer</option>
          </Select>
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => finish(false)}>Send invoice instead</Button>
          <Button variant="primary" icon={CheckCircle2} onClick={() => finish(true)}>
            Paid now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
