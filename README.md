# VetSet Manager

Scheduling, route optimization and client management for **mobile veterinary practices** —
the administrative side of the business (not medical records).

**Live demo:** see the Vercel link in the repo description. Each visitor gets their own private
copy of a realistic demo practice (2 field units, ~50 households, 6 weeks of history, 2 weeks
of bookings) stored in their browser, so friends can click around freely.

## What it does

| Area | Highlights |
|---|---|
| **Smart booking** | Pick client → pets → services. VetSet checks every unit’s route for the next 1–3 weeks and ranks open slots by *added drive time*, explaining each (“between Ramsey and Lopez, +4 min, 0.8 mi from a stop already on this route”). Honors AM/PM preference, unit, urgency and promised windows. Manual override available. |
| **Route optimization** | Per-unit day routes with real road drive times (OSRM), ETAs vs. promised arrival windows, lateness and overtime warnings, one-click optimize (keep promised windows *or* re-plan windows and notify clients), pinned time-sensitive visits, manual reordering, Google Maps hand-off, printable run sheet. |
| **Schedule** | Day timeline per unit (visits + drive legs + now line), week grid, filterable list. |
| **Doctor day sheet** | Each visit with pets (breed/age/weight/sex), handling alerts, reason, last visit, “also due” recalls, open balance, access notes; start/complete visit; running-late notifications. |
| **Driver run sheet** | Mobile-first next-stop card: address, gate codes/parking, pet alerts, big Navigate/Call/On-my-way buttons, arrival tracking, full stop list, pre-trip vehicle checklist and odometer mileage log. |
| **CRM** | Households & pets, tags, leads, referral source, preferred contact/time/unit, access notes, communication log, tasks, lifetime value, balance, memorial handling (stops reminders when a pet passes). |
| **Reminders & messages** | Confirmation queue, care recalls (auto-rolled forward when a visit is completed), waitlist with cancellation gap-fill suggestions by proximity, message log, editable templates with merge fields. Messages open the device’s SMS/email app in demo mode. |
| **Billing** | Invoices auto-created on completion (services × pets + zone-based house-call trip fee), payments, overdue tracking. |
| **Reports** | Revenue by week, time on site vs. driving per unit, miles, visits by type, revenue by area, referral sources, no-show rate. |
| **Roles** | Switch between Office, Doctor and Driver views (top-right) to see each person’s experience. |

## Tech

- React 19 + TypeScript + Vite, Tailwind CSS 4, Zustand, React Router, Leaflet
- Routing engine (`src/lib/routing.ts`): day simulation with arrival windows, exact search ≤ 8 stops,
  nearest-neighbour + 2-opt + relocate beyond that, cheapest-insertion slot finder — unit tested (`npm test`)
- Road data: public [OSRM](https://project-osrm.org/) (drive times/distances), [Photon](https://photon.komoot.io/)
  (address search), OpenStreetMap tiles. No API keys; everything degrades to distance estimates offline.
  For production volumes, swap in a self-hosted OSRM or Google/Mapbox matrix in `src/lib/travel.ts`.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # routing engine tests
npm run build
```

## Moving to Supabase (phase 2)

All UI goes through the store in `src/data/store.ts`, which persists through the `Repository`
interface in `src/data/repository.ts`. Today that is `LocalRepository` (browser storage).
To share live data between office, doctors and drivers:

1. Create a Supabase project and run `supabase/schema.sql`.
2. Add `SupabaseRepository implements Repository` (load → select per table; upsert/remove → table ops;
   `subscribe` → Realtime channel) mapping camelCase ⇄ snake_case.
3. Swap the one line in `store.ts` that constructs the repository, add Supabase Auth, and link each
   login to a `staff` row so the role switcher becomes real permissions.

## Demo data

Generated fresh relative to today (`src/data/seed.ts`). People, phone numbers (555-01xx) and emails
(example.com) are fictional; street names are real roads around Cedar Park / Round Rock, TX with
invented house numbers. Settings → Data lets you export, import or reset.
