import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { Car, CircleDollarSign, Gauge, PawPrint, UserPlus, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarList, ColumnChart, SERIES, StackedBars } from '../components/charts';
import { Card, CardHeader, PageHeader, Segmented, Stat } from '../components/ui';
import { CATEGORY_META } from '../components/ui';
import { buildDayRoute } from '../data/planning';
import { byId } from '../data/selectors';
import { useData } from '../data/store';
import { money, miles as fmtMiles } from '../lib/format';
import { fmtDuration, shiftDate, todayStr } from '../lib/time';

export function Reports() {
  const s = useData();
  const [range, setRange] = useState<'30' | '45'>('30');
  const today = todayStr();
  const from = shiftDate(today, -Number(range));

  const data = useMemo(() => {
    const appts = s.appointments.filter((a) => a.date >= from && a.date < today);
    const completed = appts.filter((a) => a.status === 'completed');
    const noShows = appts.filter((a) => a.status === 'no_show').length;
    const invoices = s.invoices.filter((i) => i.issuedAt >= from && i.issuedAt < today && i.status !== 'void');
    const revenue = invoices.reduce((t, i) => t + i.total, 0);

    // Revenue by week
    const weeks = new Map<string, { value: number; visits: number }>();
    invoices.forEach((i) => {
      const w = format(startOfWeek(parseISO(i.issuedAt), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const cur = weeks.get(w) ?? { value: 0, visits: 0 };
      weeks.set(w, { value: cur.value + i.total, visits: cur.visits + 1 });
    });
    const byWeek = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([w, v]) => ({ label: format(parseISO(w), 'MMM d'), value: Math.round(v.value), detail: `${v.visits} invoices · week ending ${format(endOfWeek(parseISO(w), { weekStartsOn: 1 }), 'MMM d')}` }));

    // Visits by service category
    const cats = new Map<string, number>();
    completed.forEach((a) => {
      const cat = byId(s.services, a.serviceIds[0])?.category ?? 'other';
      cats.set(cat, (cats.get(cat) ?? 0) + 1);
    });
    const byCategory = [...cats.entries()].map(([k, v]) => ({ label: CATEGORY_META[k as keyof typeof CATEGORY_META].label, value: v })).sort((a, b) => b.value - a.value);

    // Time use per unit (on site vs driving), from planned routes of completed days.
    const units = s.teams.map((t) => {
      let onsite = 0;
      let drive = 0;
      let miles = 0;
      const dates = [...new Set(completed.filter((a) => a.teamId === t.id).map((a) => a.date))];
      dates.forEach((d) => {
        const r = buildDayRoute(s, t, d);
        if (r.plan) {
          onsite += r.plan.serviceMins;
          drive += r.plan.driveMins;
          miles += r.plan.driveMiles;
        }
      });
      return { team: t, onsite, drive, miles, days: dates.length };
    });

    // Revenue by area
    const areas = new Map<string, number>();
    invoices.forEach((i) => {
      const city = byId(s.clients, i.clientId)?.address.city ?? 'Unknown';
      areas.set(city, (areas.get(city) ?? 0) + i.total);
    });
    const byArea = [...areas.entries()].map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Referral sources (all active clients)
    const refs = new Map<string, number>();
    s.clients.filter((c) => c.status !== 'inactive').forEach((c) => refs.set(c.referralSource || 'Unknown', (refs.get(c.referralSource || 'Unknown') ?? 0) + 1));
    const byReferral = [...refs.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    const newClients = s.clients.filter((c) => c.createdAt.slice(0, 10) >= from).length;
    const totalDrive = units.reduce((t, u) => t + u.drive, 0);
    const totalOnsite = units.reduce((t, u) => t + u.onsite, 0);
    const totalMiles = units.reduce((t, u) => t + u.miles, 0);
    return { completed: completed.length, noShowRate: appts.length ? noShows / appts.length : 0, revenue, avg: completed.length ? revenue / completed.length : 0, byWeek, byCategory, units, byArea, byReferral, newClients, totalDrive, totalOnsite, totalMiles };
  }, [s, from, today]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Reports"
        subtitle="How the practice is doing — revenue, efficiency on the road, and where clients come from."
        actions={<Segmented value={range} onChange={setRange} size="sm" options={[{ value: '30', label: 'Last 30 days' }, { value: '45', label: 'Last 45 days' }]} />}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Stat icon={CircleDollarSign} label="Revenue billed" value={money(data.revenue)} />
        <Stat icon={PawPrint} label="Visits completed" value={data.completed} sub={`${money(data.avg)} per visit`} tone="indigo" />
        <Stat icon={Gauge} label="Time on site" value={`${Math.round((data.totalOnsite / Math.max(1, data.totalOnsite + data.totalDrive)) * 100)}%`} sub="vs. driving" tone="slate" />
        <Stat icon={Car} label="Miles driven" value={fmtMiles(data.totalMiles)} sub={`${fmtDuration(data.totalDrive)} behind the wheel`} tone="amber" />
        <Stat icon={UserX} label="No-show rate" value={`${(data.noShowRate * 100).toFixed(1)}%`} tone="red" />
        <Stat icon={UserPlus} label="New clients" value={data.newClients} tone="brand" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by week" subtitle="Invoiced amount, including trip fees" />
          <div className="p-4">
            <ColumnChart data={data.byWeek} format={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Time on the road vs. with patients" subtitle="Share of planned field time per unit. More teal = more billable time." />
          <div className="p-4">
            <StackedBars
              series={[
                { label: 'On site', color: SERIES.onsite },
                { label: 'Driving', color: SERIES.driving },
              ]}
              rows={data.units.map((u) => ({ label: u.team.name, values: [u.onsite, u.drive] }))}
              format={(v) => fmtDuration(v)}
            />
            <ul className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
              {data.units.map((u) => (
                <li key={u.team.id} className="rounded-lg bg-slate-50 p-2.5">
                  <span className="font-medium text-slate-700">{u.team.name}</span> · {u.days} field days · {fmtMiles(u.miles)} · {fmtDuration(u.days ? u.drive / u.days : 0)} driving/day
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Visits by type" subtitle="Completed visits, by primary service" />
          <div className="p-4">
            <BarList data={data.byCategory} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by area" subtitle="Where the business comes from — useful for zone days" />
          <div className="p-4">
            <BarList data={data.byArea} format={(v) => money(v)} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="How clients found us" subtitle="Active clients and leads, by referral source" />
          <div className="p-4">
            <BarList data={data.byReferral} />
          </div>
        </Card>
      </div>
    </div>
  );
}
