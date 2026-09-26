import clsx from 'clsx';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { CalendarPlus, Car, ChevronLeft, ChevronRight, Pin, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageHeader, Segmented, Select, StatusBadge, STATUS_META, CATEGORY_META } from '../components/ui';
import { buildDayRoute, useDayRoutes, type DayRoute } from '../data/planning';
import { byId, clientName, petNames, serviceNames } from '../data/selectors';
import { useData } from '../data/store';
import type { Appointment, AppointmentStatus } from '../data/types';
import { useUi } from '../data/ui';
import { money } from '../lib/format';
import { fmtDate, fmtDuration, fmtTime, fmtWindow, nowMinutes, relDay, shiftDate, todayStr } from '../lib/time';

type View = 'day' | 'week' | 'list';

export function Schedule() {
  const s = useData();
  const role = useUi((u) => u.role);
  const acting = useUi((u) => u.actingTeamId);
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const date = params.get('date') ?? today;
  const view = (params.get('view') as View) ?? 'day';
  const unit = params.get('unit') ?? (role === 'office' ? 'all' : acting);

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };
  const step = view === 'week' ? 7 : 1;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Schedule"
        subtitle={view === 'week' ? `Week of ${format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), 'MMM d')}` : `${relDay(date, today)} · ${fmtDate(date, 'EEEE, MMMM d')}`}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs">
              <button className="p-2 text-slate-500 hover:text-slate-900" onClick={() => set('date', shiftDate(date, -step))} aria-label="Previous">
                <ChevronLeft className="size-4" />
              </button>
              <Input type="date" value={date} onChange={(e) => e.target.value && set('date', e.target.value)} className="h-8 w-36 border-0 px-1 shadow-none focus:ring-0" />
              <button className="p-2 text-slate-500 hover:text-slate-900" onClick={() => set('date', shiftDate(date, step))} aria-label="Next">
                <ChevronRight className="size-4" />
              </button>
            </div>
            {date !== today && (
              <Button size="sm" variant="ghost" onClick={() => set('date', today)}>
                Today
              </Button>
            )}
            <Segmented value={view} onChange={(v) => set('view', v)} size="sm" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
            <Select value={unit} onChange={(e) => set('unit', e.target.value)} className="!h-8 !w-auto text-xs">
              <option value="all">All units</option>
              {s.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {role !== 'driver' && (
              <LinkButton to="/book" variant="primary" size="sm" icon={CalendarPlus}>
                Book
              </LinkButton>
            )}
          </>
        }
      />
      {view === 'day' && <DayView date={date} unit={unit} />}
      {view === 'week' && <WeekView date={date} unit={unit} onPickDay={(d) => { const p = new URLSearchParams(params); p.set('date', d); p.set('view', 'day'); setParams(p); }} />}
      {view === 'list' && <ListView date={date} unit={unit} />}
    </div>
  );
}

const PX = 1.25; // pixels per minute

function DayView({ date, unit }: { date: string; unit: string }) {
  const s = useData();
  const routes = useDayRoutes(date);
  const visible = routes.filter((r) => unit === 'all' || r.team.id === unit);
  const openAppt = useUi((u) => u.openAppointment);
  const today = todayStr();

  const starts = visible.map((r) => r.cfg?.dayStart ?? 480);
  const ends = visible.map((r) => Math.max(r.cfg?.dayEnd ?? 1020, r.plan?.returnBase ?? 0));
  const from = Math.floor((Math.min(...starts, 480) - 30) / 60) * 60;
  const to = Math.ceil((Math.max(...ends, 1020) + 30) / 60) * 60;
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  const nowM = nowMinutes();

  if (!visible.some((r) => r.appointments.length) && !visible.some((r) => r.cfg))
    return (
      <Card>
        <EmptyState title="No units working" body="Nobody is scheduled in the field on this day." />
      </Card>
    );

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `3.5rem repeat(${visible.length}, minmax(15rem, 1fr))` }}>
            <div />
            {visible.map((r) => (
              <DayColumnHeader key={r.team.id} route={r} />
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${visible.length}, minmax(15rem, 1fr))`, height: (to - from) * PX }}>
            <div className="relative">
              {hours.map((h) => (
                <span key={h} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: (h - from) * PX }}>
                  {fmtTime(h, true)}
                </span>
              ))}
            </div>
            {visible.map((r) => (
              <div key={r.team.id} className="relative border-l border-slate-100">
                {hours.map((h) => (
                  <span key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - from) * PX }} />
                ))}
                {r.cfg && (
                  <>
                    <span className="absolute inset-x-0 top-0 bg-slate-50" style={{ height: (r.cfg.dayStart - from) * PX }} />
                    <span className="absolute inset-x-0 bottom-0 bg-slate-50" style={{ top: (r.cfg.dayEnd - from) * PX }} />
                  </>
                )}
                {r.plan?.stops.map((p) => {
                  const a = r.appointments.find((x) => x.id === p.id)!;
                  const cat = byId(s.services, a.serviceIds[0])?.category ?? 'other';
                  const top = (p.start - from) * PX;
                  const h = Math.max(30, a.durationMins * PX);
                  return (
                    <div key={p.id}>
                      {p.legMins > 1 && (
                        <div
                          className="absolute left-3 flex items-center gap-1 text-[10px] text-slate-400"
                          style={{ top: (p.arrival - p.legMins - from) * PX, height: p.legMins * PX }}
                        >
                          <span className="h-full w-0.5 rounded bg-slate-300" />
                          {p.legMins * PX > 14 && (
                            <span className="flex items-center gap-0.5">
                              <Car className="size-3" />
                              {Math.round(p.legMins)}m
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => openAppt(a.id)}
                        className={clsx(
                          'absolute right-2 left-10 overflow-hidden rounded-lg border border-l-4 px-2 py-1 text-left text-xs shadow-xs transition hover:shadow-md',
                          CATEGORY_META[cat].soft,
                          a.status === 'completed' && 'opacity-60',
                          p.lateMins > 0 && 'ring-2 ring-red-400',
                        )}
                        style={{ top, height: h, borderLeftColor: r.team.color }}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold">{clientName(byId(s.clients, a.clientId))}</span>
                          <span className={clsx('size-2 shrink-0 rounded-full', STATUS_META[a.status].dot)} title={STATUS_META[a.status].label} />
                        </span>
                        {h > 40 && (
                          <span className="block truncate opacity-80">
                            {fmtTime(p.start)} · {petNames(s, a.petIds)}
                          </span>
                        )}
                        {h > 60 && <span className="block truncate opacity-70">{serviceNames(s, a.serviceIds)}</span>}
                      </button>
                    </div>
                  );
                })}
                {date === today && nowM > from && nowM < to && (
                  <span className="absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: (nowM - from) * PX }}>
                    <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DayColumnHeader({ route }: { route: DayRoute }) {
  const s = useData();
  const doctor = byId(s.staff, route.team.doctorId);
  const late = route.plan?.lateCount ?? 0;
  return (
    <div className="border-l border-slate-100 px-3 py-2.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="size-2.5 rounded-full" style={{ background: route.team.color }} /> {route.team.name}
        <span className="truncate text-xs font-normal text-slate-500">{doctor?.name}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        {route.cfg ? (
          <>
            <span>{route.appointments.length} stops</span>
            <span>· {fmtDuration(route.plan?.driveMins ?? 0)} driving</span>
            <span>· {money(route.appointments.reduce((t, a) => t + a.estimatedTotal, 0))}</span>
            {late > 0 && (
              <Badge tone="red" icon={TriangleAlert}>
                {late} late
              </Badge>
            )}
          </>
        ) : (
          'Off'
        )}
      </p>
    </div>
  );
}

function WeekView({ date, unit, onPickDay }: { date: string; unit: string; onPickDay: (d: string) => void }) {
  const s = useData();
  const openAppt = useUi((u) => u.openAppointment);
  const today = todayStr();
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  const teams = s.teams.filter((t) => unit === 'all' || t.id === unit);
  const routesByDay = useMemo(() => days.map((d) => teams.map((t) => buildDayRoute(s, t, d))), [s, days.join(), unit]);

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d, di) => (
        <Card key={d} className={clsx('flex min-h-40 flex-col', d === today && 'ring-2 ring-brand-600/40')}>
          <button onClick={() => onPickDay(d)} className="border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
            <p className={clsx('text-xs font-semibold uppercase', d === today ? 'text-brand-700' : 'text-slate-500')}>{fmtDate(d, 'EEE')}</p>
            <p className="text-lg font-semibold text-slate-900">{fmtDate(d, 'd')}</p>
          </button>
          <div className="flex-1 space-y-2 p-2">
            {routesByDay[di].map((r) =>
              !r.cfg && !r.appointments.length ? null : (
                <div key={r.team.id}>
                  <p className="mb-1 flex items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ background: r.team.color }} />
                      {r.team.name.replace(' Unit', '')}
                    </span>
                    <span className="tabular">{r.appointments.length ? `${Math.round(r.plan?.driveMins ?? 0)}m drive` : 'open'}</span>
                  </p>
                  <ul className="space-y-1">
                    {r.appointments.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => openAppt(a.id)}
                          className={clsx('w-full truncate rounded-md border-l-[3px] bg-slate-50 px-1.5 py-1 text-left text-[11px] hover:bg-slate-100', a.status === 'completed' && 'opacity-60')}
                          style={{ borderLeftColor: r.team.color }}
                        >
                          <span className="tabular font-medium text-slate-700">{fmtTime(a.windowStart, true)}</span> <span className="text-slate-600">{byId(s.clients, a.clientId)?.lastName}</span>
                          {a.pinned && <Pin className="ml-0.5 inline size-2.5 text-amber-600" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

const LIST_FILTERS: { value: 'upcoming' | AppointmentStatus | 'all'; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'scheduled', label: 'Unconfirmed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

function ListView({ date, unit }: { date: string; unit: string }) {
  const s = useData();
  const openAppt = useUi((u) => u.openAppointment);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof LIST_FILTERS)[number]['value']>('upcoming');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.appointments
      .filter((a) => unit === 'all' || a.teamId === unit)
      .filter((a) => (filter === 'upcoming' ? a.date >= date && !['cancelled', 'no_show', 'completed'].includes(a.status) : filter === 'all' ? true : a.status === filter))
      .filter((a) => !t || clientName(byId(s.clients, a.clientId)).toLowerCase().includes(t) || petNames(s, a.petIds).toLowerCase().includes(t))
      .sort((a, b) => (filter === 'upcoming' ? 1 : -1) * (a.date === b.date ? a.sequence - b.sequence : a.date < b.date ? -1 : 1))
      .slice(0, 200);
  }, [s, unit, filter, q, date]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by client or pet" className="!h-9 pl-9" />
        </div>
        <Segmented value={filter} onChange={setFilter} size="sm" options={LIST_FILTERS} className="overflow-x-auto" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No appointments" body="Nothing matches these filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Window</th>
                <th className="px-4 py-2">Client · pets</th>
                <th className="hidden px-4 py-2 md:table-cell">Services</th>
                <th className="hidden px-4 py-2 sm:table-cell">Unit</th>
                <th className="px-4 py-2">Status</th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a: Appointment) => {
                const team = byId(s.teams, a.teamId);
                return (
                  <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openAppt(a.id)}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{fmtDate(a.date, 'EEE MMM d')}</td>
                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-slate-600">{fmtWindow(a.windowStart, a.windowEnd)}</td>
                    <td className="px-4 py-2.5">
                      <button className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${a.clientId}`); }}>
                        {clientName(byId(s.clients, a.clientId))}
                      </button>
                      <span className="block text-xs text-slate-500">{petNames(s, a.petIds)}</span>
                    </td>
                    <td className="hidden max-w-56 truncate px-4 py-2.5 text-slate-600 md:table-cell">{serviceNames(s, a.serviceIds)}</td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="size-2 rounded-full" style={{ background: team?.color }} /> {team?.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="tabular hidden px-4 py-2.5 text-right text-slate-600 lg:table-cell">{money(a.estimatedTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
        {rows.length} appointments · {fmtDuration(rows.reduce((t, a) => t + a.durationMins, 0))} on site · from {fmtDate(date)}
      </p>
    </Card>
  );
}
