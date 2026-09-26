import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  MessageSquareText,
  Navigation,
  Pin,
  Printer,
  Route as RouteIcon,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RouteMap, type MapRoute } from '../components/RouteMap';
import { Badge, Button, Card, CardHeader, EmptyState, Input, LinkButton, Modal, PageHeader, Segmented, StatusBadge } from '../components/ui';
import { applyRouteOrder } from '../data/actions';
import { pointOf, useDayRoutes, type DayRoute } from '../data/planning';
import { byId, clientName, petNames } from '../data/selectors';
import { useData } from '../data/store';
import { compose, toast, useUi } from '../data/ui';
import { googleRouteUrl } from '../lib/geo';
import { miles as fmtMiles } from '../lib/format';
import { optimize, windowAround, type OptimizeMode, type OptimizeResult } from '../lib/routing';
import { fmtDate, fmtDuration, fmtTime, fmtWindow, relDay, shiftDate, toTime, todayStr } from '../lib/time';

export function RoutesPage() {
  const s = useData();
  const role = useUi((u) => u.role);
  const actingTeamId = useUi((u) => u.actingTeamId);
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const date = params.get('date') ?? today;
  const teamParam = params.get('team') ?? (role === 'office' ? 'all' : actingTeamId);
  const routes = useDayRoutes(date);
  const visible = teamParam === 'all' ? routes : routes.filter((r) => r.team.id === teamParam);
  const single = teamParam !== 'all' ? visible[0] : undefined;

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  const mapRoutes: MapRoute[] = visible.map((r) => ({
    id: r.team.id,
    color: r.team.color,
    base: r.team.base,
    baseLabel: `${r.team.name} base`,
    stops: r.appointments.flatMap((a, i) => {
      const p = pointOf(s, a);
      const plan = r.plan?.stops.find((x) => x.id === a.id);
      return p
        ? [{ id: a.id, point: p, label: String(i + 1), title: `${i + 1}. ${clientName(byId(s.clients, a.clientId))}`, subtitle: `ETA ${plan ? fmtTime(plan.arrival) : '—'} · window ${fmtWindow(a.windowStart, a.windowEnd)}`, done: a.status === 'completed', late: !!plan && plan.lateMins > 0 }]
        : [];
    }),
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">{s.settings.businessName} — Run sheet</h1>
        <p>{fmtDate(date, 'EEEE, MMMM d, yyyy')}</p>
      </div>
      <PageHeader
        title="Routes"
        subtitle="Drive-time–aware stop order, ETAs vs. promised windows, and one-click optimization."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs">
              <button className="p-2 text-slate-500 hover:text-slate-900" onClick={() => set('date', shiftDate(date, -1))} aria-label="Previous day">
                <ChevronLeft className="size-4" />
              </button>
              <Input type="date" value={date} onChange={(e) => e.target.value && set('date', e.target.value)} className="h-8 w-36 border-0 px-1 shadow-none focus:ring-0" />
              <button className="p-2 text-slate-500 hover:text-slate-900" onClick={() => set('date', shiftDate(date, 1))} aria-label="Next day">
                <ChevronRight className="size-4" />
              </button>
            </div>
            {date !== today && (
              <Button size="sm" variant="ghost" onClick={() => set('date', today)}>
                Today
              </Button>
            )}
            <Segmented
              value={teamParam}
              onChange={(v) => set('team', v)}
              size="sm"
              options={[{ value: 'all', label: 'All units' }, ...s.teams.map((t) => ({ value: t.id, label: t.name }))]}
            />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-4">
          {visible.map((r) => (
            <RouteCard key={r.team.id} route={r} expanded={!!single || visible.length === 1} onFocus={() => set('team', r.team.id)} />
          ))}
        </div>
        <div className="no-print min-w-0 lg:sticky lg:top-20 lg:self-start">
          {visible.some((r) => r.appointments.length) ? (
            <RouteMap routes={mapRoutes} className="h-[22rem] lg:h-[calc(100dvh-9rem)]" onStopClick={(id) => useUi.getState().openAppointment(id)} />
          ) : (
            <Card>
              <EmptyState icon={RouteIcon} title={`No stops ${relDay(date, today).toLowerCase()}`} body="Nothing is booked for this selection." action={<LinkButton to="/book" variant="primary">Book a visit</LinkButton>} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RouteCard({ route, expanded, onFocus }: { route: DayRoute; expanded: boolean; onFocus: () => void }) {
  const s = useData();
  const openAppt = useUi((u) => u.openAppointment);
  const [optimizing, setOptimizing] = useState(false);
  const { team, plan, appointments, cfg } = route;
  const doctor = byId(s.staff, team.doctorId);
  const driver = byId(s.staff, team.driverId);

  const quick = useMemo(() => (cfg && route.stops.length > 1 ? optimize(route.stops, cfg, 'keep-windows') : null), [route, cfg]);
  const replan = useMemo(() => (cfg && route.stops.length > 1 ? optimize(route.stops, cfg, 'replan-windows') : null), [route, cfg]);
  const potential = Math.max(quick?.savedMins ?? 0, replan?.savedMins ?? 0);

  const move = (idx: number, dir: -1 | 1) => {
    const ids = appointments.map((a) => a.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    applyRouteOrder(team.id, route.date, ids);
  };

  const navUrl = googleRouteUrl([team.base, ...appointments.flatMap((a) => (a.status === 'completed' ? [] : [pointOf(s, a)!])).filter(Boolean), team.base]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: team.color }} />
            {team.name}
          </span>
        }
        subtitle={`${doctor?.name} · ${driver?.name} · ${team.vehicle}`}
        actions={
          !expanded ? (
            <Button size="xs" variant="ghost" onClick={onFocus}>
              Focus
            </Button>
          ) : undefined
        }
      />
      {!cfg && !appointments.length ? (
        <p className="px-5 py-4 text-sm text-slate-500">{team.name} is off this day.</p>
      ) : !appointments.length ? (
        <p className="px-5 py-4 text-sm text-slate-500">No visits booked.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
            {[
              { l: 'Stops', v: appointments.length },
              { l: 'Driving', v: `${fmtDuration(plan?.driveMins ?? 0)}`, sub: fmtMiles(plan?.driveMiles ?? 0) },
              { l: 'On site', v: fmtDuration(plan?.serviceMins ?? 0) },
              { l: 'Day', v: `${fmtTime(plan?.leaveBase ?? 0, true)}–${fmtTime(plan?.returnBase ?? 0, true)}`, warn: (plan?.overtimeMins ?? 0) > 0 },
            ].map((k) => (
              <div key={k.l} className="bg-white px-4 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 uppercase">{k.l}</p>
                <p className={clsx('tabular text-sm font-semibold', k.warn ? 'text-amber-700' : 'text-slate-900')}>
                  {k.v} {k.sub && <span className="font-normal text-slate-500">· {k.sub}</span>}
                </p>
              </div>
            ))}
          </div>

          {(potential >= 3 || (plan?.lateCount ?? 0) > 0) && (
            <div className={clsx('no-print flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-sm', (plan?.lateCount ?? 0) > 0 ? 'border-red-100 bg-red-50 text-red-800' : 'border-brand-100 bg-brand-50 text-brand-900')}>
              <span className="flex items-center gap-2">
                {(plan?.lateCount ?? 0) > 0 ? <TriangleAlert className="size-4" /> : <Sparkles className="size-4" />}
                {(plan?.lateCount ?? 0) > 0
                  ? `${plan!.lateCount} stop${plan!.lateCount > 1 ? 's' : ''} will miss the promised window.`
                  : `This route could save up to ${Math.round(potential)} min of driving.`}
              </span>
              <Button size="xs" variant="primary" icon={Wand2} onClick={() => setOptimizing(true)}>
                Optimize
              </Button>
            </div>
          )}

          <ol className="px-2 py-2">
            <li className="flex items-center gap-3 px-2 py-1.5 text-sm text-slate-500">
              <span className="grid size-7 place-items-center rounded-lg bg-slate-900 text-white">
                <Home className="size-3.5" />
              </span>
              Leave {team.base.city} base at <span className="tabular font-medium text-slate-800">{fmtTime(plan?.leaveBase ?? 0)}</span>
            </li>
            {appointments.map((a, i) => {
              const p = plan?.stops.find((x) => x.id === a.id);
              const client = byId(s.clients, a.clientId);
              const locked = ['completed', 'arrived', 'en_route'].includes(a.status);
              return (
                <li key={a.id}>
                  {p && (
                    <div className="ml-[21px] flex items-center gap-2 border-l-2 border-dashed border-slate-200 py-1 pl-5 text-xs text-slate-400">
                      <Car className="size-3.5" /> {Math.round(p.legMins)} min · {fmtMiles(p.legMiles)}
                      {p.waitMins > 5 && <span className="text-slate-400">· {Math.round(p.waitMins)} min early</span>}
                    </div>
                  )}
                  <div className={clsx('group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50', a.status === 'completed' && 'opacity-60')}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: team.color }}>
                      {i + 1}
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => openAppt(a.id)}>
                      <p className="flex flex-wrap items-center gap-x-2 font-medium text-slate-900">
                        {clientName(client)}
                        {a.pinned && <Pin className="size-3.5 text-amber-600" aria-label="Pinned time" />}
                        <span className="text-xs font-normal text-slate-500">{client?.address.city}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {petNames(s, a.petIds)} · {fmtDuration(a.durationMins)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={clsx('tabular rounded-md px-1.5 py-0.5 font-medium', p && p.lateMins > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700')}>
                          <Clock className="mr-1 inline size-3" />
                          ETA {p ? fmtTime(p.arrival) : '—'}
                        </span>
                        <span className="text-slate-500">window {fmtWindow(a.windowStart, a.windowEnd)}</span>
                        <StatusBadge status={a.status} />
                      </p>
                    </button>
                    <div className="no-print flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                      <button disabled={locked || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30" aria-label="Move earlier">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button disabled={locked || i === appointments.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30" aria-label="Move later">
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {plan && (
              <>
                <div className="ml-[21px] flex items-center gap-2 border-l-2 border-dashed border-slate-200 py-1 pl-5 text-xs text-slate-400">
                  <Car className="size-3.5" /> {Math.round(plan.returnLegMins)} min · {fmtMiles(plan.returnLegMiles)}
                </div>
                <li className="flex items-center gap-3 px-2 py-1.5 text-sm text-slate-500">
                  <span className="grid size-7 place-items-center rounded-lg bg-slate-900 text-white">
                    <Home className="size-3.5" />
                  </span>
                  Back at base ~<span className="tabular font-medium text-slate-800">{fmtTime(plan.returnBase)}</span>
                  {plan.overtimeMins > 0 && <Badge tone="amber">{Math.round(plan.overtimeMins)} min past end of day</Badge>}
                </li>
              </>
            )}
          </ol>
          <div className="no-print flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
            <Button size="sm" icon={Wand2} onClick={() => setOptimizing(true)} disabled={appointments.length < 2}>
              Optimize route
            </Button>
            {navUrl && (
              <LinkButton size="sm" href={navUrl} icon={Navigation}>
                Open in Google Maps
              </LinkButton>
            )}
            <Button size="sm" variant="ghost" icon={Printer} onClick={() => window.print()}>
              Print run sheet
            </Button>
          </div>
        </>
      )}
      {optimizing && quick && replan && <OptimizeModal route={route} quick={quick} replan={replan} onClose={() => setOptimizing(false)} />}
    </Card>
  );
}

function OptimizeModal({ route, quick, replan, onClose }: { route: DayRoute; quick: OptimizeResult; replan: OptimizeResult; onClose: () => void }) {
  const s = useData();
  const [mode, setMode] = useState<OptimizeMode>(quick.savedMins >= 3 || replan.savedMins - quick.savedMins < 5 ? 'keep-windows' : 'replan-windows');
  const [applied, setApplied] = useState<string[] | null>(null);
  const r = mode === 'keep-windows' ? quick : replan;

  const newWindows = useMemo(() => {
    if (mode !== 'replan-windows') return undefined;
    const out: Record<string, { start: string; end: string }> = {};
    r.order.forEach((stop, i) => {
      const a = byId(s.appointments, stop.id);
      if (!a || a.pinned || ['completed', 'arrived', 'en_route'].includes(a.status)) return;
      const w = windowAround(r.plan.stops[i].start, s.settings.windowMins, route.cfg?.dayStart);
      out[a.id] = { start: toTime(w.start), end: toTime(w.end) };
    });
    return out;
  }, [mode, r, s.appointments, s.settings.windowMins, route.cfg]);

  const changedWindows = newWindows
    ? Object.entries(newWindows).filter(([id, w]) => {
        const a = byId(s.appointments, id);
        return a && (a.windowStart !== w.start || a.windowEnd !== w.end);
      })
    : [];

  const apply = () => {
    applyRouteOrder(route.team.id, route.date, r.order.map((x) => x.id), newWindows);
    toast(r.savedMins > 0.5 ? `Route optimized — saves ${Math.round(r.savedMins)} min of driving` : 'Route order applied');
    if (changedWindows.length) setApplied(changedWindows.map(([id]) => id));
    else onClose();
  };

  if (applied)
    return (
      <Modal open onClose={onClose} title="Let clients know their new window">
        <p className="mb-3 text-sm text-slate-600">These clients have a new arrival window. Send each a quick update:</p>
        <ul className="space-y-2">
          {applied.map((id) => {
            const a = byId(s.appointments, id)!;
            return (
              <li key={id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{clientName(byId(s.clients, a.clientId))}</span>
                  <span className="block text-xs text-slate-500">New window {fmtWindow(a.windowStart, a.windowEnd)}</span>
                </span>
                <Button size="sm" icon={MessageSquareText} onClick={() => compose({ clientId: a.clientId, appointmentId: a.id, templateKey: 'window_change' })}>
                  Notify
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Optimize ${route.team.name} · ${fmtDate(route.date)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Wand2} disabled={!r.changed && !changedWindows.length} onClick={apply}>
            {r.changed ? `Apply new order${changedWindows.length ? ` & ${changedWindows.length} new windows` : ''}` : 'Already optimal'}
          </Button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        className="mb-4"
        options={[
          { value: 'keep-windows', label: 'Keep promised windows' },
          { value: 'replan-windows', label: 'Re-plan windows' },
        ]}
      />
      <p className="mb-4 text-sm text-slate-500">
        {mode === 'keep-windows'
          ? 'Reorders stops only where every client still gets seen inside the window they were promised.'
          : 'Finds the shortest drive, then assigns fresh arrival windows. Best for days that are not yet confirmed. Pinned and in-progress visits never move.'}
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          { l: 'Driving', a: fmtDuration(r.before.driveMins), b: fmtDuration(r.plan.driveMins) },
          { l: 'Miles', a: fmtMiles(r.before.driveMiles), b: fmtMiles(r.plan.driveMiles) },
          { l: 'Late stops', a: String(r.before.lateCount), b: String(r.plan.lateCount) },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500 uppercase">{k.l}</p>
            <p className="tabular text-sm text-slate-400 line-through">{k.a}</p>
            <p className="tabular text-lg font-semibold text-slate-900">{k.b}</p>
          </div>
        ))}
      </div>
      {r.savedMins > 0.5 ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Saves {Math.round(r.savedMins)} min and {fmtMiles(Math.max(0, r.savedMiles))} of driving.
        </p>
      ) : (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">The current order is already the most efficient for this mode.</p>
      )}
      <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {r.order.map((stop, i) => {
          const a = byId(s.appointments, stop.id)!;
          const oldIdx = route.appointments.findIndex((x) => x.id === a.id);
          const nw = newWindows?.[a.id];
          const winChanged = nw && (nw.start !== a.windowStart || nw.end !== a.windowEnd);
          return (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: route.team.color }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{clientName(byId(s.clients, a.clientId))}</span>
                <span className="block text-xs text-slate-500">
                  ETA {fmtTime(r.plan.stops[i].arrival)} ·{' '}
                  {winChanged ? (
                    <>
                      <span className="line-through">{fmtWindow(a.windowStart, a.windowEnd)}</span> → <span className="font-medium text-amber-700">{fmtWindow(nw.start, nw.end)}</span>
                    </>
                  ) : (
                    fmtWindow(a.windowStart, a.windowEnd)
                  )}
                </span>
              </span>
              {oldIdx !== i && <Badge tone="blue">was #{oldIdx + 1}</Badge>}
              {a.pinned && <Badge tone="amber" icon={Pin}>Pinned</Badge>}
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
