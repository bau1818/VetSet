import { useEffect, useState } from 'react';
import type { Client, Pet, Species } from '../data/types';
import { newClientDraft, newPetDraft, saveClient, savePet } from '../data/actions';
import { useData } from '../data/store';
import { toast } from '../data/ui';
import { hasGeo } from '../lib/geo';
import { AddressInput } from './AddressInput';
import { Button, Chip, Field, Input, Modal, Select, Textarea } from './ui';

export const TAG_OPTIONS = ['VIP', 'Fear Free', 'Multi-pet', 'Barn cats', 'Senior pets', 'Prefers AM', 'Pays at visit', 'Neighborhood referrer', 'New lead'];
export const ALERT_OPTIONS = ['Anxious — Fear Free handling', 'Hides — confine before visit', 'Muzzle for handling', 'Fractious — 2 people to restrain', 'Reactive to other dogs', 'Escape risk — keep doors shut', 'Hard of hearing', 'Food motivated — treats OK'];
const REFERRALS = ['Google search', 'Nextdoor', 'Friend or family', 'Facebook', 'Instagram', 'Groomer referral', 'Shelter adoption', 'Neighbor', 'Previous clinic referral', 'Website booking request', 'Other'];

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client; onSaved?: (c: Client, pet?: Pet) => void }) {
  const teams = useData((s) => s.teams);
  const [c, setC] = useState<Client>(client ?? newClientDraft());
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const isNew = !client;

  useEffect(() => {
    if (open) {
      setC(client ?? newClientDraft());
      setPetName('');
    }
  }, [open, client]);

  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }));
  const valid = c.firstName.trim() && c.lastName.trim() && (c.phone.trim() || c.email.trim());

  const save = () => {
    const saved = { ...c, firstName: c.firstName.trim(), lastName: c.lastName.trim() };
    saveClient(saved);
    let pet: Pet | undefined;
    if (isNew && petName.trim()) {
      pet = { ...newPetDraft(saved.id), name: petName.trim(), species };
      savePet(pet);
    }
    toast(isNew ? `${saved.firstName} ${saved.lastName} added` : 'Client updated');
    onSaved?.(saved, pet);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'New client' : `Edit ${client?.firstName} ${client?.lastName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {isNew ? 'Add client' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={c.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
        </Field>
        <Field label="Last name">
          <Input value={c.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Mobile phone">
          <Input value={c.phone} inputMode="tel" placeholder="(555) 555-0123" onChange={(e) => set('phone', formatPhone(e.target.value))} />
        </Field>
        <Field label="Email">
          <Input value={c.email} type="email" onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Home address (visit location)" className="sm:col-span-2">
          <AddressInput value={c.address} onChange={(a) => set('address', a)} bias={teams[0]?.base} />
        </Field>
        <Field label="Access & parking notes" hint="Shown to the driver: gate codes, parking, loose dogs, which door." className="sm:col-span-2">
          <Textarea value={c.accessNotes} rows={2} onChange={(e) => set('accessNotes', e.target.value)} placeholder="e.g. Gate code 4471#, park in driveway, dogs loose in backyard" />
        </Field>
        <Field label="Preferred contact">
          <Select value={c.preferredContact} onChange={(e) => set('preferredContact', e.target.value as Client['preferredContact'])}>
            <option value="sms">Text message</option>
            <option value="call">Phone call</option>
            <option value="email">Email</option>
          </Select>
        </Field>
        <Field label="Preferred visit time">
          <Select value={c.preferredTime} onChange={(e) => set('preferredTime', e.target.value as Client['preferredTime'])}>
            <option value="any">Any time</option>
            <option value="am">Mornings</option>
            <option value="pm">Afternoons</option>
          </Select>
        </Field>
        <Field label="Preferred unit">
          <Select value={c.preferredTeamId ?? ''} onChange={(e) => set('preferredTeamId', e.target.value || undefined)}>
            <option value="">No preference</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={c.status} onChange={(e) => set('status', e.target.value as Client['status'])}>
            <option value="lead">Lead (not yet seen)</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="How did they hear about us?">
          <Select value={c.referralSource} onChange={(e) => set('referralSource', e.target.value)}>
            <option value="">—</option>
            {REFERRALS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((t) => (
              <Chip key={t} selected={c.tags.includes(t)} onClick={() => set('tags', c.tags.includes(t) ? c.tags.filter((x) => x !== t) : [...c.tags, t])} className="!py-1 !text-xs">
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Client notes (office)" className="sm:col-span-2">
          <Textarea value={c.notes} rows={2} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {isNew && (
          <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:col-span-2 sm:grid-cols-[1fr_10rem]">
            <Field label="First pet's name (optional)">
              <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="e.g. Biscuit" />
            </Field>
            <Field label="Species">
              <Select value={species} onChange={(e) => setSpecies(e.target.value as Species)}>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="rabbit">Rabbit</option>
                <option value="bird">Bird</option>
                <option value="reptile">Reptile</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
        )}
        {!hasGeo(c.address) && c.address.line1 && (
          <p className="text-xs text-amber-700 sm:col-span-2">This client can be saved, but can’t be route-optimized until the address is located.</p>
        )}
      </div>
    </Modal>
  );
}

export function PetFormModal({ open, onClose, pet, clientId }: { open: boolean; onClose: () => void; pet?: Pet; clientId: string }) {
  const [p, setP] = useState<Pet>(pet ?? newPetDraft(clientId));
  useEffect(() => {
    if (open) setP(pet ?? newPetDraft(clientId));
  }, [open, pet, clientId]);
  const set = <K extends keyof Pet>(k: K, v: Pet[K]) => setP((x) => ({ ...x, [k]: v }));
  const save = () => {
    savePet({ ...p, name: p.name.trim() });
    toast(pet ? 'Pet updated' : `${p.name} added`);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pet ? `Edit ${pet.name}` : 'Add pet'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!p.name.trim()} onClick={save}>
            Save pet
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={p.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Species">
          <Select value={p.species} onChange={(e) => set('species', e.target.value as Species)}>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="rabbit">Rabbit</option>
            <option value="bird">Bird</option>
            <option value="reptile">Reptile</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Breed">
          <Input value={p.breed} onChange={(e) => set('breed', e.target.value)} />
        </Field>
        <Field label="Sex">
          <Select value={p.sex} onChange={(e) => set('sex', e.target.value as Pet['sex'])}>
            <option value="MN">Male (neutered)</option>
            <option value="FS">Female (spayed)</option>
            <option value="M">Male (intact)</option>
            <option value="F">Female (intact)</option>
            <option value="U">Unknown</option>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={p.dob ?? ''} onChange={(e) => set('dob', e.target.value || undefined)} />
        </Field>
        <Field label="Weight (lbs)">
          <Input type="number" min={0} value={p.weightLbs ?? ''} onChange={(e) => set('weightLbs', e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
        <Field label="Color / markings" className="sm:col-span-2">
          <Input value={p.color} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Handling alerts (visible to doctor & driver)</span>
          <div className="flex flex-wrap gap-1.5">
            {ALERT_OPTIONS.map((t) => (
              <Chip key={t} selected={p.alerts.includes(t)} onClick={() => set('alerts', p.alerts.includes(t) ? p.alerts.filter((x) => x !== t) : [...p.alerts, t])} className="!py-1 !text-xs">
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={p.notes} rows={2} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
