import type { MessageTemplate } from '../data/types';

export const MERGE_FIELDS: { key: string; label: string; sample: string }[] = [
  { key: 'client_first', label: 'Client first name', sample: 'Jordan' },
  { key: 'pet_names', label: 'Pet name(s)', sample: 'Bella & Milo' },
  { key: 'date', label: 'Visit date', sample: 'Tuesday, Oct 6' },
  { key: 'window', label: 'Arrival window', sample: '9:30–11:30 AM' },
  { key: 'eta', label: 'ETA', sample: '10:15 AM' },
  { key: 'minutes', label: 'Minutes (away / late)', sample: '15' },
  { key: 'doctor', label: 'Doctor', sample: 'Dr. Johnson' },
  { key: 'service', label: 'Service', sample: 'Annual wellness exam' },
  { key: 'due_date', label: 'Due date', sample: 'Oct 12' },
  { key: 'balance', label: 'Balance due', sample: '$145' },
  { key: 'business', label: 'Practice name', sample: 'Premier Home Vet Care' },
  { key: 'phone', label: 'Practice phone', sample: '(512) 555-0100' },
];

export const fillTemplate = (body: string, vars: Record<string, string | number | undefined>) =>
  body.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined && vars[k] !== '' ? String(vars[k]) : m));

export const sampleVars = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample]));

export const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

export const defaultTemplates = (): MessageTemplate[] => [
  {
    id: 'tpl_confirm',
    key: 'confirm',
    name: 'Appointment confirmation',
    channel: 'sms',
    body: "Hi {client_first}! {business} here. {doctor} is scheduled to visit {pet_names} on {date}, arriving between {window}. Reply C to confirm or call {phone} to reschedule.",
  },
  {
    id: 'tpl_reminder',
    key: 'reminder',
    name: 'Day-before reminder',
    channel: 'sms',
    body: 'Reminder: {doctor} will see {pet_names} tomorrow, arriving {window}. Please have pets inside and gates unlocked. Questions? {phone}',
  },
  {
    id: 'tpl_omw',
    key: 'on_my_way',
    name: 'On my way',
    channel: 'sms',
    body: "Hi {client_first}, we're on our way to see {pet_names}! Our ETA is about {eta} ({minutes} min). See you soon — {business}",
  },
  {
    id: 'tpl_late',
    key: 'running_late',
    name: 'Running late',
    channel: 'sms',
    body: "Hi {client_first}, our earlier visit is running long — we're about {minutes} min behind and now expect to arrive around {eta}. Sorry for the wait! — {business}",
  },
  {
    id: 'tpl_recall',
    key: 'recall',
    name: 'Service due (recall)',
    channel: 'sms',
    body: "Hi {client_first}, {pet_names} is due for {service} on {due_date}. We'll be in your area soon — reply or call {phone} and we'll fit you into a nearby route. — {business}",
  },
  {
    id: 'tpl_follow',
    key: 'follow_up',
    name: 'Post-visit follow-up',
    channel: 'email',
    body: "Hi {client_first},\n\nThank you for having us out to see {pet_names}. Your invoice is attached; the balance due is {balance}.\n\nIf you have questions about today's visit, just reply here or call {phone}.\n\nWarmly,\n{business}",
  },
  {
    id: 'tpl_window',
    key: 'window_change',
    name: 'Arrival window update',
    channel: 'sms',
    body: "Hi {client_first}, we've fine-tuned our route for {date}. Your new arrival window for {pet_names} is {window}. Reply if that doesn't work and we'll adjust. — {business}",
  },
];
