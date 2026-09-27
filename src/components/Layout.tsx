import clsx from 'clsx';
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Car,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  PawPrint,
  Route,
  Search,
  Settings as SettingsIcon,
  Stethoscope,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { resetDemoData, useData } from '../data/store';
import { useUi, type Role } from '../data/ui';
import { byId, clientName, ownerOf, searchClients } from '../data/selectors';
import { useTravelStore } from '../lib/travel';
import { fmtDate, todayStr } from '../lib/time';
import { AppointmentDrawer } from './AppointmentDrawer';
import { MessageComposer } from './MessageComposer';
import { Avatar, LinkButton, SpeciesIcon } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, { section?: string; items: NavItem[] }[]> = {
  office: [
    { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'Scheduling',
      items: [
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
        { to: '/book', label: 'Book appointment', icon: CalendarPlus },
        { to: '/routes', label: 'Routes', icon: Route },
      ],
    },
    {
      section: 'Clients',
      items: [
        { to: '/clients', label: 'Clients & pets', icon: Users },
        { to: '/messages', label: 'Reminders & messages', icon: MessagesSquare },
      ],
    },
    {
      section: 'Business',
      items: [
        { to: '/billing', label: 'Billing', icon: CircleDollarSign },
        { to: '/reports', label: 'Reports', icon: BarChart3 },
        { to: '/settings', label: 'Settings', icon: SettingsIcon },
      ],
    },
    {
      section: 'Field views',
      items: [
        { to: '/doctor', label: 'Doctor day sheet', icon: Stethoscope },
        { to: '/driver', label: 'Driver run sheet', icon: Car },
      ],
    },
  ],
  doctor: [
    { items: [{ to: '/doctor', label: 'My day', icon: Stethoscope }] },
    {
      section: 'Practice',
      items: [
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
        { to: '/routes', label: 'Routes', icon: Route },
        { to: '/clients', label: 'Clients & pets', icon: Users },
        { to: '/book', label: 'Book appointment', icon: CalendarPlus },
      ],
    },
  ],
  driver: [
    { items: [{ to: '/driver', label: 'Run sheet', icon: Car }] },
    {
      section: 'Route',
      items: [
        { to: '/routes', label: 'Route map', icon: Route },
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
      ],
    },
  ],
};

const MOBILE_TABS: Record<Role, NavItem[]> = {
  office: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/book', label: 'Book', icon: CalendarPlus },
    { to: '/routes', label: 'Routes', icon: Route },
    { to: '/clients', label: 'Clients', icon: Users },
  ],
  doctor: [
    { to: '/doctor', label: 'My day', icon: Stethoscope },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/routes', label: 'Route', icon: Route },
    { to: '/clients', label: 'Clients', icon: Users },
  ],
  driver: [
    { to: '/driver', label: 'Run', icon: Car },
    { to: '/routes', label: 'Map', icon: Route },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
};

const ROLE_HOME: Record<Role, string> = { office: '/', doctor: '/doctor', driver: '/driver' };
const ROLE_LABEL: Record<Role, string> = { office: 'Office', doctor: 'Doctor', driver: 'Driver' };

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white shadow-sm">
        <PawPrint className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-slate-900">VetSet</p>
        <p className="text-[11px] font-medium text-slate-500">Manager</p>
      </div>
    </div>
  );
}

function SideNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav className="space-y-5">
      {NAV[role].map((g, i) => (
        <div key={i}>
          {g.section && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.section}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  <it.icon className="size-[18px]" />
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function RoleSwitcher() {
  const { role, setRole, actingTeamId, setActingTeam } = useUi();
  const s = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const team = byId(s.teams, actingTeamId) ?? s.teams[0];
  const person = role === 'doctor' ? byId(s.staff, team?.doctorId) : role === 'driver' ? byId(s.staff, team?.driverId) : ownerOf(s);

  const choose = (r: Role, teamId?: string) => {
    setRole(r);
    if (teamId) setActingTeam(teamId);
    setOpen(false);
    navigate(ROLE_HOME[r]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pr-2 pl-1 text-left shadow-xs hover:border-slate-300"
      >
        <Avatar name={person?.name ?? 'Office'} color={person?.color} size="sm" />
        <span className="hidden leading-tight sm:block">
          <span className="block text-xs font-semibold text-slate-800">{person?.name ?? 'Office'}</span>
          <span className="block text-[11px] text-slate-500">
            {role === 'office' ? 'Owner · office view' : `${ROLE_LABEL[role]} view${team ? ` · ${team.name}` : ''}`}
          </span>
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Switch view (demo)</p>
          <RoleOption active={role === 'office'} onClick={() => choose('office')} title={`${ownerOf(s)?.name ?? 'Owner'} · Owner`} sub="Office view: scheduling, CRM, billing, reports" icon={LayoutDashboard} />
          {s.teams.map((t) => (
            <div key={t.id}>
              <RoleOption active={role === 'doctor' && actingTeamId === t.id} onClick={() => choose('doctor', t.id)} title={byId(s.staff, t.doctorId)?.name ?? 'Doctor'} sub={`Doctor · ${t.name}`} icon={Stethoscope} />
              <RoleOption active={role === 'driver' && actingTeamId === t.id} onClick={() => choose('driver', t.id)} title={byId(s.staff, t.driverId)?.name ?? 'Driver'} sub={`Driver · ${t.name}`} icon={Car} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleOption({ active, onClick, title, sub, icon: Icon }: { active: boolean; onClick: () => void; title: string; sub: string; icon: LucideIcon }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', active ? 'bg-brand-50' : 'hover:bg-slate-50')}>
      <span className={clsx('grid size-8 place-items-center rounded-lg', active ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500')}>
        <Icon className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
    </button>
  );
}

function GlobalSearch() {
  const s = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchClients(s, q, 7);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const go = (id: string) => {
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/clients/${id}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
          if (e.key === 'Enter' && results[active]) go(results[active].c.id);
          if (e.key === 'Escape') inputRef.current?.blur();
        }}
        placeholder={typeof window !== 'undefined' && window.innerWidth < 640 ? 'Search' : 'Search clients, pets, phone…'}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-12 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 text-[11px] text-slate-400 md:block">⌘K</span>
      {open && q && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No clients match “{q}”.</p>
          ) : (
            <ul className="py-1">
              {results.map(({ c, pet }, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(c.id)}
                    className={clsx('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm', i === active ? 'bg-brand-50' : 'hover:bg-slate-50')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">{clientName(c)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.phone} · {c.address.city}
                      </span>
                    </span>
                    {pet ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                        <SpeciesIcon species={pet.species} className="size-3.5" /> {pet.name}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400">{s.pets.filter((p) => p.clientId === c.id).length} pets</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useUi((u) => u.toasts);
  const dismiss = useUi((u) => u.dismissToast);
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1100] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
            t.tone === 'error' ? 'bg-red-600' : t.tone === 'warning' ? 'bg-amber-600' : t.tone === 'info' ? 'bg-slate-800' : 'bg-slate-900',
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
              onClick={() => {
                navigate(t.action!.to);
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-white/60 hover:text-white" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Detects a newer deploy (the built bundle name changes) and offers a one-click reload. */
function useNewVersion() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute('src');
    if (!current) return; // dev server
    const check = async () => {
      try {
        const html = await fetch('/', { cache: 'no-store' }).then((r) => r.text());
        const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
        if (latest && latest !== current) setAvailable(true);
      } catch {
        /* offline: try again later */
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void check();
    const t = setInterval(check, 60_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    void check();
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return available;
}

function UpdateBanner() {
  const available = useNewVersion();
  if (!available) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-700 px-4 py-2 text-center text-sm text-white">
      <span>A new version of VetSet Manager is available.</span>
      <button className="rounded-md bg-white/20 px-2.5 py-1 font-semibold hover:bg-white/30" onClick={() => window.location.reload()}>
        Reload now
      </button>
    </div>
  );
}

function StaleDemoBanner() {
  const seededOn = useData((s) => s.settings.seededOn);
  const [hidden, setHidden] = useState(false);
  if (!seededOn || seededOn === todayStr() || hidden) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <span>Demo data was generated for {fmtDate(seededOn, 'EEE, MMM d')}. Refresh it so today’s schedule is populated.</span>
      <button className="font-semibold underline underline-offset-2" onClick={() => void resetDemoData()}>
        Refresh demo data
      </button>
      <button className="text-amber-700" onClick={() => setHidden(true)}>
        Dismiss
      </button>
    </div>
  );
}

export function Layout({ children }: { children?: ReactNode }) {
  const role = useUi((u) => u.role);
  const compose = useUi((u) => u.compose);
  const openCompose = useUi((u) => u.openCompose);
  const offline = useTravelStore((t) => t.offline);
  const pending = useTravelStore((t) => t.pending);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const businessName = useData((s) => s.settings.businessName);
  useEffect(() => setMobileNav(false), [location.pathname]);

  return (
    <div className="min-h-full lg:pl-64">
      {/* Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SideNav role={role} />
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <p className="truncate font-medium text-slate-700">{businessName}</p>
          <p>Demo data · stored on this device</p>
        </div>
      </aside>

      {/* Mobile drawer nav */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <Brand />
              <button onClick={() => setMobileNav(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <SideNav role={role} onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
          <button onClick={() => setMobileNav(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <PawPrint className="size-6 text-brand-700" />
          </div>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            {(offline || pending > 0) && (
              <span
                className={clsx('hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium md:inline-flex', offline ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600')}
                title={offline ? 'Road routing service unreachable — using distance estimates' : 'Fetching road drive times'}
              >
                {offline ? <WifiOff className="size-3.5" /> : <span className="size-2 animate-pulse rounded-full bg-brand-500" />}
                {offline ? 'Estimated drive times' : 'Updating drive times'}
              </span>
            )}
            {role !== 'driver' && (
              <span className="hidden sm:block">
                <LinkButton to="/book" variant="primary" size="sm" icon={CalendarPlus}>
                  New appointment
                </LinkButton>
              </span>
            )}
            <RoleSwitcher />
          </div>
        </div>
      </header>
      <UpdateBanner />
      <StaleDemoBanner />

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children ?? <Outlet />}</main>

      {/* Mobile tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="flex">
          {MOBILE_TABS[role].map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}
              >
                <t.icon className="size-5" />
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <AppointmentDrawer />
      <MessageComposer request={compose} onClose={() => openCompose(null)} />
      <Toasts />
    </div>
  );
}
