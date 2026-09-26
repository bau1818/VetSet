import clsx from 'clsx';
import { CalendarPlus, CheckCircle2, Hourglass, Mail, MessageSquareText, NotebookPen, Phone, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Chip, EmptyState, Field, Input, LinkButton, Modal, PageHeader, Segmented, Select, SpeciesIcon, Tabs, Textarea } from '../components/ui';
import { setStatus } from '../data/actions';
import { byId, clientName, petNames, petsOf } from '../data/selectors';
import { patch, upsert, useData } from '../data/store';
import type { DayPart, MessageTemplate, WaitlistEntry } from '../data/types';
import { compose, toast } from '../data/ui';
import { uid } from '../lib/id';
import { fillTemplate, MERGE_FIELDS, sampleVars } from '../lib/templates';
import { fmtDate, fmtWindow, relDay, shiftDate, todayStr } from '../lib/time';

type Tab = 'confirm' | 'recalls' | 'waitlist' | 'log' | 'templates';

export function Messages() {
  const s = useData();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'confirm';
  const today = todayStr();
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  const unconfirmed = s.appointments.filter((a) => a.status === 'scheduled' && a.date >= today && a.date <= shiftDate(today, 3)).sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence);
  const recalls = s.reminders.filter((r) => ['due', 'contacted'].includes(r.status) && r.dueDate <= shiftDate(today, 60));
  const waiting = s.waitlist.filter((w) => w.status === 'waiting');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reminders & messages" subtitle="Confirmations, care recalls, the waitlist and every message sent — in one place." />
      <Card>
        <div className="px-4">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'confirm', label: 'Confirmations', count: unconfirmed.length },
              { value: 'recalls', label: 'Care recalls', count: recalls.length },
              { value: 'waitlist', label: 'Waitlist', count: waiting.length },
              { value: 'log', label: 'Message log' },
              { value: 'templates', label: 'Templates' },
            ]}
          />
        </div>
        {tab === 'confirm' && <Confirmations list={unconfirmed} />}
        {tab === 'recalls' && <Recalls />}
        {tab === 'waitlist' && <Waitlist />}
        {tab === 'log' && <Log />}
        {tab === 'templates' && <Templates />}
      </Card>
    </div>
  );
}

function Confirmations({ list }: { list: ReturnType<typeof useData.getState>['appointments'] }) {
  const s = useData();
  const today = todayStr();
  const lastSent = (id: string) => s.communications.filter((c) => c.appointmentId === id && c.direction === 'out' && c.channel !== 'note').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!list.length) return <EmptyState icon={CheckCircle2} title="Everyone’s confirmed" body="All visits in the next 3 days have been confirmed." />;
  return (
    <>
      <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">Visits in the next 3 days that the client hasn’t confirmed yet. Send the confirmation text, then mark confirmed when they reply.</p>
      <ul className="divide-y divide-slate-100">
        {list.map((a) => {
          const c = byId(s.clients, a.clientId);
          const sent = lastSent(a.id);
          return (
            <li key={a.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {clientName(c)} <span className="font-normal text-slate-500">· {petNames(s, a.petIds)}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {relDay(a.date, today)} · {fmtWindow(a.windowStart, a.windowEnd)} · {byId(s.teams, a.teamId)?.name} · prefers {c?.preferredContact === 'sms' ? 'text' : c?.preferredContact}
                  {sent && <span className="text-slate-400"> · last message {new Date(sent.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" icon={Send} onClick={() => compose({ clientId: a.clientId, appointmentId: a.id, templateKey: a.date === shiftDate(today, 1) ? 'reminder' : 'confirm' })}>
                  Send
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  icon={CheckCircle2}
                  onClick={() => {
                    setStatus(a.id, 'confirmed');
                    toast(`${c?.firstName} confirmed`);
                  }}
                >
                  Confirmed
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Recalls() {
  const s = useData();
  const today = todayStr();
  const [range, setRange] = useState<'overdue' | '30' | '60'>('30');
  const list = useMemo(() => {
    const end = range === 'overdue' ? shiftDate(today, -1) : shiftDate(today, Number(range));
    return s.reminders
      .filter((r) => ['due', 'contacted'].includes(r.status) && r.dueDate <= end)
      .filter((r) => byId(s.pets, r.petId)?.status === 'active')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [s.reminders, s.pets, range, today]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-500">Pets due for recurring care. Booking from here fits them onto a route that’s already nearby.</p>
        <Segmented value={range} onChange={setRange} size="sm" options={[{ value: 'overdue', label: 'Overdue' }, { value: '30', label: 'Next 30 days' }, { value: '60', label: 'Next 60 days' }]} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Sparkles} title="No recalls in this range" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((r) => {
            const pet = byId(s.pets, r.petId);
            const c = byId(s.clients, r.clientId);
            const svc = byId(s.services, r.serviceId);
            const overdue = r.dueDate < today;
            return (
              <li key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">{pet && <SpeciesIcon species={pet.species} />}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {pet?.name} <span className="font-normal text-slate-500">· {clientName(c)} · {c?.address.city}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {svc?.name} · <span className={clsx(overdue && 'font-medium text-red-600')}>{overdue ? 'overdue since' : 'due'} {fmtDate(r.dueDate, 'MMM d')}</span>
                      {r.status === 'contacted' && ` · contacted ${r.contactCount}×`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    icon={MessageSquareText}
                    onClick={() =>
                      compose({
                        clientId: r.clientId,
                        petIds: [r.petId],
                        templateKey: 'recall',
                        extra: { service: svc?.name.toLowerCase() ?? 'a visit', due_date: fmtDate(r.dueDate, 'MMM d') },
                        onSent: () => patch('reminders', r.id, { status: 'contacted', contactCount: r.contactCount + 1, lastContactAt: new Date().toISOString() }),
                      })
                    }
                  >
                    Remind
                  </Button>
                  <LinkButton size="sm" variant="primary" to={`/book?reminder=${r.id}`} icon={CalendarPlus}>
                    Book
                  </LinkButton>
                  <Button size="sm" variant="ghost" onClick={() => patch('reminders', r.id, { status: 'dismissed' })}>
                    Dismiss
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Waitlist() {
  const s = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const list = s.waitlist.filter((w) => w.status === 'waiting').sort((a, b) => ({ urgent: 0, soon: 1, routine: 2 })[a.urgency] - ({ urgent: 0, soon: 1, routine: 2 })[b.urgency]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-500">Clients who want an earlier slot. When a visit cancels, VetSet suggests the waitlisted clients closest to the gap.</p>
        <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
          Add to waitlist
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Hourglass} title="Waitlist is empty" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((w) => {
            const c = byId(s.clients, w.clientId);
            return (
              <li key={w.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    {clientName(c)}
                    <Badge tone={w.urgency === 'urgent' ? 'red' : w.urgency === 'soon' ? 'amber' : 'gray'}>{w.urgency === 'urgent' ? 'ASAP' : w.urgency === 'soon' ? 'This week' : 'Routine'}</Badge>
                    {w.preferredTime !== 'any' && <Badge>{w.preferredTime === 'am' ? 'Mornings' : 'Afternoons'}</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {petNames(s, w.petIds)} · {w.serviceIds.map((x) => byId(s.services, x)?.name).join(', ')} · {c?.address.city}
                    {w.latest && ` · needed by ${fmtDate(w.latest, 'MMM d')}`}
                  </p>
                  {w.notes && <p className="mt-0.5 text-xs text-slate-600">“{w.notes}”</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => navigate(`/book?waitlist=${w.id}`)}>
                    Find slot
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => patch('waitlist', w.id, { status: 'removed' })} aria-label="Remove" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AddWaitlistModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddWaitlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useData();
  const [clientId, setClientId] = useState('');
  const [petIds, setPetIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<WaitlistEntry['urgency']>('soon');
  const [preferredTime, setPreferredTime] = useState<DayPart>('any');
  const [notes, setNotes] = useState('');
  const pets = clientId ? petsOf(s, clientId) : [];
  const toggle = (l: string[], v: string) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to waitlist"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!clientId || !petIds.length || !serviceIds.length}
            onClick={() => {
              upsert('waitlist', { id: uid('wl'), clientId, petIds, serviceIds, urgency, preferredTime, notes, earliest: todayStr(), status: 'waiting', createdAt: new Date().toISOString() });
              toast('Added to waitlist');
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Client">
          <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPetIds([]); }}>
            <option value="">Choose a client…</option>
            {[...s.clients].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.lastName}, {c.firstName}
              </option>
            ))}
          </Select>
        </Field>
        {pets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pets.map((p) => (
              <Chip key={p.id} selected={petIds.includes(p.id)} onClick={() => setPetIds(toggle(petIds, p.id))}>
                {p.name}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {s.services.filter((x) => x.active).map((sv) => (
            <Chip key={sv.id} selected={serviceIds.includes(sv.id)} onClick={() => setServiceIds(toggle(serviceIds, sv.id))} className="!py-1 !text-xs">
              {sv.name}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urgency">
            <Select value={urgency} onChange={(e) => setUrgency(e.target.value as WaitlistEntry['urgency'])}>
              <option value="urgent">ASAP</option>
              <option value="soon">This week</option>
              <option value="routine">Routine</option>
            </Select>
          </Field>
          <Field label="Time of day">
            <Select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value as DayPart)}>
              <option value="any">Any</option>
              <option value="am">Mornings</option>
              <option value="pm">Afternoons</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Log() {
  const s = useData();
  const [channel, setChannel] = useState<'all' | 'sms' | 'email' | 'call' | 'note'>('all');
  const list = s.communications
    .filter((c) => channel === 'all' || c.channel === channel)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 120);
  const Icon = { sms: MessageSquareText, email: Mail, call: Phone, note: NotebookPen };
  return (
    <>
      <div className="border-b border-slate-100 px-5 py-3">
        <Segmented value={channel} onChange={setChannel} size="sm" options={[{ value: 'all', label: 'All' }, { value: 'sms', label: 'Texts' }, { value: 'email', label: 'Email' }, { value: 'call', label: 'Calls' }, { value: 'note', label: 'Notes' }]} />
      </div>
      <ul className="divide-y divide-slate-100">
        {list.map((m) => {
          const I = Icon[m.channel];
          return (
            <li key={m.id} className="flex gap-3 px-5 py-3">
              <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full', m.direction === 'in' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500')}>
                <I className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium text-slate-800">{clientName(byId(s.clients, m.clientId))}</span> <span className="text-slate-500">· {m.subject}</span>
                </p>
                <p className="truncate text-sm text-slate-600">{m.body}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Templates() {
  const s = useData();
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  return (
    <>
      <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
        Merge fields like <code className="rounded bg-slate-100 px-1">{'{client_first}'}</code> fill in automatically when a message is composed.
      </p>
      <ul className="divide-y divide-slate-100">
        {s.templates.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                {t.name} <Badge>{t.channel === 'sms' ? 'Text' : 'Email'}</Badge>
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{fillTemplate(t.body, sampleVars)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      {editing && <TemplateEditor tpl={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateEditor({ tpl, onClose }: { tpl: MessageTemplate; onClose: () => void }) {
  const [body, setBody] = useState(tpl.body);
  const [name, setName] = useState(tpl.name);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Edit template`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              upsert('templates', { ...tpl, name, body });
              toast('Template saved');
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Message">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1">
          {MERGE_FIELDS.map((f) => (
            <button key={f.key} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200" onClick={() => setBody((b) => `${b}{${f.key}}`)} title={f.label}>
              {`{${f.key}}`}
            </button>
          ))}
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Preview</p>
          <p className="text-sm whitespace-pre-line text-slate-700">{fillTemplate(body, sampleVars)}</p>
        </div>
      </div>
    </Modal>
  );
}
