import clsx from 'clsx';
import { Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClientFormModal } from '../components/ClientForms';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, SpeciesIcon } from '../components/ui';
import { clientName, clientStats, petsOf } from '../data/selectors';
import { useData } from '../data/store';
import { money } from '../lib/format';
import { fmtDate, relDay, shiftDate, todayStr } from '../lib/time';

type Filter = 'all' | 'active' | 'lead' | 'inactive' | 'balance' | 'recall' | 'lapsed';

export function Clients() {
  const s = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) ?? 'all';
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<'name' | 'last' | 'next' | 'ltv' | 'balance'>('name');
  const [adding, setAdding] = useState(false);
  const today = todayStr();

  const rows = useMemo(() => {
    const recallClients = new Set(s.reminders.filter((r) => ['due', 'contacted'].includes(r.status) && r.dueDate <= shiftDate(today, 30)).map((r) => r.clientId));
    const t = q.trim().toLowerCase();
    return s.clients
      .map((c) => ({ c, st: clientStats(s, c.id, today), pets: petsOf(s, c.id) }))
      .filter(({ c, st }) => {
        switch (filter) {
          case 'active':
          case 'lead':
          case 'inactive':
            return c.status === filter;
          case 'balance':
            return st.balance > 0;
          case 'recall':
            return recallClients.has(c.id);
          case 'lapsed':
            return c.status === 'active' && !st.nextAppt && (!st.lastVisit || st.lastVisit < shiftDate(today, -30));
          default:
            return true;
        }
      })
      .filter(({ c }) => !city || c.address.city === city)
      .filter(({ c, pets }) => !t || clientName(c).toLowerCase().includes(t) || c.phone.replace(/\D/g, '').includes(t.replace(/\D/g, '') || '~') || c.email.toLowerCase().includes(t) || pets.some((p) => p.name.toLowerCase().includes(t)) || c.tags.some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => {
        switch (sort) {
          case 'last':
            return (b.st.lastVisit ?? '').localeCompare(a.st.lastVisit ?? '');
          case 'next':
            return (a.st.nextAppt?.date ?? '9999').localeCompare(b.st.nextAppt?.date ?? '9999');
          case 'ltv':
            return b.st.lifetimeValue - a.st.lifetimeValue;
          case 'balance':
            return b.st.balance - a.st.balance;
          default:
            return a.c.lastName.localeCompare(b.c.lastName);
        }
      });
  }, [s, filter, q, city, sort, today]);

  const cities = [...new Set(s.clients.map((c) => c.address.city))].sort();
  const counts = {
    all: s.clients.length,
    active: s.clients.filter((c) => c.status === 'active').length,
    lead: s.clients.filter((c) => c.status === 'lead').length,
    inactive: s.clients.filter((c) => c.status === 'inactive').length,
  };
  const setFilter = (f: Filter) => {
    const p = new URLSearchParams(params);
    p.set('filter', f);
    setParams(p, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clients & pets"
        subtitle={`${counts.active} active households · ${s.pets.filter((p) => p.status === 'active').length} pets · ${counts.lead} new leads`}
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add client
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, pet, phone, email or tag" className="!h-9 pl-9" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(
              [
                ['all', `All ${counts.all}`],
                ['active', 'Active'],
                ['lead', `Leads ${counts.lead}`],
                ['recall', 'Recall due'],
                ['balance', 'Balance due'],
                ['lapsed', 'No upcoming visit'],
                ['inactive', 'Inactive'],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={city} onChange={(e) => setCity(e.target.value)} className="!h-9 !w-auto text-xs">
              <option value="">All areas</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="!h-9 !w-auto text-xs">
              <option value="name">Sort: name</option>
              <option value="last">Sort: last visit</option>
              <option value="next">Sort: next visit</option>
              <option value="ltv">Sort: lifetime value</option>
              <option value="balance">Sort: balance</option>
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No clients match" body="Try another filter or search term." />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Pets</th>
                  <th className="px-4 py-2">Area</th>
                  <th className="px-4 py-2">Last visit</th>
                  <th className="px-4 py-2">Next visit</th>
                  <th className="px-4 py-2 text-right">Lifetime</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, st, pets }) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        {clientName(c)}
                        {c.status === 'lead' && <Badge tone="violet">Lead</Badge>}
                        {c.status === 'inactive' && <Badge>Inactive</Badge>}
                        {c.tags.filter((t) => t !== 'New lead').slice(0, 2).map((t) => (
                          <Badge key={t} tone={t === 'VIP' ? 'amber' : 'gray'}>
                            {t}
                          </Badge>
                        ))}
                      </p>
                      <p className="text-xs text-slate-500">{c.phone}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-600">
                        {pets.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1">
                            <SpeciesIcon species={p.species} className="size-3.5 text-slate-400" /> {p.name}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.address.city}</td>
                    <td className="px-4 py-2.5 text-slate-600">{st.lastVisit ? fmtDate(st.lastVisit, 'MMM d') : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{st.nextAppt ? relDay(st.nextAppt.date, today) : <span className="text-slate-400">None</span>}</td>
                    <td className="tabular px-4 py-2.5 text-right text-slate-600">{money(st.lifetimeValue)}</td>
                    <td className={clsx('tabular px-4 py-2.5 text-right', st.balance > 0 ? (st.overdue ? 'font-medium text-red-600' : 'text-amber-700') : 'text-slate-400')}>
                      {st.balance > 0 ? money(st.balance) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map(({ c, st, pets }) => (
                <li key={c.id}>
                  <button className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left" onClick={() => navigate(`/clients/${c.id}`)}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900">
                        {clientName(c)} {c.status === 'lead' && <Badge tone="violet">Lead</Badge>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {pets.map((p) => p.name).join(', ')} · {c.address.city}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      {st.nextAppt ? relDay(st.nextAppt.date, today) : 'No visit'}
                      {st.balance > 0 && <span className="block font-medium text-red-600">{money(st.balance)} due</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <ClientFormModal open={adding} onClose={() => setAdding(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </div>
  );
}
