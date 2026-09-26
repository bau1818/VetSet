-- VetSet Manager — Supabase / Postgres schema (phase 2: shared cloud data).
-- Mirrors src/data/types.ts one-to-one (camelCase in TS ⇄ snake_case here).
-- Run in the Supabase SQL editor, then implement SupabaseRepository (see README › Moving to Supabase).

create extension if not exists "pgcrypto";

create table practices (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  phone text, email text,
  window_mins int not null default 120,
  buffer_mins int not null default 10,
  trip_fee_zones jsonb not null default '[]',   -- [{maxMiles, fee, label}]
  out_of_area_fee numeric not null default 0,
  invoice_due_days int not null default 14,
  created_at timestamptz not null default now()
);

create table staff (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid references auth.users(id),      -- links a login to a staff member (doctor / driver / office)
  name text not null,
  role text not null check (role in ('doctor','driver','tech','office')),
  phone text, email text, color text,
  active boolean not null default true
);

create table teams (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  name text not null,
  doctor_id text references staff(id),
  driver_id text references staff(id),
  vehicle text, color text,
  base jsonb not null,                          -- {line1, city, state, zip, lat, lng}
  hours jsonb not null,                         -- 7 entries, Sunday first: {start,end} | null
  active boolean not null default true
);

create table clients (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  first_name text not null, last_name text not null,
  phone text, email text,
  preferred_contact text not null default 'sms',
  address_line1 text, city text, state text, zip text,
  lat double precision, lng double precision,
  access_notes text default '',
  tags text[] not null default '{}',
  referral_source text default '',
  preferred_time text not null default 'any',
  preferred_team_id text references teams(id),
  status text not null default 'active' check (status in ('lead','active','inactive')),
  notes text default '',
  created_at timestamptz not null default now()
);
create index on clients (practice_id, last_name);

create table pets (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  name text not null, species text not null, breed text, sex text,
  dob date, weight_lbs numeric, color text,
  alerts text[] not null default '{}',
  status text not null default 'active',
  notes text default ''
);

create table services (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  name text not null, category text not null,
  duration_mins int not null, extra_pet_mins int not null default 0,
  price numeric not null, recall_months int,
  active boolean not null default true
);

create table appointments (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  client_id text not null references clients(id),
  pet_ids text[] not null,
  service_ids text[] not null,
  team_id text not null references teams(id),
  date date not null,
  window_start time not null, window_end time not null,
  sequence int not null,
  duration_mins int not null,
  status text not null,
  reason text default '', internal_notes text default '',
  trip_fee numeric not null default 0, estimated_total numeric not null default 0,
  pinned boolean not null default false,
  source text not null default 'phone',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz, en_route_at timestamptz, arrived_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz, cancel_reason text
);
create index on appointments (team_id, date, sequence);
create index on appointments (client_id);

create table reminders (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  pet_id text not null references pets(id) on delete cascade,
  service_id text not null references services(id),
  due_date date not null,
  status text not null default 'due',
  last_contact_at timestamptz, contact_count int not null default 0
);

create table communications (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  appointment_id text references appointments(id) on delete set null,
  channel text not null, direction text not null,
  subject text, body text,
  created_at timestamptz not null default now(),
  by text
);

create table tasks (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  title text not null,
  client_id text references clients(id) on delete cascade,
  appointment_id text references appointments(id) on delete set null,
  due_date date not null, assignee_id text references staff(id),
  kind text not null default 'other', done boolean not null default false,
  created_at timestamptz not null default now()
);

create table invoices (
  id text primary key,
  number text not null,
  client_id text not null references clients(id),
  appointment_id text references appointments(id),
  lines jsonb not null,                         -- [{description, qty, unitPrice}]
  total numeric not null, amount_paid numeric not null default 0,
  status text not null, issued_at date not null, due_at date not null,
  paid_at date, method text
);

create table waitlist (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  pet_ids text[] not null, service_ids text[] not null,
  notes text default '', earliest date not null, latest date,
  preferred_time text not null default 'any',
  urgency text not null default 'routine',
  status text not null default 'waiting',
  created_at timestamptz not null default now()
);

create table message_templates (
  id text primary key,
  practice_id uuid not null references practices(id) on delete cascade,
  key text not null, name text not null, channel text not null, body text not null
);

create table driver_checklists (
  id text primary key,                          -- `${team_id}:${date}`
  team_id text not null references teams(id) on delete cascade,
  date date not null,
  checked text[] not null default '{}',
  odometer_start int, odometer_end int
);

-- Row-level security: every signed-in staff member sees only their practice's data.
-- (Enable on each table and add a policy like the one below.)
alter table clients enable row level security;
create policy "practice members" on clients
  using (practice_id in (select practice_id from staff where user_id = auth.uid()));
