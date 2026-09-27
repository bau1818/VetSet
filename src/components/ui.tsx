import clsx from 'clsx';
import { Bird, Cat, Dog, PawPrint, Rabbit, Turtle, X, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { AppointmentStatus, ServiceCategory, Species } from '../data/types';
import { initials } from '../lib/format';

// ---- buttons ------------------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'dark';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
};
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={clsx('shrink-0', size === 'lg' ? 'size-5' : size === 'xs' ? 'size-3.5' : 'size-4')} aria-hidden />}
      {children}
      {IconR && <IconR className="size-4 shrink-0" aria-hidden />}
    </button>
  );
});

export function LinkButton({
  to,
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  onClick,
}: {
  to?: string;
  href?: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const cls = clsx(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    variants[variant],
    sizes[size],
    className,
  );
  const inner = (
    <>
      {Icon && <Icon className={clsx('shrink-0', size === 'lg' ? 'size-5' : 'size-4')} aria-hidden />}
      {children}
    </>
  );
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
        {inner}
      </a>
    );
  return (
    <Link to={to ?? '#'} className={cls} onClick={onClick}>
      {inner}
    </Link>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }: { icon: LucideIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx('inline-grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800', className)}
      {...rest}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

// ---- surfaces -----------------------------------------------------------------------------------

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-xs', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon = PawPrint, title, body, action }: { icon?: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-5" />
      </span>
      <p className="font-medium text-slate-800">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = 'brand', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: 'brand' | 'amber' | 'red' | 'indigo' | 'slate'; onClick?: () => void }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={clsx('flex w-full items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-xs', onClick && 'transition hover:border-slate-300 hover:shadow-sm')}
    >
      {Icon && (
        <span className={clsx('grid size-9 shrink-0 place-items-center rounded-lg', tones[tone])}>
          <Icon className="size-[18px]" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="tabular mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs leading-snug text-slate-500">{sub}</p>}
      </div>
    </Comp>
  );
}

// ---- badges -------------------------------------------------------------------------------------

export type Tone = 'gray' | 'brand' | 'amber' | 'red' | 'blue' | 'violet' | 'green' | 'indigo' | 'rose';
const badgeTones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function Badge({ tone = 'gray', children, className, icon: Icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', badgeTones[tone], className)}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export const STATUS_META: Record<AppointmentStatus, { label: string; tone: Tone; dot: string }> = {
  requested: { label: 'Requested', tone: 'gray', dot: 'bg-slate-400' },
  scheduled: { label: 'Unconfirmed', tone: 'blue', dot: 'bg-sky-500' },
  confirmed: { label: 'Confirmed', tone: 'brand', dot: 'bg-brand-600' },
  en_route: { label: 'En route', tone: 'amber', dot: 'bg-amber-500' },
  arrived: { label: 'On site', tone: 'violet', dot: 'bg-violet-500' },
  completed: { label: 'Completed', tone: 'green', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', tone: 'gray', dot: 'bg-slate-300' },
  no_show: { label: 'No-show', tone: 'red', dot: 'bg-red-500' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone}>
      <span className={clsx('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </Badge>
  );
}

export const CATEGORY_META: Record<ServiceCategory, { label: string; bar: string; soft: string }> = {
  wellness: { label: 'Wellness', bar: 'bg-brand-500', soft: 'bg-brand-50 border-brand-200 text-brand-900' },
  vaccine: { label: 'Vaccines', bar: 'bg-sky-500', soft: 'bg-sky-50 border-sky-200 text-sky-900' },
  sick: { label: 'Sick / recheck', bar: 'bg-amber-500', soft: 'bg-amber-50 border-amber-200 text-amber-900' },
  senior: { label: 'Senior care', bar: 'bg-violet-500', soft: 'bg-violet-50 border-violet-200 text-violet-900' },
  endoflife: { label: 'End-of-life care', bar: 'bg-slate-500', soft: 'bg-slate-100 border-slate-300 text-slate-800' },
  procedure: { label: 'Procedures', bar: 'bg-cyan-500', soft: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
  other: { label: 'Other', bar: 'bg-slate-400', soft: 'bg-slate-50 border-slate-200 text-slate-800' },
};

const SPECIES_ICON: Record<Species, LucideIcon> = { dog: Dog, cat: Cat, rabbit: Rabbit, bird: Bird, reptile: Turtle, other: PawPrint };
export function SpeciesIcon({ species, className }: { species: Species; className?: string }) {
  const I = SPECIES_ICON[species] ?? PawPrint;
  return <I className={clsx('size-4', className)} aria-label={species} />;
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-12 text-base' : 'size-9 text-xs';
  return (
    <span className={clsx('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', s)} style={{ background: color ?? '#64748b' }}>
      {initials(name.replace(/^Dr\.\s*/, ''))}
    </span>
  );
}

// ---- form controls ------------------------------------------------------------------------------

const control =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(control, 'h-10', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(control, 'min-h-20 py-2', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(control, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={clsx('inline-flex rounded-lg bg-slate-100 p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md font-medium whitespace-nowrap transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={clsx(
            'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={clsx('tabular rounded-full px-1.5 text-xs', value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- overlays -----------------------------------------------------------------------------------

const useEscape = (open: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEscape(open, onClose);
  if (!open) return null;
  const w = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal className={clsx('relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', w)}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" />
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, children, width = 'max-w-xl' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[900] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className={clsx('relative flex h-full w-full flex-col bg-white shadow-2xl', width)}>{children}</aside>
    </div>,
    document.body,
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-sans text-[10px] font-medium text-slate-500">{children}</kbd>;
}

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
