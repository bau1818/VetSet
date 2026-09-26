import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CalendarPlus,
  Car,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Hourglass,
  ListTodo,
  Route,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientFormModal } from '../components/ClientForms';
import { Meter } from '../components/charts';
import { RouteMap, type MapRoute } from '../components/RouteMap';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, Progress, Stat } from '../components/ui';
import { toggleTask } from '../data/actions';
import { buildDayRoute, pointOf, useDayRoutes } from '../data/planning';
import { byId, clientName, invoiceBalance, petNames } from '../data/selectors';
import { useData } from '../data/store';
import { useUi } from '../data/ui';
import { money, miles as fmtMiles, plural } from '../lib/format';
import { fmtDate, fmtDuration, fmtTime, fmtWindow, nowMinutes, relDay, shiftDate, todayStr } from '../lib/time';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function Dashboard() {
  const s = useData();
  const navigate = useNavigate();
  const openAppt = useUi((u) => u.openAppointment);
  const today = todayStr();
  const routes = useDayRoutes(today);
  const [addingClient, setAddingClient] = useState(false);
  const office = s.staff.find((x) => x.role === 'office');

  const kpis = useMemo(() => {
    const todays = routes.flatMap((r) => r.appointments);
    const done = todays.filter((a) => a.status === 'completed').length;
    const driveMins = routes.reduce((t, r) => t + (r.plan?.driveMins ?? 0), 0);
    const driveMiles = routes.reduce((t, r) => t + (r.plan?.driveMiles ?? 0), 0);
    const serviceMins = routes.reduce((t, r) => t + (r.plan?.serviceMins ?? 0), 0);
    const weekEnd = shiftDate(today, 6);
    const week = s.appointments.filter((a) => a.date >= today && a.date <= weekEnd && !['cancelled', 'no_show'].includes(a.status));
    const unconfirmed = s.appointments.filter((a) => a.status === 'scheduled' && a.date >= today && a.date <= shiftDate(today, 2));
    const recalls = s.reminders.filter((r) => ['due', 'contacted'].includes(r.status) && r.dueDate <= shiftDate(today, 30));
    const open = s.invoices.filter((i) => invoiceBalance(i) > 0);
    const overdue = open.filter((i) => i.status === 'overdue');
    return {
      visits: todays.length,
      done,
      driveMins,
      driveMiles,
      efficiency: serviceMins + driveMins > 0 ? Math.round((serviceMins / (serviceMins + driveMins)) * 100) : 0,
      weekRevenue: week.reduce((t, a) => t + a.estimatedTotal, 0),
      weekVisits: week.length,
      unconfirmed,
      recalls,
      ar: open.reduce((t, i) => t + invoiceBalance(i), 0),
      overdue,
    };
  }, [routes, s.appointments, s.reminders, s.invoices, today]);

  const mapRoutes: MapRoute[] = routes
    .filter((r) => r.appointments.length)
    .map((r) => ({
      id: r.team.id,
      color: r.team.color,
      base: r.team.base,
      baseLabel: `${r.team.name} base`,
      stops: r.appointments.flatMap((a, i) => {
        const p = pointOf(s, a);
        return p ? [{ id: a.id, point: p, label: String(i + 1), title: clientName(byId(s.clients, a.clientId)), subtitle: `${fmtWindow(a.windowStart, a.windowEnd)} · ${petNames(s, a.petIds)}`, done: a.status === 'completed' }] : [];
      }),
    }));

  // Next 7 days capacity (road data if cached, estimates otherwise — no extra requests).
  const capacity = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => shiftDate(today, i)).map((date) => ({
      date,
      units: s.teams.map((t) => {
        const r = buildDayRoute(s, t, date);
        if (!r.cfg) return { team: t, off: true, pct: 0, stops: 0, freeMins: 0 };
        const avail = r.cfg.dayEnd - r.cfg.dayStart;
        const used = r.plan && r.appointments.length ? r.plan.serviceMins + r.plan.driveMins + r.appointments.length * s.settings.bufferMins : 0;
        return { team: t, off: false, pct: (used / avail) * 100, stops: r.appointments.length, freeMins: Math.max(0, avail - used) };
      }),
    }));
  }, [s, today]);

  const tasks = s.tasks.filter((t) => !t.done || t.dueDate === today).sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const leads = s.clients.filter((c) => c.status === 'lead');
  const urgentWait = s.waitlist.filter((w) => w.status === 'waiting');
  const lateStops = routes.flatMap((r) =>
    (r.plan?.stops ?? []).filter((p) => p.lateMins > 0).map((p) => ({ route: r, p, appt: r.appointments.find((a) => a.id === p.id)! })),
  ).filter((x) => x.appt && !['completed', 'arrived'].includes(x.appt.status));

  const attention: { icon: typeof AlertTriangle; tone: string; title: string; sub: string; to?: string; onClick?: () => void }[] = [
    ...lateStops.map((x) => ({
      icon: AlertTriangle,
      tone: 'text-red-600 bg-red-50',
      title: `${clientName(byId(s.clients, x.appt.clientId))}: ETA ${fmtTime(x.p.arrival)} misses window`,
      sub: `${x.route.team.name} · promised ${fmtWindow(x.appt.windowStart, x.appt.windowEnd)} — reorder or notify`,
      to: `/routes?team=${x.route.team.id}`,
    })),
    ...(kpis.unconfirmed.length
      ? [{ icon: BellRing, tone: 'text-sky-700 bg-sky-50', title: `${plural(kpis.unconfirmed.length, 'visit')} not yet confirmed`, sub: 'Next 2 days — send confirmations', to: '/messages?tab=confirm' }]
      : []),
    ...(kpis.overdue.length
      ? [{ icon: CircleDollarSign, tone: 'text-red-600 bg-red-50', title: `${plural(kpis.overdue.length, 'overdue invoice')}`, sub: `${money(kpis.overdue.reduce((t, i) => t + invoiceBalance(i), 0))} past due`, to: '/billing?filter=overdue' }]
      : []),
    ...(urgentWait.length
      ? [{ icon: Hourglass, tone: 'text-amber-700 bg-amber-50', title: `${plural(urgentWait.length, 'client')} on the waitlist`, sub: `${urgentWait.filter((w) => w.urgency === 'urgent').length} urgent — find them a nearby slot`, to: '/messages?tab=waitlist' }]
      : []),
    ...(leads.length
      ? [{ icon: UserPlus, tone: 'text-violet-700 bg-violet-50', title: `${plural(leads.length, 'new lead')} to call`, sub: leads.map((l) => l.firstName).join(', '), to: '/clients?filter=lead' }]
      : []),
    ...(kpis.recalls.length
      ? [{ icon: Sparkles, tone: 'text-brand-700 bg-brand-50', title: `${plural(kpis.recalls.length, 'pet')} due for care in 30 days`, sub: 'Recall list — book them onto nearby routes', to: '/messages?tab=recalls' }]
      : []),
  ];

  const nowM = nowMinutes();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={`${greeting()}, ${office?.name.split(' ')[0] ?? 'there'}`}
        subtitle={`${fmtDate(today, 'EEEE, MMMM d')} · ${s.settings.businessName}`}
        actions={
          <>
            <Button icon={UserPlus} onClick={() => setAddingClient(true)}>
              Add client
            </Button>
            <LinkButton to="/book" variant="primary" icon={CalendarPlus}>
              Find the best slot
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Stat icon={CalendarCheck2} label="Visits today" value={kpis.visits} sub={`${kpis.done} completed`} onClick={() => navigate('/schedule')} />
        <Stat icon={Car} label="Driving today" value={fmtDuration(kpis.driveMins)} sub={`${fmtMiles(kpis.driveMiles)} · ${kpis.efficiency}% time on site`} tone="indigo" onClick={() => navigate('/routes')} />
        <Stat icon={Clock3} label="Booked next 7 days" value={money(kpis.weekRevenue)} sub={`${kpis.weekVisits} visits`} />
        <Stat icon={BellRing} label="Unconfirmed (2 days)" value={kpis.unconfirmed.length} sub="Send confirmations" tone="amber" onClick={() => navigate('/messages?tab=confirm')} />
        <Stat icon={Sparkles} label="Recalls due (30 days)" value={kpis.recalls.length} sub="Book onto nearby routes" tone="slate" onClick={() => navigate('/messages?tab=recalls')} />
        <Stat icon={CircleDollarSign} label="Outstanding A/R" value={money(kpis.ar)} sub={`${kpis.overdue.length} overdue`} tone="red" onClick={() => navigate('/billing')} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card>
            <CardHeader icon={Route} title="Today’s routes" subtitle="Live order, ETAs and progress for each unit" actions={<LinkButton to="/routes" size="sm" variant="ghost">Open planner <ArrowRight className="size-4" /></LinkButton>} />
            {mapRoutes.length ? (
              <RouteMap routes={mapRoutes} className="m-3 h-72 sm:h-80" onStopClick={openAppt} />
            ) : (
              <EmptyState icon={Route} title="No routes today" body="Nobody is scheduled in the field today." />
            )}
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {routes.map((r) => {
                const doctor = byId(s.staff, r.team.doctorId);
                const driver = byId(s.staff, r.team.driverId);
                const done = r.appointments.filter((a) => a.status === 'completed').length;
                const next = r.appointments.find((a) => !['completed'].includes(a.status));
                const nextPlan = next && r.plan?.stops.find((p) => p.id === next.id);
                return (
                  <li key={r.team.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: r.team.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium text-slate-900">
                          {r.team.name}
                          <span className="truncate text-xs font-normal text-slate-500">
                            {doctor?.name} · {driver?.name}
                          </span>
                        </p>
                        {r.appointments.length ? (
                          <div className="mt-1.5 flex items-center gap-3">
                            <Progress value={(done / r.appointments.length) * 100} className="max-w-48" color={r.team.color} />
                            <span className="text-xs text-slate-500">
                              {done}/{r.appointments.length} stops · {fmtDuration(r.plan?.driveMins ?? 0)} driving · back ~{fmtTime(r.plan?.returnBase ?? 0)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">{r.cfg ? 'No visits booked' : 'Off today'}</p>
                        )}
                      </div>
                    </div>
                    {next && nextPlan && (
                      <button onClick={() => openAppt(next.id)} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100">
                        <span className="text-xs text-slate-500">{nextPlan.arrival > nowM ? 'Next' : 'Current'}</span>
                        <span className="font-medium text-slate-800">{clientName(byId(s.clients, next.clientId))}</span>
                        <span className="tabular text-xs text-slate-500">ETA {fmtTime(nextPlan.arrival)}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={CalendarCheck2} title="Capacity — next 7 days" subtitle="Share of each unit’s working day already filled by visits + driving. Book into the open days." />
            <ul className="divide-y divide-slate-100">
              {capacity.map((d) => (
                <li key={d.date}>
                  <button onClick={() => navigate(`/schedule?date=${d.date}`)} className="grid w-full grid-cols-[6.5rem_1fr] items-center gap-4 px-4 py-2.5 text-left hover:bg-slate-50 sm:px-5">
                    <span className="text-sm">
                      <span className="block font-medium text-slate-800">{relDay(d.date, today)}</span>
                      <span className="block text-xs text-slate-500">{fmtDate(d.date, 'MMM d')}</span>
                    </span>
                    <span className="grid gap-1.5 sm:grid-cols-2 sm:gap-5">
                      {d.units.map((u) => (
                        <span key={u.team.id} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                          <span className="flex items-center gap-1.5 truncate text-slate-600">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: u.team.color }} />
                            {u.team.name.replace(' Unit', '')}
                          </span>
                          {u.off ? (
                            <span className="text-slate-400">Off</span>
                          ) : (
                            <Meter value={u.pct} color={u.team.color} title={`${u.stops} stops · ${Math.round(u.pct)}% full`} />
                          )}
                          <span className="tabular text-right text-slate-500">{u.off ? '' : `${u.stops} · ${Math.round(u.pct)}%`}</span>
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader icon={ClipboardList} title="Needs attention" subtitle={attention.length ? `${attention.length} items` : 'All clear'} />
            {attention.length ? (
              <ul className="divide-y divide-slate-100">
                {attention.map((a, i) => (
                  <li key={i}>
                    <Link to={a.to ?? '#'} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', a.tone)}>
                        <a.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-800">{a.title}</span>
                        <span className="block truncate text-xs text-slate-500">{a.sub}</span>
                      </span>
                      <ArrowRight className="mt-2 size-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CheckCircle2} title="Nothing urgent" body="Confirmations, invoices and the waitlist are all handled." />
            )}
          </Card>

          <Card>
            <CardHeader icon={ListTodo} title="Tasks" subtitle="Office follow-ups" />
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => {
                const assignee = byId(s.staff, t.assigneeId);
                const overdue = !t.done && t.dueDate < today;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="mt-1 size-4 shrink-0 accent-brand-700" aria-label={`Mark "${t.title}" done`} />
                    <div className="min-w-0 flex-1">
                      <p className={clsx('text-sm', t.done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                        {t.clientId ? <Link to={`/clients/${t.clientId}`} className="hover:text-brand-700">{t.title}</Link> : t.title}
                      </p>
                      <p className={clsx('text-xs', overdue ? 'text-red-600' : 'text-slate-500')}>
                        {relDay(t.dueDate, today)}
                        {assignee ? ` · ${assignee.name}` : ''}
                      </p>
                    </div>
                    {assignee && <Avatar name={assignee.name} color={assignee.color} size="sm" />}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={Users} title="Recent bookings" />
            <ul className="divide-y divide-slate-100">
              {s.appointments
                .filter((a) => a.date >= today && a.status !== 'cancelled')
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id}>
                    <button onClick={() => openAppt(a.id)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{clientName(byId(s.clients, a.clientId))}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {relDay(a.date, today)} · {fmtWindow(a.windowStart, a.windowEnd)} · {petNames(s, a.petIds)}
                        </span>
                      </span>
                      <Badge tone={a.status === 'confirmed' ? 'brand' : 'blue'}>{a.status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}</Badge>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>

      <ClientFormModal open={addingClient} onClose={() => setAddingClient(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </div>
  );
}
