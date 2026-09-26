import clsx from 'clsx';
import { CircleDollarSign, Clock3, FileText, Search, Send, TriangleAlert, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Segmented, Stat } from '../components/ui';
import { byId, clientName, invoiceBalance } from '../data/selectors';
import { useData } from '../data/store';
import type { Invoice } from '../data/types';
import { compose } from '../data/ui';
import { money } from '../lib/format';
import { daysBetween, fmtDate, todayStr } from '../lib/time';
import { PaymentModal } from './ClientDetail';

type Filter = 'unpaid' | 'overdue' | 'paid' | 'all';

export function Billing() {
  const s = useData();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) ?? 'unpaid';
  const [q, setQ] = useState('');
  const [pay, setPay] = useState<Invoice | null>(null);
  const [view, setView] = useState<Invoice | null>(null);
  const today = todayStr();
  const month = today.slice(0, 7);

  const stats = useMemo(() => {
    const collected = s.invoices.filter((i) => i.paidAt?.startsWith(month)).reduce((t, i) => t + i.amountPaid, 0);
    const open = s.invoices.filter((i) => invoiceBalance(i) > 0);
    const overdue = open.filter((i) => i.status === 'overdue');
    const billed = s.invoices.filter((i) => i.issuedAt.startsWith(month));
    return {
      collected,
      outstanding: open.reduce((t, i) => t + invoiceBalance(i), 0),
      openCount: open.length,
      overdue: overdue.reduce((t, i) => t + invoiceBalance(i), 0),
      overdueCount: overdue.length,
      avg: billed.length ? billed.reduce((t, i) => t + i.total, 0) / billed.length : 0,
      billedCount: billed.length,
    };
  }, [s.invoices, month]);

  const rows = s.invoices
    .filter((i) => (filter === 'unpaid' ? invoiceBalance(i) > 0 : filter === 'overdue' ? i.status === 'overdue' : filter === 'paid' ? i.status === 'paid' : true))
    .filter((i) => !q || clientName(byId(s.clients, i.clientId)).toLowerCase().includes(q.toLowerCase()) || i.number.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Billing" subtitle="Invoices are created automatically when a visit is completed, including the house-call trip fee." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label={`Collected in ${fmtDate(`${month}-01`, 'MMMM')}`} value={money(stats.collected)} />
        <Stat icon={CircleDollarSign} label="Outstanding" value={money(stats.outstanding)} sub={`${stats.openCount} open invoices`} tone="amber" onClick={() => setParams({ filter: 'unpaid' })} />
        <Stat icon={TriangleAlert} label="Overdue" value={money(stats.overdue)} sub={`${stats.overdueCount} invoices`} tone="red" onClick={() => setParams({ filter: 'overdue' })} />
        <Stat icon={Clock3} label="Average invoice" value={money(stats.avg)} sub={`${stats.billedCount} this month`} tone="slate" />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or invoice #" className="!h-9 pl-9" />
          </div>
          <Segmented value={filter} onChange={(f) => setParams({ filter: f }, { replace: true })} size="sm" options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'overdue', label: 'Overdue' }, { value: 'paid', label: 'Paid' }, { value: 'all', label: 'All' }]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Issued</th>
                  <th className="hidden px-4 py-2 md:table-cell">Due</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((i) => {
                  const bal = invoiceBalance(i);
                  const late = i.status === 'overdue' ? daysBetween(i.dueAt, today) : 0;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button className="font-medium text-slate-900 hover:text-brand-700" onClick={() => setView(i)}>
                          {i.number}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link to={`/clients/${i.clientId}`} className="text-slate-700 hover:text-brand-700">
                          {clientName(byId(s.clients, i.clientId))}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{fmtDate(i.issuedAt, 'MMM d')}</td>
                      <td className={clsx('hidden px-4 py-2.5 md:table-cell', late ? 'text-red-600' : 'text-slate-600')}>
                        {fmtDate(i.dueAt, 'MMM d')}
                        {late > 0 && ` · ${late}d late`}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-slate-700">{money(i.total, true)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {bal > 0 ? <Badge tone={i.status === 'overdue' ? 'red' : 'amber'}>{money(bal, true)}</Badge> : <Badge tone="green">Paid · {i.method}</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {bal > 0 && (
                          <span className="inline-flex gap-1.5">
                            <Button size="xs" variant="ghost" icon={Send} onClick={() => compose({ clientId: i.clientId, appointmentId: i.appointmentId, templateKey: 'follow_up' })}>
                              Remind
                            </Button>
                            <Button size="xs" icon={CircleDollarSign} onClick={() => setPay(i)}>
                              Payment
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <PaymentModal invoice={pay} onClose={() => setPay(null)} />
      {view && <InvoiceModal invoice={view} onClose={() => setView(null)} />}
    </div>
  );
}

function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const s = useData();
  const c = byId(s.clients, invoice.clientId);
  return (
    <Modal open onClose={onClose} title={invoice.number} footer={<Button onClick={() => window.print()}>Print</Button>}>
      <div className="space-y-4 text-sm">
        <div className="flex justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">{s.settings.businessName}</p>
            <p className="text-slate-500">{s.settings.phone}</p>
            <p className="text-slate-500">{s.settings.email}</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-slate-900">{clientName(c)}</p>
            <p className="text-slate-500">{c?.address.line1}</p>
            <p className="text-slate-500">
              {c?.address.city}, {c?.address.state} {c?.address.zip}
            </p>
          </div>
        </div>
        <p className="text-slate-500">
          Issued {fmtDate(invoice.issuedAt, 'MMM d, yyyy')} · Due {fmtDate(invoice.dueAt, 'MMM d, yyyy')}
        </p>
        <table className="w-full">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">Item</th>
              <th className="py-1.5 text-right">Qty</th>
              <th className="py-1.5 text-right">Price</th>
              <th className="py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-1.5 text-slate-700">{l.description}</td>
                <td className="tabular py-1.5 text-right text-slate-600">{l.qty}</td>
                <td className="tabular py-1.5 text-right text-slate-600">{money(l.unitPrice, true)}</td>
                <td className="tabular py-1.5 text-right text-slate-800">{money(l.qty * l.unitPrice, true)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 font-medium">
            <tr>
              <td colSpan={3} className="py-1.5 text-right text-slate-600">Total</td>
              <td className="tabular py-1.5 text-right text-slate-900">{money(invoice.total, true)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-1.5 text-right text-slate-600">Paid</td>
              <td className="tabular py-1.5 text-right text-slate-900">{money(invoice.amountPaid, true)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-1.5 text-right text-slate-900">Balance due</td>
              <td className="tabular py-1.5 text-right text-slate-900">{money(invoiceBalance(invoice), true)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
