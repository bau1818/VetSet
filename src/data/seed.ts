// Deterministic demo practice generated relative to "today" so the demo never looks stale.
// All people, phone numbers (555-01xx) and emails (example.com) are fictional; street names are
// real roads in the Austin, TX suburbs with invented house numbers.
import places from './seedPlaces.json';
import type {
  GeoPoint,
  Appointment,
  Client,
  Communication,
  DataSnapshot,
  DateStr,
  Invoice,
  Pet,
  Reminder,
  Service,
  Settings,
  Species,
  Staff,
  Task,
  Team,
  WaitlistEntry,
} from './types';
import { estimateLeg, milesBetween } from '../lib/geo';
import { mulberry32 } from '../lib/id';
import { optimize, simulate, windowAround, type DayConfig, type StopInput } from '../lib/routing';
import { defaultTemplates } from '../lib/templates';
import { daysBetween, shiftDate, toMin, toTime, weekday } from '../lib/time';
import { servicesSubtotal, tripFeeFor, visitDuration } from '../lib/pricing';

export const DATA_VERSION = 2;

const FIRST = ['Jordan', 'Avery', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Drew', 'Harper', 'Reese', 'Cameron', 'Rowan', 'Emerson', 'Hayden', 'Parker', 'Sydney', 'Blake', 'Dakota', 'Kendall', 'Logan', 'Peyton', 'Skyler', 'Elliot', 'Alex', 'Robin', 'Sage', 'Micah', 'Shawn', 'Jessie', 'Lee', 'Frankie', 'Marion', 'Dana', 'Kerry', 'Leslie', 'Carmen', 'Nico', 'Tatum', 'Arden', 'Remy', 'Ellis'];
const LAST = ['Alvarez', 'Bennett', 'Carter', 'Delgado', 'Ellison', 'Foster', 'Garza', 'Hayes', 'Ingram', 'Jensen', 'Kaplan', 'Lopez', 'Mercer', 'Nguyen', 'Ortega', 'Pruitt', 'Quintero', 'Ramsey', 'Sandoval', 'Thornton', 'Underwood', 'Vasquez', 'Whitaker', 'Yates', 'Zamora', 'Beaumont', 'Castillo', 'Dunham', 'Espinoza', 'Fairbanks', 'Guerrero', 'Holloway', 'Iverson', 'Kowalski', 'Lindqvist', 'Montoya', 'Novak', 'Okafor', 'Park', 'Reyes', 'Salazar', 'Tran', 'Villareal', 'Walsh'];
const DOGS = ['Bella', 'Max', 'Luna', 'Charlie', 'Cooper', 'Daisy', 'Milo', 'Bailey', 'Rocky', 'Sadie', 'Tucker', 'Penny', 'Bear', 'Rosie', 'Duke', 'Zoey', 'Finn', 'Willow', 'Gus', 'Maple', 'Scout', 'Hazel', 'Ollie', 'Winston', 'Biscuit', 'Juniper', 'Moose', 'Pepper', 'Remy', 'Stella', 'Waylon', 'Dolly', 'Ranger', 'Pecan', 'Boone'];
const CATS = ['Oliver', 'Leo', 'Chloe', 'Simba', 'Nala', 'Jasper', 'Cleo', 'Mochi', 'Pumpkin', 'Smokey', 'Tiger', 'Salem', 'Olive', 'Ziggy', 'Marmalade', 'Pickles', 'Figaro', 'Ghost', 'Butters', 'Poppy'];
const OTHER = ['Clover', 'Thumper', 'Nibbles', 'Kiwi'];
const DOG_BREEDS = ['Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'French Bulldog', 'Australian Shepherd', 'Dachshund', 'Goldendoodle', 'Border Collie', 'Boxer', 'Beagle', 'Chihuahua', 'Pit Bull mix', 'Great Pyrenees', 'Shih Tzu', 'Blue Heeler', 'Mixed breed', 'Cavalier King Charles', 'Miniature Schnauzer'];
const CAT_BREEDS = ['Domestic Shorthair', 'Domestic Shorthair', 'Domestic Longhair', 'Maine Coon', 'Siamese', 'Ragdoll', 'Bengal'];
const COLORS = ['Black', 'Tan', 'Brindle', 'Tabby', 'Calico', 'White', 'Tricolor', 'Chocolate', 'Gray', 'Orange', 'Black & white', 'Merle'];
const ALERTS = ['Anxious — Fear Free handling', 'Hides — confine before visit', 'Muzzle for handling', 'Fractious — 2 people to restrain', 'Reactive to other dogs', 'Escape risk — keep doors shut', 'Hard of hearing', 'Food motivated — treats OK'];
const ACCESS = [
  'Gate code 4471#. Park in the driveway.',
  'Side gate on the left; dogs may be loose in the backyard — call on arrival.',
  'Street parking only. Front door, ring bell.',
  'HOA gate: code 1906. Second house past the mailbox cluster.',
  'Long gravel drive; watch for chickens. Barn cats in the shed.',
  'Please text on arrival — baby napping, no doorbell.',
  'Apartment 2B, buzz 214. Visitor spots by the leasing office.',
  'Park behind the white truck. Use the garage entrance.',
  '',
  '',
  'Cat will be shut in the laundry room before we arrive.',
  'Corner lot; enter from the side street. Steep steps to the front door.',
];
const NOTES = [
  'Prefers morning visits. Works from home.',
  'Very engaged owner — likes a call after bloodwork is scheduled.',
  'Adopted both cats from Williamson County shelter.',
  'Pays at visit by card. Asked about multi-pet discounts.',
  'Referred two neighbors. Send a thank-you card.',
  'Spanish-speaking household; Carmen (daughter) coordinates visits.',
  '',
  '',
  'Grandfathered trip fee from 2024 promo.',
  'Moving to Georgetown in December — update address.',
];
const REFERRAL = ['Google search', 'Nextdoor', 'Friend or family', 'Facebook', 'Groomer referral', 'Shelter adoption', 'Instagram', 'Neighbor', 'Previous clinic referral'];
const TAG_POOL = ['VIP', 'Fear Free', 'Multi-pet', 'Barn cats', 'Senior pets', 'Prefers AM', 'Pays at visit', 'Neighborhood referrer'];

export const HQ = { line1: '1400 Post Trail', city: 'Cedar Park', state: 'TX', zip: '78613', lat: 30.493012, lng: -97.790509 };
export const EAST_BASE = { line1: '210 E Milam Ave', city: 'Round Rock', state: 'TX', zip: '78664', lat: 30.511889, lng: -97.679969 };

export const seedServices = (): Service[] => [
  { id: 'svc_wellness', name: 'Wellness exam', category: 'wellness', durationMins: 40, extraPetMins: 20, price: 85, recallMonths: 12, active: true },
  { id: 'svc_puppy', name: 'Puppy / kitten visit', category: 'wellness', durationMins: 35, extraPetMins: 20, price: 75, active: true },
  { id: 'svc_dhpp', name: 'DHPP vaccine', category: 'vaccine', durationMins: 5, extraPetMins: 5, price: 38, recallMonths: 12, active: true },
  { id: 'svc_fvrcp', name: 'FVRCP vaccine', category: 'vaccine', durationMins: 5, extraPetMins: 5, price: 36, recallMonths: 12, active: true },
  { id: 'svc_rabies', name: 'Rabies vaccine', category: 'vaccine', durationMins: 5, extraPetMins: 5, price: 30, recallMonths: 12, active: true },
  { id: 'svc_sick', name: 'Sick / problem visit', category: 'sick', durationMins: 50, extraPetMins: 25, price: 110, active: true },
  { id: 'svc_recheck', name: 'Recheck visit', category: 'sick', durationMins: 25, extraPetMins: 15, price: 65, active: true },
  { id: 'svc_senior', name: 'Senior wellness + lab draw', category: 'senior', durationMins: 55, extraPetMins: 30, price: 210, recallMonths: 6, active: true },
  { id: 'svc_nails', name: 'Nail trim', category: 'procedure', durationMins: 10, extraPetMins: 10, price: 25, active: true },
  { id: 'svc_chip', name: 'Microchip', category: 'procedure', durationMins: 10, extraPetMins: 5, price: 55, active: true },
  { id: 'svc_cert', name: 'Travel health certificate', category: 'other', durationMins: 30, extraPetMins: 15, price: 95, active: true },
  { id: 'svc_qol', name: 'Quality-of-life consult', category: 'endoflife', durationMins: 60, extraPetMins: 0, price: 150, active: true },
  { id: 'svc_euth', name: 'In-home euthanasia & aftercare', category: 'endoflife', durationMins: 75, extraPetMins: 30, price: 395, active: true },
];

export const seedSettings = (today: DateStr): Settings => ({
  businessName: 'VetSet Demo Practice',
  phone: '(512) 555-0100',
  email: 'office@vetset-demo.example',
  windowMins: 120,
  bufferMins: 10,
  tripFeeZones: [
    { maxMiles: 8, fee: 45, label: 'Zone 1 (0–8 mi)' },
    { maxMiles: 16, fee: 65, label: 'Zone 2 (8–16 mi)' },
    { maxMiles: 25, fee: 85, label: 'Zone 3 (16–25 mi)' },
  ],
  outOfAreaFee: 120,
  invoiceDueDays: 14,
  seededOn: today,
});

const weekdayHours = (start: string, end: string, sat?: [string, string]) => [
  null,
  { start, end },
  { start, end },
  { start, end },
  { start, end },
  { start, end },
  sat ? { start: sat[0], end: sat[1] } : null,
];

export function generateDemoData(today: DateStr, nowMins = 12 * 60): DataSnapshot {
  const rnd = mulberry32(925);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const chance = (p: number) => rnd() < p;
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const iso = (d: DateStr, t = '12:00') => new Date(`${d}T${t}:00`).toISOString();

  const settings = seedSettings(today);
  const services = seedServices();
  const svc = Object.fromEntries(services.map((s) => [s.id, s]));

  const staff: Staff[] = [
    { id: 'stf_ruiz', name: 'Dr. Elena Ruiz', role: 'doctor', phone: '(512) 555-0101', email: 'eruiz@vetset-demo.example', color: '#0f766e', active: true },
    { id: 'stf_okafor', name: 'Dr. James Okafor', role: 'doctor', phone: '(512) 555-0102', email: 'jokafor@vetset-demo.example', color: '#4f46e5', active: true },
    { id: 'stf_lee', name: 'Marcus Lee', role: 'driver', phone: '(512) 555-0103', email: 'mlee@vetset-demo.example', color: '#0891b2', active: true },
    { id: 'stf_brooks', name: 'Kayla Brooks', role: 'tech', phone: '(512) 555-0104', email: 'kbrooks@vetset-demo.example', color: '#7c3aed', active: true },
    { id: 'stf_shah', name: 'Priya Shah', role: 'office', phone: '(512) 555-0105', email: 'pshah@vetset-demo.example', color: '#b45309', active: true },
  ];

  const teams: Team[] = [
    { id: 'team_west', name: 'West Unit', doctorId: 'stf_ruiz', driverId: 'stf_lee', vehicle: 'Sprinter · VET-101', color: '#0d9488', base: HQ, hours: weekdayHours('08:00', '17:00', ['08:00', '13:00']), active: true },
    { id: 'team_east', name: 'East Unit', doctorId: 'stf_okafor', driverId: 'stf_brooks', vehicle: 'Transit · VET-202', color: '#6366f1', base: EAST_BASE, hours: weekdayHours('08:30', '17:30'), active: true },
  ];
  const teamFor = (lng: number) => (lng < -97.745 ? teams[0] : teams[1]);

  // ---- clients & pets -----------------------------------------------------------------------
  const clients: Client[] = [];
  const pets: Pet[] = [];
  const usedNames = new Set<string>();
  const leadIdx = new Set([7, 23, 41]);
  const inactiveIdx = new Set([12, 30, 47]);
  let dogI = 0;
  let catI = 0;

  places.forEach((pl, i) => {
    let first = '';
    let last = '';
    do {
      first = pick(FIRST);
      last = pick(LAST);
    } while (usedNames.has(first + last));
    usedNames.add(first + last);
    const id = `cl_${String(i + 1).padStart(3, '0')}`;
    const status = leadIdx.has(i) ? 'lead' : inactiveIdx.has(i) ? 'inactive' : 'active';
    const monthsAgo = status === 'lead' ? 0 : int(2, 40);
    const createdAt = status === 'lead' ? iso(shiftDate(today, -int(1, 5)), '10:15') : iso(shiftDate(today, -monthsAgo * 30));
    const tags = status === 'lead' ? ['New lead'] : Array.from(new Set(Array.from({ length: int(0, 2) }, () => pick(TAG_POOL))));
    clients.push({
      id,
      firstName: first,
      lastName: last,
      phone: `(512) 555-01${String(10 + i).padStart(2, '0')}`,
      email: `${first}.${last}`.toLowerCase() + '@example.com',
      preferredContact: pick(['sms', 'sms', 'sms', 'call', 'email'] as const),
      address: { line1: `${int(1, 39) * 100 + int(1, 98)} ${pl.street}`, city: pl.city, state: pl.state, zip: pl.zip, lat: pl.lat, lng: pl.lng },
      accessNotes: pick(ACCESS),
      tags,
      referralSource: status === 'lead' ? 'Website booking request' : pick(REFERRAL),
      preferredTime: pick(['any', 'any', 'am', 'pm'] as const),
      status,
      notes: status === 'lead' ? 'Requested a first in-home visit via the website form. Call to book.' : pick(NOTES),
      createdAt,
    });

    const nPets = status === 'lead' ? 1 : (() => {
      const r = rnd();
      return r < 0.5 ? 1 : r < 0.84 ? 2 : r < 0.96 ? 3 : 4;
    })();
    for (let k = 0; k < nPets; k++) {
      const r = rnd();
      const species: Species = r < 0.6 ? 'dog' : r < 0.95 ? 'cat' : 'rabbit';
      const name = species === 'dog' ? DOGS[dogI++ % DOGS.length] : species === 'cat' ? CATS[catI++ % CATS.length] : pick(OTHER);
      const ageYears = chance(0.12) ? 0 : int(1, 15);
      const dob = shiftDate(today, -(ageYears * 365 + int(20, 330)));
      pets.push({
        id: `pet_${String(pets.length + 1).padStart(3, '0')}`,
        clientId: id,
        name,
        species,
        breed: species === 'dog' ? pick(DOG_BREEDS) : species === 'cat' ? pick(CAT_BREEDS) : 'Holland Lop',
        sex: pick(['MN', 'FS', 'MN', 'FS', 'M', 'F'] as const),
        dob,
        weightLbs: species === 'dog' ? int(8, 95) : species === 'cat' ? int(7, 16) : 4,
        color: pick(COLORS),
        alerts: chance(0.28) ? [pick(ALERTS)] : [],
        status: 'active',
        notes: '',
      });
    }
  });

  const petsOf = (clientId: string) => pets.filter((p) => p.clientId === clientId && p.status === 'active');
  const bookable = clients.filter((c) => c.status === 'active');

  // ---- appointments -------------------------------------------------------------------------
  const appointments: Appointment[] = [];
  const invoices: Invoice[] = [];
  const communications: Communication[] = [];
  let apptN = 0;
  let invN = 1000;

  const leg = (a: GeoPoint, b: GeoPoint) => estimateLeg(a, b);
  const cfgFor = (team: Team, date: DateStr): DayConfig | null => {
    const h = team.hours[weekday(date)];
    if (!h) return null;
    return { base: team.base, dayStart: toMin(h.start), dayEnd: toMin(h.end), bufferMins: settings.bufferMins, leg };
  };

  const visitServices = (species: Species, age: number): string[] => {
    const r = rnd();
    if (r < 0.46) {
      const vax = species === 'cat' ? 'svc_fvrcp' : species === 'dog' ? 'svc_dhpp' : undefined;
      return ['svc_wellness', ...(vax ? [vax] : []), ...(chance(0.5) && species !== 'rabbit' ? ['svc_rabies'] : []), ...(chance(0.2) ? ['svc_nails'] : [])];
    }
    if (r < 0.66) return ['svc_sick'];
    if (r < 0.75) return ['svc_recheck'];
    if (r < 0.85 && age >= 8) return ['svc_senior'];
    if (r < 0.9) return ['svc_nails'];
    if (r < 0.94) return ['svc_cert'];
    if (r < 0.97 && age < 1) return ['svc_puppy', species === 'cat' ? 'svc_fvrcp' : 'svc_dhpp'];
    return ['svc_wellness'];
  };
  const REASONS: Record<string, string[]> = {
    svc_wellness: ['Annual wellness', 'Yearly check-up and vaccines', 'Wellness visit — new adoptee'],
    svc_sick: ['Limping on back left leg', 'Ear scratching / head shaking', 'Vomiting since yesterday', 'Itchy skin, hot spots', 'Not eating well'],
    svc_recheck: ['Ear infection recheck', 'Recheck after skin treatment', 'Weight check'],
    svc_senior: ['Senior wellness, owner wants lab work', 'Senior check — slowing down on walks'],
    svc_nails: ['Nail trim only'],
    svc_cert: ['Health certificate for holiday travel'],
    svc_puppy: ['First puppy visit', 'Kitten vaccines round 2'],
    svc_qol: ['Quality-of-life discussion'],
    svc_euth: ['Family requested a quiet late-afternoon visit; allow extra time.'],
  };

  const makeAppt = (client: Client, team: Team, date: DateStr, pinned = false, forceServices?: string[]): Appointment => {
    const cp = petsOf(client.id);
    const chosen = cp.length > 1 && chance(0.55) ? cp : [cp[0]];
    const age = chosen[0].dob ? daysBetween(chosen[0].dob, today) / 365 : 3;
    const serviceIds = forceServices ?? visitServices(chosen[0].species, age);
    const srv = serviceIds.map((id) => svc[id]);
    const miles = milesBetween(team.base, client.address as GeoPoint) * 1.25;
    const trip = tripFeeFor(settings, miles).fee;
    return {
      id: `apt_${String(++apptN).padStart(4, '0')}`,
      clientId: client.id,
      petIds: chosen.map((p) => p.id),
      serviceIds,
      teamId: team.id,
      date,
      windowStart: '08:00',
      windowEnd: '10:00',
      sequence: 0,
      durationMins: visitDuration(srv, chosen.length),
      status: 'scheduled',
      reason: pick(REASONS[serviceIds[0]] ?? ['Visit']),
      internalNotes: '',
      tripFee: trip,
      estimatedTotal: servicesSubtotal(srv, chosen.length) + trip,
      pinned,
      createdAt: iso(shiftDate(date, -int(3, 20)), '11:00'),
      source: pick(['phone', 'phone', 'online', 'staff', 'recall'] as const),
    };
  };

  /** Order a day (optimized unless `messy`), then derive promised windows from the ETAs. */
  const planDay = (list: Appointment[], cfg: DayConfig, messy: boolean) => {
    const byId = new Map(list.map((a) => [a.id, a]));
    const clientOf = (a: Appointment) => clients.find((c) => c.id === a.clientId)!;
    const stops: StopInput[] = list.map((a) => ({
      id: a.id,
      point: clientOf(a).address as GeoPoint,
      durationMins: a.durationMins,
      windowStart: a.pinned ? toMin(a.windowStart) : cfg.dayStart,
      windowEnd: a.pinned ? toMin(a.windowEnd) : cfg.dayEnd,
      pinned: a.pinned,
    }));
    let order = messy ? stops.slice().sort(() => rnd() - 0.5) : optimize(stops, cfg, 'replan-windows').order;
    // Trim anything that would run past the end of the day.
    let plan = simulate(order, cfg);
    while (plan.overtimeMins > 0 && order.length > 1) {
      const drop = order.findLastIndex((s) => !s.pinned);
      order = order.filter((_, i) => i !== drop);
      plan = simulate(order, cfg);
    }
    const kept = new Set(order.map((s) => s.id));
    order.forEach((s, i) => {
      const a = byId.get(s.id)!;
      a.sequence = i + 1;
      if (!a.pinned) {
        const w = windowAround(plan.stops[i].start, settings.windowMins, cfg.dayStart);
        a.windowStart = toTime(w.start);
        a.windowEnd = toTime(w.end);
      }
    });
    return { kept: list.filter((a) => kept.has(a.id)), plan, order };
  };

  const makeInvoice = (a: Appointment, date: DateStr, age: number): Invoice => {
    const lines = a.serviceIds.map((id) => ({ description: svc[id].name, qty: a.petIds.length, unitPrice: svc[id].price }));
    lines.push({ description: 'House-call trip fee', qty: 1, unitPrice: a.tripFee });
    const total = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
    const dueAt = shiftDate(date, settings.invoiceDueDays);
    const unpaid = age < 8 ? chance(0.3) : age <= 14 ? chance(0.1) : age <= 30 ? chance(0.04) : chance(0.015);
    const status = unpaid ? (dueAt < today ? 'overdue' : 'sent') : 'paid';
    return {
      id: `inv_${++invN}`,
      number: `INV-${invN}`,
      clientId: a.clientId,
      appointmentId: a.id,
      lines,
      total,
      amountPaid: status === 'paid' ? total : 0,
      status,
      issuedAt: date,
      dueAt,
      paidAt: status === 'paid' ? (chance(0.7) || age === 0 ? date : shiftDate(date, int(1, Math.min(9, Math.max(1, age))))) : undefined,
      method: status === 'paid' ? pick(['card', 'card', 'card', 'cash', 'check', 'transfer'] as const) : undefined,
    };
  };

  const recentVisit = new Map<string, DateStr>();

  // History: last 45 days.
  for (let d = -45; d <= -1; d++) {
    const date = shiftDate(today, d);
    for (const team of teams) {
      const cfg = cfgFor(team, date);
      if (!cfg) continue;
      const pool = bookable.filter((c) => teamFor(c.address.lng!).id === team.id);
      const n = weekday(date) === 6 ? int(2, 3) : int(4, 6);
      const chosen = new Set<Client>();
      while (chosen.size < Math.min(n, pool.length)) chosen.add(pick(pool));
      const list = [...chosen].map((c) => makeAppt(c, team, date));
      const { kept, plan, order } = planDay(list, cfg, false);
      kept.forEach((a) => {
        const idx = order.findIndex((s) => s.id === a.id);
        const r = rnd();
        a.status = r < 0.93 ? 'completed' : r < 0.97 ? 'cancelled' : 'no_show';
        a.confirmedAt = iso(shiftDate(date, -1), '15:00');
        if (a.status === 'completed') {
          const st = plan.stops[idx];
          a.arrivedAt = iso(date, toTime(st.arrival));
          a.completedAt = iso(date, toTime(st.start + a.durationMins));
          recentVisit.set(a.clientId, date);
          invoices.push(makeInvoice(a, date, -d));
        } else if (a.status === 'cancelled') {
          a.cancelledAt = iso(shiftDate(date, -1), '09:30');
          a.cancelReason = pick(['Client schedule conflict', 'Pet feeling better', 'Weather', 'Rescheduled by client']);
        }
        appointments.push(a);
      });
    }
  }

  // Future: today + 13 days. Two days are deliberately un-optimized to show off the route optimizer.
  const booked = new Set<string>();
  const messyDays = new Set<string>();
  for (let d = 0; d <= 13; d++) {
    const date = shiftDate(today, d);
    for (const team of teams) {
      const cfg = cfgFor(team, date);
      if (!cfg) continue;
      const pool = bookable.filter((c) => teamFor(c.address.lng!).id === team.id && !booked.has(c.id));
      if (!pool.length) continue;
      const sat = weekday(date) === 6;
      let n = d === 0 ? 6 : d === 1 ? 5 : d <= 5 ? int(4, 5) : d <= 9 ? int(2, 4) : int(1, 3);
      if (sat) n = Math.min(n, 3);
      // Zone day: cluster around an anchor client.
      const anchor = pick(pool);
      const near = pool
        .slice()
        .sort((a, b) => milesBetween(anchor.address as GeoPoint, a.address as GeoPoint) - milesBetween(anchor.address as GeoPoint, b.address as GeoPoint))
        .slice(0, n);
      const list = near.map((c) => makeAppt(c, team, date));
      const messy = !messyDays.has(team.id) && d >= 2 && d <= 5 && list.length >= 4;
      if (messy) messyDays.add(team.id);
      // One pinned, time-sensitive visit to show that pins survive optimization.
      if (d === 4 && team.id === 'team_west' && list.length) {
        const a = list[list.length - 1];
        const cp = petsOf(a.clientId);
        const senior = cp.find((p) => p.dob && daysBetween(p.dob, today) > 11 * 365) ?? cp[0];
        a.petIds = [senior.id];
        a.serviceIds = ['svc_qol'];
        a.reason = 'Family asked for a late-afternoon quality-of-life visit; keep this time.';
        a.durationMins = visitDuration([svc.svc_qol], 1);
        a.estimatedTotal = svc.svc_qol.price + a.tripFee;
        a.pinned = true;
        a.windowStart = toTime(cfg.dayEnd - 120);
        a.windowEnd = toTime(cfg.dayEnd - 90);
      }
      const { kept, plan, order } = planDay(list, cfg, messy);
      // Today reflects the time the demo was opened, but always leaves the last two stops open.
      const doneCount = d === 0 ? Math.min(Math.max(0, kept.length - 2), plan.stops.filter((st) => st.depart <= nowMins).length) : 0;
      kept.forEach((a) => {
        booked.add(a.clientId);
        const r = rnd();
        a.status = d === 0 ? 'confirmed' : d === 1 ? (r < 0.55 ? 'confirmed' : 'scheduled') : r < 0.3 ? 'confirmed' : 'scheduled';
        if (a.status === 'confirmed') a.confirmedAt = iso(shiftDate(date, -2), '16:20');
        if (d === 0) {
          const idx = order.findIndex((x) => x.id === a.id);
          const st = plan.stops[idx];
          if (idx < doneCount) {
            a.status = 'completed';
            a.arrivedAt = iso(date, toTime(st.arrival));
            a.completedAt = iso(date, toTime(st.start + a.durationMins));
            invoices.push(makeInvoice(a, date, 0));
          } else if (idx === doneCount && nowMins >= st.start) {
            a.status = 'arrived';
            a.arrivedAt = iso(date, toTime(st.arrival));
          } else if (idx === doneCount && nowMins >= st.arrival - st.legMins) {
            a.status = 'en_route';
          }
        }
        appointments.push(a);
        communications.push({
          id: `com_c${a.id}`,
          clientId: a.clientId,
          appointmentId: a.id,
          channel: 'sms',
          direction: 'out',
          subject: 'Appointment confirmation',
          body: `Confirmation sent for ${date} (${a.windowStart}–${a.windowEnd}).`,
          createdAt: a.createdAt,
          by: 'Priya Shah',
        });
        if (a.confirmedAt)
          communications.push({
            id: `com_r${a.id}`,
            clientId: a.clientId,
            appointmentId: a.id,
            channel: 'sms',
            direction: 'in',
            subject: 'Client reply',
            body: pick(['C', 'Confirmed, thank you!', 'C — gate will be open', 'Yes see you then']),
            createdAt: a.confirmedAt,
            by: 'Client',
          });
      });
    }
  }

  // ---- recalls ------------------------------------------------------------------------------
  const reminders: Reminder[] = [];
  const upcomingPets = new Set(appointments.filter((a) => a.date >= today && a.status !== 'cancelled').flatMap((a) => a.petIds));
  pets.forEach((p) => {
    const owner = clients.find((c) => c.id === p.clientId)!;
    if (owner.status === 'lead' || !chance(0.55)) return;
    const age = p.dob ? daysBetween(p.dob, today) / 365 : 3;
    const serviceId = age >= 9 && chance(0.5) ? 'svc_senior' : p.species === 'cat' ? pick(['svc_wellness', 'svc_fvrcp', 'svc_rabies']) : p.species === 'dog' ? pick(['svc_wellness', 'svc_dhpp', 'svc_rabies']) : 'svc_wellness';
    const due = shiftDate(today, int(-21, 40));
    const contacted = due < shiftDate(today, 7) && chance(0.45);
    reminders.push({
      id: `rem_${p.id}`,
      clientId: p.clientId,
      petId: p.id,
      serviceId,
      dueDate: due,
      status: upcomingPets.has(p.id) ? 'booked' : contacted ? 'contacted' : 'due',
      lastContactAt: contacted ? iso(shiftDate(today, -int(2, 12))) : undefined,
      contactCount: contacted ? int(1, 2) : 0,
    });
  });

  // ---- waitlist, tasks, extra comms ------------------------------------------------------------
  const free = bookable.filter((c) => !booked.has(c.id));
  const waitlist: WaitlistEntry[] = free.slice(0, 5).map((c, i) => {
    const cp = petsOf(c.id);
    const configs = [
      { serviceIds: ['svc_sick'], urgency: 'urgent', notes: 'Wants the first opening — itchy, licking paws constantly.' },
      { serviceIds: ['svc_wellness', 'svc_rabies'], urgency: 'soon', notes: 'Flexible any weekday; would take a cancellation.' },
      { serviceIds: ['svc_senior'], urgency: 'routine', notes: 'Prefers Dr. Okafor if possible.' },
      { serviceIds: ['svc_nails'], urgency: 'routine', notes: 'Can add on to a neighbor visit.' },
      { serviceIds: ['svc_cert'], urgency: 'soon', notes: 'Flying out in 12 days — needs certificate within 10 days of travel.' },
    ] as const;
    const cfg = configs[i];
    return {
      id: `wl_${i + 1}`,
      clientId: c.id,
      petIds: [cp[0].id],
      serviceIds: [...cfg.serviceIds],
      notes: cfg.notes,
      earliest: today,
      latest: i === 4 ? shiftDate(today, 10) : undefined,
      preferredTime: pick(['any', 'am', 'pm'] as const),
      urgency: cfg.urgency,
      status: 'waiting',
      createdAt: iso(shiftDate(today, -int(1, 6))),
    };
  });

  const overdue = invoices.filter((i) => i.status === 'overdue');
  const leads = clients.filter((c) => c.status === 'lead');
  const tasks: Task[] = [
    { id: 'tsk_1', title: `Call ${leads[0]?.firstName} ${leads[0]?.lastName} — new website request, book first visit`, clientId: leads[0]?.id, dueDate: today, assigneeId: 'stf_shah', kind: 'callback', done: false, createdAt: iso(today, '08:05') },
    ...(overdue[0] ? [{ id: 'tsk_2', title: `Follow up on overdue ${overdue[0].number}`, clientId: overdue[0].clientId, dueDate: today, assigneeId: 'stf_shah', kind: 'billing' as const, done: false, createdAt: iso(shiftDate(today, -2)) }] : []),
    { id: 'tsk_3', title: 'Send vaccine history to boarding facility (client request)', clientId: bookable[4].id, dueDate: shiftDate(today, 1), assigneeId: 'stf_shah', kind: 'records', done: false, createdAt: iso(shiftDate(today, -1)) },
    { id: 'tsk_4', title: 'Confirm new gate code before Tuesday visit', clientId: bookable[9].id, dueDate: shiftDate(today, 2), assigneeId: 'stf_lee', kind: 'followup', done: false, createdAt: iso(shiftDate(today, -1)) },
    { id: 'tsk_5', title: 'Restock sharps containers & exam table covers — East Unit', dueDate: shiftDate(today, 1), assigneeId: 'stf_brooks', kind: 'other', done: false, createdAt: iso(shiftDate(today, -3)) },
    { id: 'tsk_6', title: 'Mail sympathy card', clientId: bookable[15].id, dueDate: shiftDate(today, -1), assigneeId: 'stf_shah', kind: 'followup', done: true, createdAt: iso(shiftDate(today, -4)) },
  ];

  // A memorial pet: stops recalls/marketing for that animal.
  const memorialPet = pets.find((p) => p.clientId === bookable[15].id);
  if (memorialPet) {
    memorialPet.status = 'deceased';
    memorialPet.notes = 'Passed peacefully at home. Suppress reminders.';
  }
  const activeReminders = reminders.filter((r) => pets.find((p) => p.id === r.petId)?.status === 'active');

  return {
    version: DATA_VERSION,
    settings,
    staff,
    teams,
    clients,
    pets,
    services,
    appointments: appointments.sort((a, b) => (a.date === b.date ? a.sequence - b.sequence : a.date < b.date ? -1 : 1)),
    reminders: activeReminders,
    communications,
    tasks,
    invoices,
    waitlist,
    templates: defaultTemplates(),
    checklists: [],
  };
}
