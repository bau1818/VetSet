import clsx from 'clsx';
import {
  ArrowLeft,
  CalendarPlus,
  CircleDollarSign,
  Flower2,
  KeyRound,
  ListTodo,
  Mail,
  MapPin,
  MessageSquareText,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClientFormModal, PetFormModal } from '../components/ClientForms';
import { RouteMap } from '../components/RouteMap';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, LinkButton, Modal, Select, SpeciesIcon, StatusBadge, Tabs, Textarea } from '../components/ui';
import { addTask, logCommunication, markPetDeceased, recordPayment, toggleTask } from '../data/actions';
import { byId, clientName, clientStats, invoiceBalance, petNames, serviceNames } from '../data/selectors';
import { useData } from '../data/store';
import type { Channel, Invoice, Pet } from '../data/types';
import { compose, toast, useUi } from '../data/ui';
import { fmtAddress, hasGeo } from '../lib/geo';
import { money, phoneHref } from '../lib/format';
import { ageFromDob, fmtDate, fmtWindow, relDay, shiftDate, todayStr } from '../lib/time';

type Tab = 'overview' | 'visits' | 'messages' | 'billing';

export function ClientDetail() {
  const { id } = useParams();
  const s = useData();
  const openAppt = useUi((u) => u.openAppointment);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [petModal, setPetModal] = useState<{ pet?: Pet } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [memorial, setMemorial] = useState<Pet | null>(null);
  const today = todayStr();

  const c = byId(s.clients, id);
  if (!c) return <EmptyState title="Client not found" action={<LinkButton to="/clients">Back to clients</LinkButton>} />;

  const st = clientStats(s, c.id, today);
  const pets = s.pets.filter((p) => p.clientId === c.id);
  const appts = s.appointments.filter((a) => a.clientId === c.id).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const upcoming = appts.filter((a) => a.date >= today && !['cancelled', 'no_show', 'completed'].includes(a.status)).reverse();
  const comms = s.communications.filter((x) => x.clientId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const invoices = s.invoices.filter((i) => i.clientId === c.id).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  const reminders = s.reminders.filter((r) => r.clientId === c.id && r.status !== 'dismissed').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const tasks = s.tasks.filter((t) => t.clientId === c.id);
  const geo = hasGeo(c.address) ? c.address : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Clients
      </Link>

      <Card className="mb-5">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{clientName(c)}</h1>
              {c.status === 'lead' && <Badge tone="violet">Lead</Badge>}
              {c.status === 'inactive' && <Badge>Inactive</Badge>}
              {c.tags.map((t) => (
                <Badge key={t} tone={t === 'VIP' ? 'amber' : 'gray'}>
                  {t}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Client since {fmtDate(c.createdAt.slice(0, 10), 'MMM yyyy')} · {c.referralSource || 'Unknown source'} · prefers {c.preferredContact === 'sms' ? 'text' : c.preferredContact}
              {c.preferredTime !== 'any' ? `, ${c.preferredTime === 'am' ? 'mornings' : 'afternoons'}` : ''}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-start gap-2 text-slate-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {fmtAddress(c.address, true)}
                {!geo && <Badge tone="amber">Not located</Badge>}
              </p>
              <p className="flex items-center gap-2 text-slate-700">
                <Phone className="size-4 text-slate-400" /> {c.phone}
                <span className="text-slate-300">·</span>
                <Mail className="size-4 text-slate-400" /> {c.email || '—'}
              </p>
              {c.accessNotes && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  <KeyRound className="mt-0.5 size-4 shrink-0" /> {c.accessNotes}
                </p>
              )}
              {c.notes && <p className="text-slate-600">{c.notes}</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton to={`/book?clientId=${c.id}`} variant="primary" icon={CalendarPlus}>
                Book visit
              </LinkButton>
              <LinkButton href={phoneHref(c.phone)} icon={Phone}>
                Call
              </LinkButton>
              <Button icon={MessageSquareText} onClick={() => compose({ clientId: c.id, templateKey: 'recall' })}>
                Message
              </Button>
              <Button variant="ghost" icon={NotebookPen} onClick={() => setNoteOpen(true)}>
                Log note
              </Button>
              <Button variant="ghost" icon={ListTodo} onClick={() => setTaskOpen(true)}>
                Add task
              </Button>
              <Button variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            {geo && <RouteMap routes={[]} highlight={{ point: geo, title: c.lastName }} className="h-40" />}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Visits</p>
                <p className="font-semibold text-slate-900">{st.visits}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Lifetime</p>
                <p className="font-semibold text-slate-900">{money(st.lifetimeValue)}</p>
              </div>
              <div className={clsx('rounded-lg p-2', st.balance > 0 ? 'bg-red-50' : 'bg-slate-50')}>
                <p className="text-[11px] text-slate-500">Balance</p>
                <p className={clsx('font-semibold', st.balance > 0 ? 'text-red-700' : 'text-slate-900')}>{money(st.balance)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'visits', label: 'Visits', count: appts.length },
              { value: 'messages', label: 'Messages & notes', count: comms.length },
              { value: 'billing', label: 'Billing', count: invoices.length },
            ]}
          />
        </div>
      </Card>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <Card>
              <CardHeader title="Pets" actions={<Button size="xs" icon={Plus} onClick={() => setPetModal({})}>Add pet</Button>} />
              <ul className="grid gap-3 p-4 sm:grid-cols-2">
                {pets.map((p) => (
                  <li key={p.id} className={clsx('rounded-xl border p-3', p.status === 'deceased' ? 'border-slate-200 bg-slate-50' : 'border-slate-200')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600">
                          {p.status === 'deceased' ? <Flower2 className="size-4" /> : <SpeciesIcon species={p.species} />}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">
                            {p.name} {p.status === 'deceased' && <span className="text-xs font-normal text-slate-500">· In memory</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.breed} · {p.sex} · {ageFromDob(p.dob)}
                            {p.weightLbs ? ` · ${p.weightLbs} lb` : ''}
                          </p>
                        </div>
                      </div>
                      <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setPetModal({ pet: p })} aria-label={`Edit ${p.name}`}>
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                    {p.alerts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.alerts.map((a) => (
                          <Badge key={a} tone="red" icon={TriangleAlert}>
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {p.notes && <p className="mt-2 text-xs text-slate-500">{p.notes}</p>}
                    {p.status === 'active' && (
                      <button className="mt-2 text-xs text-slate-400 hover:text-slate-600" onClick={() => setMemorial(p)}>
                        Mark as passed away…
                      </button>
                    )}
                  </li>
                ))}
                {!pets.length && <p className="text-sm text-slate-500">No pets yet.</p>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Upcoming visits" />
              {upcoming.length ? (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => openAppt(a.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
                        <span>
                          <span className="block font-medium text-slate-800">
                            {relDay(a.date, today)} · {fmtWindow(a.windowStart, a.windowEnd)}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {petNames(s, a.petIds)} · {serviceNames(s, a.serviceIds)} · {byId(s.teams, a.teamId)?.name}
                          </span>
                        </span>
                        <StatusBadge status={a.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CalendarPlus} title="Nothing booked" action={<LinkButton to={`/book?clientId=${c.id}`} variant="primary" size="sm">Find a slot</LinkButton>} />
              )}
            </Card>
          </div>
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHeader title="Care reminders" subtitle="Services each pet is due for" />
              {reminders.length ? (
                <ul className="divide-y divide-slate-100">
                  {reminders.map((r) => {
                    const overdue = r.dueDate < today && r.status !== 'booked';
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                        <span>
                          <span className="block text-slate-800">
                            {byId(s.pets, r.petId)?.name}: {byId(s.services, r.serviceId)?.name}
                          </span>
                          <span className={clsx('block text-xs', overdue ? 'text-red-600' : 'text-slate-500')}>
                            {overdue ? 'Overdue since' : 'Due'} {fmtDate(r.dueDate, 'MMM d, yyyy')}
                          </span>
                        </span>
                        {r.status === 'booked' ? <Badge tone="brand">Booked</Badge> : <LinkButton size="xs" to={`/book?reminder=${r.id}`}>Book</LinkButton>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-slate-500">No reminders on file.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Tasks" actions={<Button size="xs" variant="ghost" icon={Plus} onClick={() => setTaskOpen(true)}>Add</Button>} />
              {tasks.length ? (
                <ul className="divide-y divide-slate-100">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2.5 px-5 py-2.5 text-sm">
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="mt-0.5 size-4 accent-brand-700" />
                      <span className={clsx(t.done && 'text-slate-400 line-through')}>
                        {t.title}
                        <span className="block text-xs text-slate-500">{relDay(t.dueDate, today)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-slate-500">No open tasks.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <Card>
          {appts.length ? (
            <ul className="divide-y divide-slate-100">
              {appts.map((a) => (
                <li key={a.id}>
                  <button onClick={() => openAppt(a.id)} className="grid w-full grid-cols-[7rem_1fr_auto] items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                    <span className="text-sm text-slate-700">{fmtDate(a.date, 'MMM d, yyyy')}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{serviceNames(s, a.serviceIds)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {petNames(s, a.petIds)} · {byId(s.staff, byId(s.teams, a.teamId)?.doctorId)?.name}
                        {a.reason ? ` · ${a.reason}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No visits yet" />
          )}
        </Card>
      )}

      {tab === 'messages' && (
        <Card>
          <CardHeader title="Communication log" actions={<Button size="xs" icon={NotebookPen} onClick={() => setNoteOpen(true)}>Log note / call</Button>} />
          {comms.length ? (
            <ol className="space-y-4 p-5">
              {comms.map((m) => (
                <li key={m.id} className="flex gap-3">
                  <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full', m.direction === 'in' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500')}>
                    {m.channel === 'sms' ? <MessageSquareText className="size-4" /> : m.channel === 'email' ? <Mail className="size-4" /> : m.channel === 'call' ? <Phone className="size-4" /> : <NotebookPen className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {m.subject} <span className="font-normal text-slate-400">· {m.direction === 'in' ? 'from client' : m.by}</span>
                    </p>
                    <p className="text-sm whitespace-pre-line text-slate-600">{m.body}</p>
                    <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No messages yet" />
          )}
        </Card>
      )}

      {tab === 'billing' && (
        <Card>
          {invoices.length ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2">Invoice</th>
                  <th className="px-5 py-2">Issued</th>
                  <th className="px-5 py-2 text-right">Total</th>
                  <th className="px-5 py-2 text-right">Balance</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{i.number}</td>
                    <td className="px-5 py-2.5 text-slate-600">{fmtDate(i.issuedAt, 'MMM d, yyyy')}</td>
                    <td className="tabular px-5 py-2.5 text-right text-slate-700">{money(i.total, true)}</td>
                    <td className="tabular px-5 py-2.5 text-right">
                      {invoiceBalance(i) > 0 ? <Badge tone={i.status === 'overdue' ? 'red' : 'amber'}>{money(invoiceBalance(i), true)}</Badge> : <Badge tone="green">Paid</Badge>}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {invoiceBalance(i) > 0 && (
                        <Button size="xs" icon={CircleDollarSign} onClick={() => setPayInvoice(i)}>
                          Record payment
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No invoices" />
          )}
        </Card>
      )}

      <ClientFormModal open={editing} onClose={() => setEditing(false)} client={c} />
      <PetFormModal open={!!petModal} onClose={() => setPetModal(null)} pet={petModal?.pet} clientId={c.id} />
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} clientId={c.id} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} clientId={c.id} />
      <PaymentModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
      <Modal
        open={!!memorial}
        onClose={() => setMemorial(null)}
        title={`Remember ${memorial?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMemorial(null)}>Cancel</Button>
            <Button
              variant="dark"
              onClick={() => {
                if (memorial) {
                  markPetDeceased(memorial.id);
                  toast(`${memorial.name}'s record updated. Reminders stopped.`, 'info');
                }
                setMemorial(null);
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This stops all care reminders and messages about {memorial?.name}. The record and visit history are kept. Consider adding a task to send the family a sympathy card.
        </p>
      </Modal>
    </div>
  );
}

function NoteModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  const [channel, setChannel] = useState<Channel>('call');
  const [body, setBody] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a call or note"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!body.trim()}
            onClick={() => {
              logCommunication({ clientId, channel, direction: channel === 'call' ? 'in' : 'out', subject: channel === 'call' ? 'Phone call' : 'Note', body: body.trim() });
              setBody('');
              toast('Logged');
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Type">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="call">Phone call</option>
            <option value="note">Internal note</option>
            <option value="sms">Text (sent outside VetSet)</option>
            <option value="email">Email (sent outside VetSet)</option>
          </Select>
        </Field>
        <Field label="Details">
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

function TaskModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId?: string }) {
  const s = useData();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(shiftDate(todayStr(), 1));
  const [assigneeId, setAssigneeId] = useState(s.staff.find((x) => x.role === 'office')?.id ?? '');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!title.trim()}
            onClick={() => {
              addTask({ title: title.trim(), clientId, dueDate, assigneeId, kind: 'followup' });
              setTitle('');
              toast('Task added');
              onClose();
            }}
          >
            Add task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Task">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call back about adding a second cat" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Assign to">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {s.staff.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function PaymentModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Invoice['method']>('card');
  const bal = invoice ? invoiceBalance(invoice) : 0;
  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      title={`Record payment · ${invoice?.number}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!invoice) return;
              const amt = Number(amount || bal);
              recordPayment(invoice.id, amt, method);
              toast(`Payment of ${money(amt, true)} recorded`);
              setAmount('');
              onClose();
            }}
          >
            Record {money(Number(amount || bal), true)}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" hint={`Balance ${money(bal, true)}`}>
          <Input type="number" min={0} step="0.01" value={amount} placeholder={bal.toFixed(2)} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as Invoice['method'])}>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="transfer">Bank transfer</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
