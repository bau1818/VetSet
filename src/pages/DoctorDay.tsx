import clsx from 'clsx';
import { AlarmClock, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock, History, KeyRound, MapPin, NotebookText, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { RunningLateModal } from '../components/RunningLate';
import { Badge, Button, Card, EmptyState, Segmented, SpeciesIcon, StatusBadge } from '../components/ui';
import { setStatus } from '../data/actions';
import { useDayRoute } from '../data/planning';
import { byId, clientName, clientStats, remindersFor, serviceNames } from '../data/selectors';
import { useData } from '../data/store';
import { toast, useUi } from '../data/ui';
import { money } from '../lib/format';
import { ageFromDob, fmtDate, fmtDuration, fmtTime, fmtWindow, relDay, shiftDate, todayStr } from '../lib/time';

const SEX: Record<string, string> = { MN: 'Male (neutered)', FS: 'Female (spayed)', M: 'Male', F: 'Female', U: 'Sex unknown' };

export function DoctorDay() {
  const s = useData();
  const role = useUi((u) => u.role);
  const acting = useUi((u) => u.actingTeamId);
  const openAppt = useUi((u) => u.openAppointment);
  const [teamId, setTeamId] = useState(acting);
  const [date, setDate] = useState(todayStr());
  const [late, setLate] = useState(false);
  const today = todayStr();
  const tid = role === 'doctor' ? acting : teamId;
  const route = useDayRoute(tid, date);
  const team = byId(s.teams, tid);
  const doctor = byId(s.staff, team?.doctorId);
  const appts = route?.appointments ?? [];
  const plan = route?.plan;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-700">Doctor day sheet</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{doctor?.name}</h1>
          <p className="text-sm text-slate-500">
            {relDay(date, today)} · {fmtDate(date, 'EEEE, MMM d')} · {team?.name}
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

      {appts.length > 0 && plan && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: 'Visits', v: `${appts.filter((a) => a.status === 'completed').length}/${appts.length}` },
            { l: 'First arrival', v: fmtTime(plan.stops[0]?.arrival ?? 0) },
            { l: 'Driving', v: fmtDuration(plan.driveMins) },
            { l: 'Booked', v: money(appts.reduce((t, a) => t + a.estimatedTotal, 0)) },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase">{k.l}</p>
              <p className="tabular font-semibold text-slate-900">{k.v}</p>
            </div>
          ))}
        </div>
      )}
      {date === today && appts.some((a) => a.status !== 'completed') && (
        <Button className="mb-4 w-full sm:w-auto" icon={AlarmClock} onClick={() => setLate(true)}>
          Running late — notify clients
        </Button>
      )}

      {appts.length === 0 ? (
        <Card>
          <EmptyState title="No visits" body={route?.cfg ? 'Nothing booked for this day.' : `${team?.name} is off this day.`} />
        </Card>
      ) : (
        <ol className="space-y-3">
          {appts.map((a, i) => {
            const c = byId(s.clients, a.clientId);
            const p = plan?.stops.find((x) => x.id === a.id);
            const pets = a.petIds.map((id) => byId(s.pets, id)).filter(Boolean) as NonNullable<ReturnType<typeof byId<(typeof s.pets)[number]>>>[];
            const stats = c ? clientStats(s, c.id, today) : undefined;
            const lastVisit = s.appointments
              .filter((x) => x.clientId === a.clientId && x.status === 'completed' && x.date < a.date)
              .sort((x, y) => (x.date < y.date ? 1 : -1))[0];
            const due = remindersFor(s, a.petIds).filter((r) => !a.serviceIds.includes(r.serviceId));
            return (
              <li key={a.id}>
                <Card className={clsx('overflow-hidden', a.status === 'completed' && 'opacity-70')}>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: team?.color }}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="tabular text-sm font-semibold text-slate-900">
                          {p ? fmtTime(p.start) : fmtTime(a.windowStart)} <span className="font-normal text-slate-500">· window {fmtWindow(a.windowStart, a.windowEnd)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDuration(a.durationMins)} on site{p && p.legMins > 1 ? ` · ${Math.round(p.legMins)} min drive before` : ''}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <button onClick={() => openAppt(a.id)} className="text-left text-lg font-semibold text-slate-900 hover:text-brand-700">
                        {clientName(c)}
                      </button>
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="size-3.5" /> {c?.address.city}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-800">{serviceNames(s, a.serviceIds)}</p>
                      {a.reason && <p className="mt-0.5 text-sm text-slate-600">“{a.reason}”</p>}
                    </div>
                    <ul className="space-y-2">
                      {pets.map((pet) => (
                        <li key={pet.id} className="flex items-start gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                            <SpeciesIcon species={pet.species} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold text-slate-900">{pet.name}</span>{' '}
                              <span className="text-slate-500">
                                {pet.breed} · {ageFromDob(pet.dob)} · {SEX[pet.sex]}
                                {pet.weightLbs ? ` · ${pet.weightLbs} lb` : ''}
                              </span>
                            </p>
                            {pet.alerts.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {pet.alerts.map((al) => (
                                  <Badge key={al} tone="red" icon={TriangleAlert}>
                                    {al}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      {lastVisit && (
                        <p className="flex items-start gap-2 text-slate-600">
                          <History className="mt-0.5 size-4 shrink-0 text-slate-400" /> Last seen {fmtDate(lastVisit.date, 'MMM d')} — {serviceNames(s, lastVisit.serviceIds)}
                        </p>
                      )}
                      {due.length > 0 && (
                        <p className="flex items-start gap-2 text-sky-800">
                          <Sparkles className="mt-0.5 size-4 shrink-0" /> Also due: {due.map((r) => `${byId(s.pets, r.petId)?.name} ${byId(s.services, r.serviceId)?.name}`).join(', ')}
                        </p>
                      )}
                      {stats && stats.balance > 0 && (
                        <p className="flex items-start gap-2 text-red-700">
                          <CircleDollarSign className="mt-0.5 size-4 shrink-0" /> Open balance {money(stats.balance)} — collect at visit
                        </p>
                      )}
                      {c?.accessNotes && (
                        <p className="flex items-start gap-2 text-amber-800">
                          <KeyRound className="mt-0.5 size-4 shrink-0" /> {c.accessNotes}
                        </p>
                      )}
                      {c?.notes && (
                        <p className="flex items-start gap-2 text-slate-600">
                          <NotebookText className="mt-0.5 size-4 shrink-0 text-slate-400" /> {c.notes}
                        </p>
                      )}
                      {a.internalNotes && (
                        <p className="flex items-start gap-2 text-slate-600">
                          <NotebookText className="mt-0.5 size-4 shrink-0 text-slate-400" /> {a.internalNotes}
                        </p>
                      )}
                    </div>
                    {a.status !== 'completed' && date === today && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {a.status !== 'arrived' ? (
                          <Button size="sm" icon={Clock} onClick={() => { setStatus(a.id, 'arrived'); toast('Visit started'); }}>
                            Start visit
                          </Button>
                        ) : (
                          <Button size="sm" variant="primary" icon={CheckCircle2} onClick={() => openAppt(a.id)}>
                            Complete & invoice
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openAppt(a.id)}>
                          Details
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <RunningLateModal open={late} onClose={() => setLate(false)} route={route} />
    </div>
  );
}
