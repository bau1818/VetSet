// Domain model for VetSet Manager.
// Every entity maps 1:1 to a table in supabase/schema.sql (camelCase here, snake_case there),
// so the local demo store can be swapped for Supabase without touching the UI.

export type ID = string;
/** Calendar date, 'YYYY-MM-DD' in the practice's local time. */
export type DateStr = string;
/** Time of day, 'HH:mm' 24h. */
export type TimeStr = string;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address extends Partial<GeoPoint> {
  line1: string;
  city: string;
  state: string;
  zip: string;
}

export type StaffRole = 'doctor' | 'driver' | 'tech' | 'office';

export interface Staff {
  id: ID;
  name: string;
  role: StaffRole;
  phone: string;
  email: string;
  color: string;
  active: boolean;
}

export interface DayHours {
  start: TimeStr;
  end: TimeStr;
}

/** A field unit = one vehicle crewed by a doctor and a driver/tech. Routes are planned per unit per day. */
export interface Team {
  id: ID;
  name: string;
  doctorId: ID;
  driverId: ID;
  vehicle: string;
  color: string;
  base: Address & GeoPoint;
  /** Index 0 = Sunday. null = not working that day. */
  hours: (DayHours | null)[];
  active: boolean;
}

export type ClientStatus = 'lead' | 'active' | 'inactive';
export type ContactPref = 'sms' | 'call' | 'email';
export type DayPart = 'any' | 'am' | 'pm';

export interface Client {
  id: ID;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  preferredContact: ContactPref;
  address: Address;
  /** Gate codes, parking, which door, dogs loose in yard — shown to the driver. */
  accessNotes: string;
  tags: string[];
  referralSource: string;
  preferredTime: DayPart;
  preferredTeamId?: ID;
  status: ClientStatus;
  notes: string;
  createdAt: string;
}

export type Species = 'dog' | 'cat' | 'rabbit' | 'bird' | 'reptile' | 'other';

export interface Pet {
  id: ID;
  clientId: ID;
  name: string;
  species: Species;
  breed: string;
  sex: 'M' | 'F' | 'MN' | 'FS' | 'U';
  dob?: DateStr;
  weightLbs?: number;
  color: string;
  /** Handling / behaviour alerts only (not medical records). */
  alerts: string[];
  status: 'active' | 'deceased';
  notes: string;
}

export type ServiceCategory = 'wellness' | 'vaccine' | 'sick' | 'senior' | 'endoflife' | 'procedure' | 'other';

export interface Service {
  id: ID;
  name: string;
  category: ServiceCategory;
  durationMins: number;
  /** Extra minutes for each additional pet seen during the same visit. */
  extraPetMins: number;
  price: number;
  /** When set, completing this service creates a recall reminder this many months out. */
  recallMonths?: number;
  active: boolean;
}

export type AppointmentStatus =
  | 'requested'
  | 'scheduled'
  | 'confirmed'
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: ID;
  clientId: ID;
  petIds: ID[];
  serviceIds: ID[];
  teamId: ID;
  date: DateStr;
  /** Arrival window promised to the client. */
  windowStart: TimeStr;
  windowEnd: TimeStr;
  /** Stop order within the unit's day route (1-based). */
  sequence: number;
  durationMins: number;
  status: AppointmentStatus;
  reason: string;
  internalNotes: string;
  tripFee: number;
  estimatedTotal: number;
  /** Pinned appointments keep their window when the route is re-optimized. */
  pinned: boolean;
  createdAt: string;
  confirmedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  source: 'phone' | 'online' | 'waitlist' | 'recall' | 'staff';
}

export type ReminderStatus = 'due' | 'contacted' | 'booked' | 'dismissed';

/** Recall: a service a pet is due for (annual exam, vaccine booster…). Administrative, not clinical. */
export interface Reminder {
  id: ID;
  clientId: ID;
  petId: ID;
  serviceId: ID;
  dueDate: DateStr;
  status: ReminderStatus;
  lastContactAt?: string;
  contactCount: number;
}

export type Channel = 'sms' | 'email' | 'call' | 'note';

export interface Communication {
  id: ID;
  clientId: ID;
  appointmentId?: ID;
  channel: Channel;
  direction: 'out' | 'in';
  subject: string;
  body: string;
  createdAt: string;
  by: string;
}

export interface Task {
  id: ID;
  title: string;
  clientId?: ID;
  appointmentId?: ID;
  dueDate: DateStr;
  assigneeId?: ID;
  kind: 'callback' | 'followup' | 'billing' | 'records' | 'other';
  done: boolean;
  createdAt: string;
}

export interface InvoiceLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: ID;
  number: string;
  clientId: ID;
  appointmentId?: ID;
  lines: InvoiceLine[];
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  issuedAt: DateStr;
  dueAt: DateStr;
  paidAt?: DateStr;
  method?: 'card' | 'cash' | 'check' | 'transfer';
}

export interface WaitlistEntry {
  id: ID;
  clientId: ID;
  petIds: ID[];
  serviceIds: ID[];
  notes: string;
  earliest: DateStr;
  latest?: DateStr;
  preferredTime: DayPart;
  urgency: 'routine' | 'soon' | 'urgent';
  status: 'waiting' | 'booked' | 'removed';
  createdAt: string;
}

export interface MessageTemplate {
  id: ID;
  key: 'confirm' | 'reminder' | 'on_my_way' | 'running_late' | 'recall' | 'follow_up' | 'window_change' | 'custom';
  name: string;
  channel: 'sms' | 'email';
  body: string;
}

export interface TripFeeZone {
  maxMiles: number;
  fee: number;
  label: string;
}

export interface Settings {
  businessName: string;
  phone: string;
  email: string;
  /** Minutes in each promised arrival window. */
  windowMins: number;
  /** Minutes between stops for parking, set-up and paperwork. */
  bufferMins: number;
  tripFeeZones: TripFeeZone[];
  /** Beyond the last zone we still book, but flag it. */
  outOfAreaFee: number;
  invoiceDueDays: number;
  /** When set, time/day-based features treat this as "today". Used to keep the demo fresh. */
  seededOn?: DateStr;
}

export interface DriverChecklist {
  id: ID; // `${teamId}:${date}`
  teamId: ID;
  date: DateStr;
  checked: string[];
  odometerStart?: number;
  odometerEnd?: number;
}

export interface DataSnapshot {
  version: number;
  settings: Settings;
  staff: Staff[];
  teams: Team[];
  clients: Client[];
  pets: Pet[];
  services: Service[];
  appointments: Appointment[];
  reminders: Reminder[];
  communications: Communication[];
  tasks: Task[];
  invoices: Invoice[];
  waitlist: WaitlistEntry[];
  templates: MessageTemplate[];
  checklists: DriverChecklist[];
}

export type CollectionKey = Exclude<keyof DataSnapshot, 'version' | 'settings'>;
export type EntityOf<K extends CollectionKey> = DataSnapshot[K][number];
