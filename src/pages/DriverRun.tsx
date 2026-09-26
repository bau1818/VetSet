import clsx from 'clsx';
import { AlarmClock, Car, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Gauge, KeyRound, MapPin, MessageSquareText, Navigation, Phone, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { RunningLateModal } from '../components/RunningLate';
import { Badge, Button, Card, CardHeader, EmptyState, Input, LinkButton, Progress, Segmented, SpeciesIcon, StatusBadge } from '../components/ui';
import { setStatus } from '../data/actions';
import { pointOf, useDayRoute } from '../data/planning';
import { byId, clientName } from '../data/selectors';
import { upsert, useData } from '../data/store';
import { compose, toast, useUi } from '../data/ui';
import { appleNavUrl, fmtAddress, googleNavUrl, googleRouteUrl } from '../lib/geo';
import { miles as fmtMiles, phoneHref } from '../lib/format';
import { fmtDate, fmtDuration, fmtTime, fmtWindow, relDay, shiftDate, todayStr } from '../lib/time';

const CHECKLIST = [
  'Fuel at least half a tank',
  'Tires & lights checked',
  'Vaccine cooler at 36–46°F',
  'Exam supplies & table restocked',
  'Sharps container has room',
  'Card reader & phone charged',
  'Scale, muzzles & towels loaded',
  'First-aid kit onboard',
];

export function DriverRun() {
  const s = useData();
  const role = useUi((u) => u.role);
  const acting = useUi((u) => u.actingTeamId);
  const openAppt = useUi((u) => u.openAppointment);
  const [teamId, setTeamId] = useState(acting);
  const [date, setDate] = useState(todayStr());
  const [late, setLate] = useState(false);
  const today = todayStr();
  const tid = role === 'driver' ? acting : teamId;
  const route = useDayRoute(tid, date);
  const team = byId(s.teams, tid);
  const driver = byId(s.staff, team?.driverId);
  const appts = route?.appointments ?? [];
  const plan = route?.plan;
  const nextIdx = appts.findIndex((a) => a.status !== 'completed');
  const next = nextIdx >= 0 ? appts[nextIdx] : undefined;
  const nextPlan = next ? plan?.stops.find((p) => p.id === next.id) : undefined;
  const nextClient = next ? byId(s.clients, next.clientId) : undefined;
  const nextPoint = next ? pointOf(s, next) : undefined;
  const done = appts.filter((a) => a.status === 'completed').length;

  const checklistId = `${tid}:${date}`;
  const checklist = s.checklists.find((c) => c.id === checklistId) ?? { id: checklistId, teamId: tid, date, checked: [] as string[] };
  const saveChecklist = (changes: Partial<typeof checklist>) => upsert('checklists', { ...checklist, ...changes });

  const fullRoute = team ? googleRouteUrl([team.base, ...appts.filter((a) => a.status !== 'completed').map((a) => pointOf(s, a)!).filter(Boolean), team.base]) : '';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-700">Driver run sheet</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{driver?.name}</h1>
          <p className="text-sm text-slate-500">
            {relDay(date, today)} · {team?.name} · {team?.vehicle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role === 'office' && <Segmented value={teamId} onChange={setTeamId} size="sm" options={s.teams.map((t) => ({ value: t.id, label: t.name }))} />}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white">
            <button className="p-2 text-slate-500" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
              <ChevronLeft className="size-4" />
            </button>
            <button className="px-2 text-sm font-medium text-slate-700" onClick={() => setDate(today)}>
              {date === today ? 'Today' : fmtDate(date, 'MMM d')}
            </button>
            <button className="p-2 text-slate-500" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {appts.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <Progress value={(done / appts.length) * 100} color={team?.color} className="!h-2" />
          <span className="text-sm whitespace-nowrap text-slate-600">
            {done}/{appts.length} stops · {fmtDuration(plan?.driveMins ?? 0)} · {fmtMiles(plan?.driveMiles ?? 0)}
          </span>
        </div>
      )}

      {appts.length === 0 ? (
        <Card className="mb-4">
          <EmptyState icon={Car} title="No stops" body={route?.cfg ? 'Nothing booked for this day.' : 'Unit is off this day.'} />
        </Card>
      ) : next && nextClient ? (
        <Card className="mb-4 overflow-hidden border-brand-200 ring-1 ring-brand-100">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-2.5 text-white">
            <span className="text-sm font-medium">
              {next.status === 'arrived' ? 'Current stop' : 'Next stop'} · {nextIdx + 1} of {appts.length}
            </span>
            <span className="tabular text-sm">
              ETA <span className="font-semibold">{nextPlan ? fmtTime(nextPlan.arrival) : '—'}</span>
            </span>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xl font-semibold text-slate-900">{clientName(nextClient)}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-base text-slate-700">
                <MapPin className="mt-1 size-4 shrink-0 text-slate-400" /> {fmtAddress(nextClient.address, true)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Window {fmtWindow(next.windowStart, next.windowEnd)}
                {nextPlan && ` · ${Math.round(nextPlan.legMins)} min / ${fmtMiles(nextPlan.legMiles)} from ${nextIdx === 0 ? 'base' : 'last stop'}`}
                {nextPlan && nextPlan.lateMins > 0 && <Badge tone="red" className="ml-2">Running {Math.round(nextPlan.lateMins)} min late</Badge>}
              </p>
            </div>
            {nextClient.accessNotes && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[15px] text-amber-900">
                <KeyRound className="mt-0.5 size-5 shrink-0" /> {nextClient.accessNotes}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {next.petIds.map((id) => {
                const pet = byId(s.pets, id);
                return pet ? (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700">
                    <SpeciesIcon species={pet.species} /> {pet.name}
                    {pet.weightLbs ? <span className="text-slate-400">{pet.weightLbs} lb</span> : null}
                  </span>
                ) : null;
              })}
              {next.petIds.flatMap((id) => byId(s.pets, id)?.alerts.map((al) => ({ id, al })) ?? []).map(({ id, al }) => (
                <Badge key={id + al} tone="red" icon={TriangleAlert}>
                  {byId(s.pets, id)?.name}: {al}
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nextPoint && (
                <>
                  <LinkButton href={googleNavUrl(nextPoint)} variant="primary" size="lg" icon={Navigation}>
                    Google Maps
                  </LinkButton>
                  <LinkButton href={appleNavUrl(nextPoint)} size="lg" icon={Navigation}>
                    Apple Maps
                  </LinkButton>
                </>
              )}
              <LinkButton href={phoneHref(nextClient.phone)} size="lg" icon={Phone}>
                Call client
              </LinkButton>
              <Button
                size="lg"
                icon={MessageSquareText}
                onClick={() => {
                  if (next.status === 'confirmed' || next.status === 'scheduled') setStatus(next.id, 'en_route');
                  compose({ clientId: next.clientId, appointmentId: next.id, templateKey: 'on_my_way', extra: { eta: nextPlan ? fmtTime(nextPlan.arrival) : '', minutes: nextPlan ? Math.round(nextPlan.legMins) : 15 } });
                }}
              >
                On my way
              </Button>
            </div>
            {date === today && (
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                {next.status !== 'arrived' ? (
                  <Button
                    className="flex-1"
                    size="lg"
                    variant="dark"
                    icon={MapPin}
                    onClick={() => {
                      setStatus(next.id, 'arrived');
                      toast(`Arrived at ${nextClient.lastName}`);
                    }}
                  >
                    Arrived
                  </Button>
                ) : (
                  <Button className="flex-1" size="lg" variant="dark" icon={CheckCircle2} onClick={() => openAppt(next.id)}>
                    Visit done
                  </Button>
                )}
                <Button size="lg" icon={AlarmClock} onClick={() => setLate(true)}>
                  Late
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <EmptyState icon={CheckCircle2} title="All stops done" body={`Head back to base — about ${Math.round(plan?.returnLegMins ?? 0)} min.`} />
        </Card>
      )}

      {appts.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="All stops" actions={fullRoute ? <LinkButton size="xs" href={fullRoute} icon={Navigation}>Full route</LinkButton> : undefined} />
          <ol className="divide-y divide-slate-100">
            {appts.map((a, i) => {
              const p = plan?.stops.find((x) => x.id === a.id);
              const c = byId(s.clients, a.clientId);
              return (
                <li key={a.id}>
                  <button onClick={() => openAppt(a.id)} className={clsx('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50', a.status === 'completed' && 'opacity-50')}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: a.status === 'completed' ? '#94a3b8' : team?.color }}>
                      {a.status === 'completed' ? <CheckCircle2 className="size-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{clientName(c)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c?.address.line1}, {c?.address.city}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-sm font-medium text-slate-800">{p ? fmtTime(p.arrival) : '—'}</span>
                      <StatusBadge status={a.status} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card>
        <CardHeader icon={ClipboardCheck} title="Pre-trip checklist & mileage" subtitle={`${checklist.checked.length}/${CHECKLIST.length} checked`} />
        <ul className="grid gap-1 p-3 sm:grid-cols-2">
          {CHECKLIST.map((item) => {
            const on = checklist.checked.includes(item);
            return (
              <li key={item}>
                <label className={clsx('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm', on ? 'text-slate-400 line-through' : 'text-slate-700 hover:bg-slate-50')}>
                  <input type="checkbox" className="size-5 accent-brand-700" checked={on} onChange={() => saveChecklist({ checked: on ? checklist.checked.filter((x) => x !== item) : [...checklist.checked, item] })} />
                  {item}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Odometer start
            <Input type="number" inputMode="numeric" className="mt-1" value={checklist.odometerStart ?? ''} onChange={(e) => saveChecklist({ odometerStart: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Odometer end
            <Input type="number" inputMode="numeric" className="mt-1" value={checklist.odometerEnd ?? ''} onChange={(e) => saveChecklist({ odometerEnd: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
          <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm text-slate-600 sm:col-span-1">
            <Gauge className="size-4 text-slate-400" />
            {checklist.odometerStart && checklist.odometerEnd ? `${checklist.odometerEnd - checklist.odometerStart} mi logged` : `Planned ${fmtMiles(plan?.driveMiles ?? 0)}`}
          </div>
        </div>
      </Card>
      <RunningLateModal open={late} onClose={() => setLate(false)} route={route} />
    </div>
  );
}
