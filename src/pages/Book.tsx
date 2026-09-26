import clsx from 'clsx';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  Car,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  MapPin,
  MessageSquareText,
  PawPrint,
  Search,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClientFormModal } from '../components/ClientForms';
import { RouteMap, type MapRoute } from '../components/RouteMap';
import { Badge, Button, Card, CardHeader, Chip, EmptyState, Field, Input, LinkButton, PageHeader, Segmented, Select, SpeciesIcon, Textarea } from '../components/ui';
import { bookAppointment } from '../data/actions';
import { dayAppointments, dayConfig, pointOf, toStops, useRoadData } from '../data/planning';
import { byId, clientName, petsOf, remindersFor, searchClients } from '../data/selectors';
import { patch, useData } from '../data/store';
import type { Appointment, DayPart, GeoPoint, ServiceCategory } from '../data/types';
import { compose, toast } from '../data/ui';
import { fmtAddress, hasGeo } from '../lib/geo';
import { money, miles as fmtMiles } from '../lib/format';
import { milesFromBase, servicesSubtotal, tripFeeFor, visitDuration } from '../lib/pricing';
import { findSlots, rankSlots, windowAround, type CandidateDay, type RankedSlot } from '../lib/routing';
import { daysBetween, fmtDate, fmtDuration, fmtTime, fmtWindow, nowMinutes, relDay, roundTo, shiftDate, toMin, toTime, todayStr } from '../lib/time';
import { CATEGORY_META } from '../components/ui';

type Urgency = 'routine' | 'soon' | 'urgent';

export function Book() {
  const s = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = todayStr();

  const rescheduleId = params.get('reschedule') ?? undefined;
  const waitlistId = params.get('waitlist') ?? undefined;
  const reminderId = params.get('reminder') ?? undefined;
  const rescheduling = rescheduleId ? byId(s.appointments, rescheduleId) : undefined;
  const waitlisted = waitlistId ? byId(s.waitlist, waitlistId) : undefined;
  const reminder = reminderId ? byId(s.reminders, reminderId) : undefined;

  const [clientId, setClientId] = useState<string | undefined>(params.get('clientId') ?? rescheduling?.clientId ?? waitlisted?.clientId ?? reminder?.clientId);
  const [petIds, setPetIds] = useState<string[]>(rescheduling?.petIds ?? waitlisted?.petIds ?? (reminder ? [reminder.petId] : []));
  const [serviceIds, setServiceIds] = useState<string[]>(rescheduling?.serviceIds ?? waitlisted?.serviceIds ?? (reminder ? [reminder.serviceId] : []));
  const [reason, setReason] = useState(rescheduling?.reason ?? waitlisted?.notes ?? '');
  const [urgency, setUrgency] = useState<Urgency>(waitlisted?.urgency ?? 'routine');
  const [dayPart, setDayPart] = useState<DayPart>(waitlisted?.preferredTime ?? 'any');
  const [teamPref, setTeamPref] = useState<string>(params.get('team') ?? 'any');
  const [from, setFrom] = useState(params.get('date') && params.get('date')! >= today ? params.get('date')! : today);
  const [horizon, setHorizon] = useState(14);
  const [query, setQuery] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [selected, setSelected] = useState(0);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [manual, setManual] = useState(false);

  const client = byId(s.clients, clientId);
  const pets = client ? petsOf(s, client.id) : [];
  const point: GeoPoint | undefined = client && hasGeo(client.address) ? { lat: client.address.lat, lng: client.address.lng } : undefined;

  // Default to the client's preferences when a client is chosen.
  useEffect(() => {
    if (!client) return;
    if (!petIds.length && pets.length === 1) setPetIds([pets[0].id]);
    if (!rescheduling && !waitlisted) {
      if (client.preferredTime !== 'any') setDayPart(client.preferredTime);
      if (client.preferredTeamId && !params.get('team')) setTeamPref(client.preferredTeamId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const services = serviceIds.map((id) => byId(s.services, id)!).filter(Boolean);
  const duration = visitDuration(services, petIds.length);
  const teams = s.teams.filter((t) => t.active && (teamPref === 'any' || t.id === teamPref));

  // Candidate days across the search window.
  const days: CandidateDay[] = useMemo(() => {
    const out: CandidateDay[] = [];
    for (let d = 0; d < horizon; d++) {
      const date = shiftDate(from, d);
      if (date < today) continue;
      for (const team of teams) {
        const cfg = dayConfig(s, team, date);
        if (!cfg) continue;
        out.push({ teamId: team.id, date, cfg, stops: toStops(s, dayAppointments(s, team.id, date, rescheduleId)) });
      }
    }
    return out;
  }, [s.appointments, s.teams, s.settings, s.clients, from, horizon, teamPref, rescheduleId, today]);

  const matrixPoints = useMemo(() => {
    if (!point) return [];
    const pts: GeoPoint[] = [point];
    days.forEach((d) => {
      pts.push(d.cfg.base);
      d.stops.forEach((x) => pts.push(x.point));
    });
    return pts;
  }, [days, point?.lat, point?.lng]);
  const roadVersion = useRoadData(matrixPoints);

  const ready = !!client && !!point && petIds.length > 0 && serviceIds.length > 0;

  const slots: RankedSlot[] = useMemo(() => {
    if (!ready || !point) return [];
    const nowFloor = roundTo(nowMinutes() + 45, 15, 'ceil');
    const raw = findSlots(
      { point, durationMins: duration, windowMins: s.settings.windowMins, dayPart, notBefore: { [today]: nowFloor } },
      days,
    );
    return rankSlots(raw, today, urgency, (d) => daysBetween(today, d)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, point?.lat, point?.lng, duration, dayPart, urgency, days, roadVersion, s.settings.windowMins]);

  useEffect(() => setSelected(0), [slots.length, clientId, serviceIds.join(), petIds.join()]);

  const slot = slots[selected];
  const slotTeam = slot ? byId(s.teams, slot.teamId) : teams[0] ?? s.teams[0];
  const trip = tripFeeFor(s.settings, milesFromBase(slotTeam, point));
  const subtotal = servicesSubtotal(services, petIds.length);

  const mapRoutes: MapRoute[] = useMemo(() => {
    if (!slot || !point) return [];
    const team = byId(s.teams, slot.teamId)!;
    const existing = dayAppointments(s, slot.teamId, slot.date, rescheduleId);
    const stops = existing.flatMap((a) => {
      const p = pointOf(s, a);
      return p ? [{ id: a.id, point: p, title: clientName(byId(s.clients, a.clientId)), subtitle: fmtWindow(a.windowStart, a.windowEnd) }] : [];
    });
    stops.splice(slot.position, 0, { id: '__new__', point, title: clientName(client), subtitle: 'New visit' });
    return [
      {
        id: `${team.id}-${slot.date}`,
        color: team.color,
        base: team.base,
        baseLabel: `${team.name} base`,
        stops: stops.map((x, i) => ({ ...x, label: x.id === '__new__' ? '★' : String(i + 1) })),
      },
    ];
  }, [slot, point, s.appointments, s.clients, s.teams, rescheduleId, client]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const doBook = (opt: { teamId: string; date: string; windowStart: number; windowEnd: number; position: number }) => {
    if (!client) return;
    const team = byId(s.teams, opt.teamId);
    const fee = tripFeeFor(s.settings, milesFromBase(team, point)).fee;
    const appt = bookAppointment(
      {
        clientId: client.id,
        petIds,
        serviceIds,
        teamId: opt.teamId,
        date: opt.date,
        windowStart: toTime(opt.windowStart),
        windowEnd: toTime(opt.windowEnd),
        position: opt.position,
        durationMins: duration,
        tripFee: fee,
        estimatedTotal: subtotal + fee,
        reason,
        source: waitlisted ? 'waitlist' : reminder ? 'recall' : 'phone',
      },
      rescheduleId,
    );
    if (waitlisted) patch('waitlist', waitlisted.id, { status: 'booked' });
    if (client.status === 'lead') patch('clients', client.id, { status: 'active', tags: client.tags.filter((t) => t !== 'New lead') });
    setBooked(appt);
    toast(rescheduling ? 'Appointment moved' : 'Appointment booked');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const categories = useMemo(() => {
    const m = new Map<ServiceCategory, typeof s.services>();
    s.services.filter((x) => x.active).forEach((x) => m.set(x.category, [...(m.get(x.category) ?? []), x]));
    return [...m.entries()];
  }, [s.services]);

  const due = client ? remindersFor(s, pets.map((p) => p.id)) : [];

  if (booked) {
    const team = byId(s.teams, booked.teamId);
    return (
      <div className="mx-auto max-w-xl pt-6">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">{rescheduling ? 'Appointment moved' : 'Appointment booked'}</h1>
          <p className="mt-1 text-slate-600">
            {clientName(client)} · {fmtDate(booked.date, 'EEEE, MMM d')} · arriving {fmtWindow(booked.windowStart, booked.windowEnd)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {team?.name} · stop {booked.sequence} · {fmtDuration(booked.durationMins)} on site · est. {money(booked.estimatedTotal)}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="primary" icon={MessageSquareText} onClick={() => compose({ clientId: booked.clientId, appointmentId: booked.id, templateKey: 'confirm' })}>
              Send confirmation
            </Button>
            <LinkButton to={`/routes?date=${booked.date}&team=${booked.teamId}`} icon={Car}>
              View route
            </LinkButton>
            <Button
              variant="ghost"
              onClick={() => {
                setBooked(null);
                setClientId(undefined);
                setPetIds([]);
                setServiceIds([]);
                setReason('');
                navigate('/book', { replace: true });
              }}
            >
              Book another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={rescheduling ? 'Reschedule appointment' : 'Book an appointment'}
        subtitle={
          rescheduling
            ? `Currently ${fmtDate(rescheduling.date)} · ${fmtWindow(rescheduling.windowStart, rescheduling.windowEnd)} — pick a better slot below.`
            : 'VetSet ranks every open slot by how little extra driving it adds to routes that are already booked.'
        }
      />
      {waitlisted && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <Sparkles className="size-4" /> Booking from the waitlist. The entry will be marked as booked.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* LEFT: request */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="1 · Client" icon={UserPlus} actions={client && !rescheduling ? <Button size="xs" variant="ghost" onClick={() => { setClientId(undefined); setPetIds([]); }}>Change</Button> : undefined} />
            <div className="p-4">
              {client ? (
                <div className="space-y-2 text-sm">
                  <p className="text-base font-semibold text-slate-900">{clientName(client)}</p>
                  <p className="flex items-start gap-2 text-slate-600">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {fmtAddress(client.address, true)}
                  </p>
                  {!point && (
                    <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900">
                      <TriangleAlert className="size-4" /> This address isn’t located yet — edit the client and pick a suggested address to enable routing.
                    </p>
                  )}
                  {client.accessNotes && (
                    <p className="flex items-start gap-2 text-slate-600">
                      <KeyRound className="mt-0.5 size-4 shrink-0 text-slate-400" /> {client.accessNotes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, pet or phone" className="pl-9" autoFocus />
                  </div>
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 empty:hidden">
                    {searchClients(s, query, 6).map(({ c, pet }) => (
                      <li key={c.id}>
                        <button onClick={() => { setClientId(c.id); setQuery(''); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                          <span>
                            <span className="block font-medium text-slate-800">{clientName(c)}</span>
                            <span className="block text-xs text-slate-500">{c.address.city} · {c.phone}</span>
                          </span>
                          {pet && <span className="text-xs text-slate-500">{pet.name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button icon={UserPlus} className="w-full" onClick={() => setAddingClient(true)}>
                    New client
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card className={clsx(!client && 'pointer-events-none opacity-50')}>
            <CardHeader title="2 · Visit" icon={PawPrint} />
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">Which pets?</p>
                <div className="flex flex-wrap gap-1.5">
                  {pets.map((p) => (
                    <Chip key={p.id} selected={petIds.includes(p.id)} onClick={() => setPetIds(toggle(petIds, p.id))}>
                      <SpeciesIcon species={p.species} /> {p.name}
                    </Chip>
                  ))}
                  {client && !pets.length && <p className="text-sm text-slate-500">No pets on file — add one from the client profile.</p>}
                </div>
              </div>
              {due.length > 0 && (
                <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <span className="font-semibold">Due soon:</span>{' '}
                  {due.slice(0, 4).map((r, i) => (
                    <button
                      key={r.id}
                      className="underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700"
                      onClick={() => {
                        setPetIds((x) => (x.includes(r.petId) ? x : [...x, r.petId]));
                        setServiceIds((x) => (x.includes(r.serviceId) ? x : [...x, r.serviceId]));
                      }}
                    >
                      {i > 0 && ', '}
                      {byId(s.pets, r.petId)?.name} — {byId(s.services, r.serviceId)?.name} ({fmtDate(r.dueDate, 'MMM d')})
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-600">Services</p>
                {categories.map(([cat, list]) => (
                  <div key={cat}>
                    <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{CATEGORY_META[cat].label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((sv) => (
                        <Chip key={sv.id} selected={serviceIds.includes(sv.id)} onClick={() => setServiceIds(toggle(serviceIds, sv.id))} className="!py-1 !text-xs">
                          {serviceIds.includes(sv.id) && <Check className="size-3" />}
                          {sv.name}
                          <span className="text-slate-400">{money(sv.price)}</span>
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Field label="Reason / notes for the doctor">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Limping on back left leg since Tuesday" />
              </Field>
              {serviceIds.length > 0 && petIds.length > 0 && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 uppercase">On site</p>
                    <p className="font-semibold text-slate-900">{fmtDuration(duration)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 uppercase">Trip fee</p>
                    <p className="font-semibold text-slate-900" title={trip.label}>
                      {money(trip.fee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 uppercase">Estimate</p>
                    <p className="font-semibold text-slate-900">{money(subtotal + trip.fee)}</p>
                  </div>
                  <p className={clsx('col-span-3 text-xs', trip.outOfArea ? 'text-amber-700' : 'text-slate-500')}>
                    {trip.label}
                    {trip.miles !== undefined && ` · ${fmtMiles(trip.miles)} from ${slotTeam?.name ?? 'base'}`}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className={clsx(!client && 'pointer-events-none opacity-50')}>
            <CardHeader title="3 · Preferences" icon={CalendarClock} />
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="How soon?">
                <Segmented value={urgency} onChange={setUrgency} size="sm" className="w-full" options={[{ value: 'routine', label: 'Routine' }, { value: 'soon', label: 'This week' }, { value: 'urgent', label: 'ASAP' }]} />
              </Field>
              <Field label="Time of day">
                <Segmented value={dayPart} onChange={setDayPart} size="sm" className="w-full" options={[{ value: 'any', label: 'Any' }, { value: 'am', label: 'Morning' }, { value: 'pm', label: 'Afternoon' }]} />
              </Field>
              <Field label="Unit / doctor">
                <Select value={teamPref} onChange={(e) => setTeamPref(e.target.value)}>
                  <option value="any">Any unit (best route)</option>
                  {s.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {byId(s.staff, t.doctorId)?.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Starting">
                  <Input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value || today)} />
                </Field>
                <Field label="Look ahead">
                  <Select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                    <option value={7}>1 week</option>
                    <option value={14}>2 weeks</option>
                    <option value={21}>3 weeks</option>
                  </Select>
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: results */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader
              icon={Wand2}
              title="Best available times"
              subtitle={ready ? `${slots.length} options · ranked by added drive time${urgency !== 'routine' ? ', weighted toward sooner dates' : ''}` : 'Choose a client, pets and services to see ranked slots'}
              actions={ready ? <Button size="xs" variant="ghost" onClick={() => setManual(!manual)}>{manual ? 'Suggested slots' : 'Pick manually'}</Button> : undefined}
            />
            {!ready ? (
              <EmptyState icon={Sparkles} title="Smart slot finder" body="Pick a client, the pets being seen and the services. VetSet checks every unit’s route for the next two weeks and shows the times that fit best." />
            ) : manual ? (
              <ManualPicker onBook={doBook} teams={s.teams} duration={duration} point={point!} rescheduleId={rescheduleId} />
            ) : slots.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No slots fit" body="Try a longer look-ahead, any time of day, or any unit." />
            ) : (
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <ul className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
                  {slots.map((o, i) => (
                    <SlotRow key={`${o.teamId}-${o.date}-${o.position}-${o.eta}`} slot={o} active={i === selected} onSelect={() => setSelected(i)} onBook={() => doBook(o)} />
                  ))}
                </ul>
                <div className="border-t border-slate-100 p-3 xl:border-t-0 xl:border-l">
                  {slot && point && (
                    <>
                      <RouteMap routes={mapRoutes} highlight={{ point, title: clientName(client) }} className="h-72 xl:h-[26rem]" />
                      <SlotExplainer slot={slot} />
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ClientFormModal
        open={addingClient}
        onClose={() => setAddingClient(false)}
        onSaved={(c, pet) => {
          setClientId(c.id);
          if (pet) setPetIds([pet.id]);
        }}
      />
    </div>
  );
}

function SlotRow({ slot, active, onSelect, onBook }: { slot: RankedSlot; active: boolean; onSelect: () => void; onBook: () => void }) {
  const s = useData();
  const team = byId(s.teams, slot.teamId);
  const doctor = byId(s.staff, team?.doctorId);
  const today = todayStr();
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        className={clsx('flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors', active ? 'bg-brand-50/70' : 'hover:bg-slate-50')}
      >
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: team?.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="font-semibold text-slate-900">{relDay(slot.date, today)}</p>
            <p className="text-sm text-slate-500">{fmtDate(slot.date, 'MMM d')}</p>
          </div>
          <p className="tabular text-sm font-medium text-slate-800">{fmtWindow(toTime(slot.windowStart), toTime(slot.windowEnd))}</p>
          <p className="text-xs text-slate-500">
            {team?.name} · {doctor?.name}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {slot.badges.map((b) => (
              <Badge key={b} tone={b === 'Recommended' ? 'brand' : b === 'Runs late' ? 'amber' : b === 'Least driving' ? 'green' : 'gray'}>
                {b}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={clsx('tabular text-sm font-semibold', slot.addedDriveMins < 10 ? 'text-emerald-700' : slot.addedDriveMins < 25 ? 'text-slate-700' : 'text-amber-700')}>
            +{Math.round(slot.addedDriveMins)} min
          </span>
          <Button
            size="xs"
            variant={active ? 'primary' : 'secondary'}
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
          >
            Book
          </Button>
        </div>
      </div>
    </li>
  );
}

function SlotExplainer({ slot }: { slot: RankedSlot }) {
  const s = useData();
  const who = (id?: string) => {
    const a = id ? byId(s.appointments, id) : undefined;
    return a ? `${byId(s.clients, a.clientId)?.lastName} (${fmtTime(a.windowStart, true)})` : undefined;
  };
  const prev = who(slot.prevStopId);
  const next = who(slot.nextStopId);
  const nearest = slot.nearestStopId ? byId(s.appointments, slot.nearestStopId) : undefined;
  const Row = ({ icon: I, children }: { icon: typeof Clock; children: ReactNode }) => (
    <li className="flex items-start gap-2">
      <I className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <span>{children}</span>
    </li>
  );
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
      <Row icon={Clock}>
        Arrives about <b className="font-medium text-slate-900">{fmtTime(slot.eta)}</b> · client is promised {fmtWindow(toTime(slot.windowStart), toTime(slot.windowEnd))}
      </Row>
      <Row icon={Car}>
        Adds <b className="font-medium text-slate-900">{Math.round(slot.addedDriveMins)} min</b> and {fmtMiles(Math.max(0, slot.addedMiles))} of driving to the day
      </Row>
      <Row icon={ArrowRight}>
        {slot.stopsThatDay === 0 ? 'Only stop — opens a new route this day' : prev && next ? `Between ${prev} and ${next}` : prev ? `Last stop, after ${prev}` : `First stop, before ${next}`}
      </Row>
      {nearest && slot.nearestStopMiles !== undefined && (
        <Row icon={MapPin}>
          {slot.nearestStopMiles.toFixed(1)} mi from {byId(s.clients, nearest.clientId)?.lastName}, already on this route
        </Row>
      )}
      <Row icon={CalendarCheck2}>
        Unit back at base around {fmtTime(slot.dayPlan.returnBase)} {slot.overtimeMins > 0 && <Badge tone="amber">{Math.round(slot.overtimeMins)} min overtime</Badge>}
      </Row>
    </ul>
  );
}

function ManualPicker({ onBook, teams, duration, point, rescheduleId }: { onBook: (o: { teamId: string; date: string; windowStart: number; windowEnd: number; position: number }) => void; teams: ReturnType<typeof useData.getState>['teams']; duration: number; point: GeoPoint; rescheduleId?: string }) {
  const s = useData();
  const [date, setDate] = useState(todayStr());
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [start, setStart] = useState('10:00');
  const team = byId(s.teams, teamId);
  const cfg = team ? dayConfig(s, team, date) : null;
  const existing = dayAppointments(s, teamId, date, rescheduleId);
  const position = existing.filter((a) => toMin(a.windowStart) <= toMin(start)).length;
  const w = windowAround(toMin(start) + 30, s.settings.windowMins);
  const check = useMemo(() => {
    if (!cfg) return null;
    const slots = findSlots({ point, durationMins: duration, windowMins: s.settings.windowMins, dayPart: 'any' }, [{ teamId, date, cfg, stops: toStops(s, existing) }]);
    return slots.length ? Math.min(...slots.map((x) => x.addedDriveMins)) : null;
  }, [cfg, teamId, date, existing.length, duration]);
  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date">
          <Input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Unit">
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {s.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Window starts">
          <Input type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </div>
      {!cfg ? (
        <p className="text-sm text-amber-700">{team?.name} doesn’t work that day.</p>
      ) : (
        <p className="text-sm text-slate-600">
          {existing.length} visits already booked. Stop #{position + 1}, window {fmtWindow(start, toTime(toMin(start) + s.settings.windowMins))}.
          {check !== null && ` The best spot on this day would add ~${Math.round(check)} min of driving.`}
        </p>
      )}
      <Button variant="primary" disabled={!cfg} onClick={() => onBook({ teamId, date, windowStart: toMin(start), windowEnd: toMin(start) + s.settings.windowMins, position })}>
        Book {fmtDate(date, 'MMM d')} at {fmtTime(start)}
      </Button>
      <p className="text-xs text-slate-400">Manual bookings skip route checks — use the Routes page afterwards to re-optimize the day. (Suggested window: {fmtWindow(toTime(w.start), toTime(w.end))})</p>
    </div>
  );
}
