import clsx from 'clsx';
import { Check, Loader2, MapPin, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Address, GeoPoint } from '../data/types';
import { hasGeo } from '../lib/geo';
import { Input } from './ui';

// Address search via Photon (OpenStreetMap data, free, built for type-ahead). Biased toward the practice area.
const PHOTON = 'https://photon.komoot.io/api/';

const STATES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

interface Suggestion {
  label: string;
  sub: string;
  address: Address & GeoPoint;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

const toSuggestion = (f: PhotonFeature): Suggestion | null => {
  const p = f.properties;
  if (p.countrycode && p.countrycode !== 'US') return null;
  const street = p.street ?? (p.osm_key === 'highway' ? p.name : undefined);
  const line1 = [p.housenumber, street ?? p.name].filter(Boolean).join(' ');
  if (!line1) return null;
  const city = p.city ?? p.town ?? p.village ?? p.district ?? p.county ?? '';
  const state = STATES[p.state ?? ''] ?? p.state ?? '';
  const [lng, lat] = f.geometry.coordinates;
  return {
    label: line1,
    sub: [city, state, p.postcode].filter(Boolean).join(', '),
    address: { line1, city, state, zip: p.postcode ?? '', lat, lng },
  };
};

export function AddressInput({ value, onChange, bias }: { value: Address; onChange: (a: Address) => void; bias?: GeoPoint }) {
  const [query, setQuery] = useState(value.line1);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const typed = useRef(false);

  useEffect(() => setQuery(value.line1), [value.line1]);

  useEffect(() => {
    if (!typed.current) return;
    const q = query.trim();
    if (q.length < 4) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
        if (bias) {
          params.set('lat', String(bias.lat));
          params.set('lon', String(bias.lng));
        }
        const res = await fetch(`${PHOTON}?${params}`, { signal: c.signal });
        const json = (await res.json()) as { features: PhotonFeature[] };
        const list = json.features.map(toSuggestion).filter(Boolean) as Suggestion[];
        setItems(list);
        setActive(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(true);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, bias]);

  const choose = (s: Suggestion) => {
    typed.current = false;
    setQuery(s.address.line1);
    setOpen(false);
    onChange(s.address);
  };

  const located = hasGeo(value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          placeholder="Start typing a street address…"
          className="pl-9"
          autoComplete="off"
          onChange={(e) => {
            typed.current = true;
            setQuery(e.target.value);
            onChange({ ...value, line1: e.target.value, lat: undefined, lng: undefined });
          }}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(items[active]);
            }
          }}
        />
        {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />}
        {open && items.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((s, i) => (
              <li key={`${s.label}-${s.sub}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className={clsx('flex w-full items-start gap-2 px-3 py-2 text-left text-sm', i === active ? 'bg-brand-50' : 'hover:bg-slate-50')}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span>
                    <span className="block font-medium text-slate-800">{s.label}</span>
                    <span className="block text-xs text-slate-500">{s.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_4rem_5.5rem] gap-2">
        <Input value={value.city} placeholder="City" onChange={(e) => onChange({ ...value, city: e.target.value })} />
        <Input value={value.state} placeholder="ST" maxLength={2} onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })} />
        <Input value={value.zip} placeholder="ZIP" onChange={(e) => onChange({ ...value, zip: e.target.value })} />
      </div>
      <p className={clsx('flex items-center gap-1.5 text-xs', located ? 'text-emerald-700' : 'text-amber-700')}>
        {located ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
        {located
          ? 'Location found — this address can be routed.'
          : error
            ? 'Address lookup is unavailable right now. You can save and add the location later.'
            : 'Pick a suggestion so the address can be placed on the route map.'}
      </p>
    </div>
  );
}
