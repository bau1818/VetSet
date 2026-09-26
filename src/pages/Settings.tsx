import { Building2, Car, Database, Download, Plus, RotateCcw, Route, Stethoscope, Trash2, Upload, Users, Wallet } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { AddressInput } from '../components/AddressInput';
import { Badge, Button, Card, CardHeader, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { CATEGORY_META } from '../components/ui';
import { importSnapshot, patch, remove, resetDemoData, snapshotOf, updateSettings, upsert, useData } from '../data/store';
import type { DataSnapshot, Service, ServiceCategory, Staff, StaffRole, Team } from '../data/types';
import { toast } from '../data/ui';
import { hasGeo } from '../lib/geo';
import { uid } from '../lib/id';
import { money } from '../lib/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Section({ icon, title, subtitle, children, actions }: { icon: typeof Building2; title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

export function Settings() {
  const s = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(snapshotOf(useData.getState()), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vetset-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const snap = JSON.parse(await file.text()) as DataSnapshot;
      if (!snap.clients || !snap.appointments || !snap.teams) throw new Error('Not a VetSet export');
      await importSnapshot({ ...snap, settings: { ...snap.settings, seededOn: undefined } });
      toast('Data imported');
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Settings" subtitle="Practice details, field units, services and pricing." />

      <Section icon={Building2} title="Practice">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Practice name">
            <Input defaultValue={s.settings.businessName} onBlur={(e) => updateSettings({ businessName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input defaultValue={s.settings.phone} onBlur={(e) => updateSettings({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input defaultValue={s.settings.email} onBlur={(e) => updateSettings({ email: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section icon={Route} title="Scheduling rules" subtitle="Used by the slot finder and route optimizer">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Arrival window promised to clients" hint="e.g. “arriving between 9:30 and 11:30”">
            <Select value={s.settings.windowMins} onChange={(e) => updateSettings({ windowMins: Number(e.target.value) })}>
              {[60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m / 60} hour{m === 60 ? '' : 's'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Buffer between visits" hint="Parking, set-up, paperwork">
            <Select value={s.settings.bufferMins} onChange={(e) => updateSettings({ bufferMins: Number(e.target.value) })}>
              {[0, 5, 10, 15, 20].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice due after">
            <Select value={s.settings.invoiceDueDays} onChange={(e) => updateSettings({ invoiceDueDays: Number(e.target.value) })}>
              {[0, 7, 14, 30].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Due on receipt' : `${m} days`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section icon={Car} title="Field units" subtitle="Each unit is one vehicle with a doctor and a driver/tech. Routes start and end at the unit’s base.">
        <div className="space-y-4">
          {s.teams.map((t) => (
            <TeamEditor key={t.id} team={t} />
          ))}
        </div>
      </Section>

      <Section
        icon={Users}
        title="Staff"
        actions={
          <Button size="xs" icon={Plus} onClick={() => upsert('staff', { id: uid('stf'), name: 'New team member', role: 'driver', phone: '', email: '', color: '#64748b', active: true })}>
            Add
          </Button>
        }
      >
        <div className="space-y-2">
          {s.staff.map((m) => (
            <StaffRow key={m.id} member={m} />
          ))}
        </div>
      </Section>

      <Section
        icon={Stethoscope}
        title="Services & pricing"
        subtitle="Visit length = first pet’s minutes + extra minutes per additional pet. Recall sets the next reminder after completion."
        actions={
          <Button size="xs" icon={Plus} onClick={() => upsert('services', { id: uid('svc'), name: 'New service', category: 'other', durationMins: 30, extraPetMins: 10, price: 50, active: true })}>
            Add
          </Button>
        }
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Service</th>
                <th className="px-2 py-1.5">Category</th>
                <th className="px-2 py-1.5">Minutes</th>
                <th className="px-2 py-1.5">+/pet</th>
                <th className="px-2 py-1.5">Price</th>
                <th className="px-2 py-1.5">Recall (mo)</th>
                <th className="px-2 py-1.5">Active</th>
              </tr>
            </thead>
            <tbody>
              {s.services.map((sv) => (
                <ServiceRow key={sv.id} svc={sv} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={Wallet} title="House-call trip fees" subtitle="Charged once per visit, by road distance from the unit’s base.">
        <div className="space-y-2">
          {s.settings.tripFeeZones.map((z, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2.5rem] sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2.5rem] items-end gap-2">
              <Field label={i === 0 ? 'Zone' : ''}>
                <Input defaultValue={z.label} onBlur={(e) => updateSettings({ tripFeeZones: s.settings.tripFeeZones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              </Field>
              <Field label={i === 0 ? 'Up to (mi)' : ''}>
                <Input type="number" defaultValue={z.maxMiles} onBlur={(e) => updateSettings({ tripFeeZones: s.settings.tripFeeZones.map((x, j) => (j === i ? { ...x, maxMiles: Number(e.target.value) } : x)) })} />
              </Field>
              <Field label={i === 0 ? 'Fee ($)' : ''}>
                <Input type="number" defaultValue={z.fee} onBlur={(e) => updateSettings({ tripFeeZones: s.settings.tripFeeZones.map((x, j) => (j === i ? { ...x, fee: Number(e.target.value) } : x)) })} />
              </Field>
              <button className="mb-1 grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="Remove zone" onClick={() => updateSettings({ tripFeeZones: s.settings.tripFeeZones.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <Button size="sm" icon={Plus} onClick={() => updateSettings({ tripFeeZones: [...s.settings.tripFeeZones, { label: `Zone ${s.settings.tripFeeZones.length + 1}`, maxMiles: (s.settings.tripFeeZones.at(-1)?.maxMiles ?? 0) + 10, fee: (s.settings.tripFeeZones.at(-1)?.fee ?? 40) + 20 }] })}>
              Add zone
            </Button>
            <Field label="Beyond last zone ($)" className="w-40">
              <Input type="number" defaultValue={s.settings.outOfAreaFee} onBlur={(e) => updateSettings({ outOfAreaFee: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={Database} title="Data">
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600">Storage:</span> <Badge tone="brand">{s.backendLabel}</Badge>
            <span className="text-slate-500">Each browser keeps its own copy. A shared cloud database (Supabase) is the planned next step — the data layer is already built for it.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={exportData}>
              Export JSON
            </Button>
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
            <Button variant="ghost" icon={RotateCcw} className="text-red-600 hover:bg-red-50" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          </div>
        </div>
      </Section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDemoData();
                setConfirmReset(false);
                toast('Demo data regenerated for today');
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">This replaces everything stored in this browser with a fresh demo practice built around today’s date.</p>
      </Modal>
    </div>
  );
}

function TeamEditor({ team }: { team: Team }) {
  const s = useData();
  const set = (changes: Partial<Team>) => patch('teams', team.id, changes);
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Unit name">
          <Input defaultValue={team.name} onBlur={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Vehicle">
          <Input defaultValue={team.vehicle} onBlur={(e) => set({ vehicle: e.target.value })} />
        </Field>
        <Field label="Doctor">
          <Select value={team.doctorId} onChange={(e) => set({ doctorId: e.target.value })}>
            {s.staff.filter((m) => m.role === 'doctor').map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Driver / tech">
          <Select value={team.driverId} onChange={(e) => set({ driverId: e.target.value })}>
            {s.staff.filter((m) => m.role === 'driver' || m.role === 'tech').map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Field label="Base (routes start and end here)">
          <AddressInput value={team.base} bias={team.base} onChange={(a) => hasGeo(a) ? set({ base: { ...a, lat: a.lat, lng: a.lng } }) : undefined} />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Working hours</span>
          <div className="space-y-1.5">
            {DAYS.map((d, i) => {
              const h = team.hours[i];
              return (
                <div key={d} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-700"
                      checked={!!h}
                      onChange={(e) => set({ hours: team.hours.map((x, j) => (j === i ? (e.target.checked ? { start: '08:00', end: '17:00' } : null) : x)) })}
                    />
                    {d}
                  </label>
                  {h ? (
                    <>
                      <Input type="time" step={1800} value={h.start} className="!h-8" onChange={(e) => set({ hours: team.hours.map((x, j) => (j === i && x ? { ...x, start: e.target.value } : x)) })} />
                      <Input type="time" step={1800} value={h.end} className="!h-8" onChange={(e) => set({ hours: team.hours.map((x, j) => (j === i && x ? { ...x, end: e.target.value } : x)) })} />
                    </>
                  ) : (
                    <span className="col-span-2 text-xs text-slate-400">Off</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ member }: { member: Staff }) {
  const set = (c: Partial<Staff>) => patch('staff', member.id, c);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_9rem_1fr_2.5rem]">
      <Input defaultValue={member.name} onBlur={(e) => set({ name: e.target.value })} aria-label="Name" />
      <Select value={member.role} onChange={(e) => set({ role: e.target.value as StaffRole })} aria-label="Role">
        <option value="doctor">Doctor</option>
        <option value="driver">Driver</option>
        <option value="tech">Tech</option>
        <option value="office">Office</option>
      </Select>
      <Input defaultValue={member.phone} placeholder="Phone" onBlur={(e) => set({ phone: e.target.value })} aria-label="Phone" />
      <Input defaultValue={member.email} placeholder="Email" onBlur={(e) => set({ email: e.target.value })} aria-label="Email" />
      <button className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label={`Remove ${member.name}`} onClick={() => remove('staff', member.id)}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function ServiceRow({ svc }: { svc: Service }) {
  const set = (c: Partial<Service>) => patch('services', svc.id, c);
  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5">
        <Input defaultValue={svc.name} className="!h-8" onBlur={(e) => set({ name: e.target.value })} />
      </td>
      <td className="px-2 py-1.5">
        <Select value={svc.category} className="!h-8 text-xs" onChange={(e) => set({ category: e.target.value as ServiceCategory })}>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="w-20 px-2 py-1.5">
        <Input type="number" defaultValue={svc.durationMins} className="!h-8" onBlur={(e) => set({ durationMins: Number(e.target.value) })} />
      </td>
      <td className="w-20 px-2 py-1.5">
        <Input type="number" defaultValue={svc.extraPetMins} className="!h-8" onBlur={(e) => set({ extraPetMins: Number(e.target.value) })} />
      </td>
      <td className="w-24 px-2 py-1.5">
        <Input type="number" defaultValue={svc.price} className="!h-8" onBlur={(e) => set({ price: Number(e.target.value) })} title={money(svc.price)} />
      </td>
      <td className="w-24 px-2 py-1.5">
        <Input type="number" defaultValue={svc.recallMonths ?? ''} placeholder="—" className="!h-8" onBlur={(e) => set({ recallMonths: e.target.value ? Number(e.target.value) : undefined })} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" className="size-4 accent-brand-700" checked={svc.active} onChange={(e) => set({ active: e.target.checked })} />
      </td>
    </tr>
  );
}
