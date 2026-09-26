// Small, dependency-free charts. Spec: thin bars (≤24px) with 4px rounded data-ends, 2px surface
// gaps between stacked segments, hairline recessive axes, text in ink (never series color),
// hover tooltips on every mark, legend for ≥2 series. Palette validated (see README › Charts).
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';

export const SERIES = {
  onsite: '#0d9488',
  driving: '#eb6834',
  single: '#0d9488',
};

function Tip({ x, y, children }: { x: number | string; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Horizontal single-series bars with the value at the tip. */
export function BarList({ data, format = (v) => String(v), color = SERIES.single }: { data: { label: string; value: number; sub?: string }[]; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 text-sm" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <span className="truncate text-slate-600" title={d.label}>
            {d.label}
          </span>
          <span className="flex items-center gap-2">
            <span className="relative h-3.5 flex-1">
              <span
                className={clsx('absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity', hover !== null && hover !== i && 'opacity-50')}
                style={{ width: `${(d.value / max) * 100}%`, background: color, minWidth: d.value ? 3 : 0 }}
              />
            </span>
            <span className="tabular w-16 shrink-0 text-right text-xs font-medium text-slate-700">{format(d.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
};

/** Vertical single-series columns with clean y ticks and per-column hover. */
export function ColumnChart({ data, format = (v) => String(v), height = 180, highlightLast = true }: { data: { label: string; value: number; detail?: string }[]; format?: (v: number) => string; height?: number; highlightLast?: boolean }) {
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [0, max / 2, max];
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative" style={{ height: height + 28 }}>
      <div className="absolute inset-x-0 top-0 flex" style={{ height }}>
        <div className="relative w-12 shrink-0">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: height - (t / max) * height }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ top: height - (t / max) * height }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.label}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={clsx('w-full max-w-6 rounded-t-[4px] transition-opacity', hover !== null && hover !== i && 'opacity-50')}
                  style={{ height: `${(d.value / max) * 100}%`, background: SERIES.single, minHeight: d.value ? 2 : 0 }}
                />
                {highlightLast && i === data.length - 1 && hover === null && (
                  <span className="tabular absolute -translate-y-full pb-1 text-[11px] font-semibold text-slate-700" style={{ bottom: `${(d.value / max) * 100}%` }}>
                    {format(d.value)}
                  </span>
                )}
                {hover === i && (
                  <Tip x="50%" y={0}>
                    <span className="font-semibold">{d.label}</span> · {format(d.value)}
                    {d.detail && <span className="block text-slate-300">{d.detail}</span>}
                  </Tip>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex pl-12">
        {data.map((d, i) => (
          <span key={d.label} className={clsx('flex-1 truncate text-center text-[11px] text-slate-500', data.length > 8 && i % 2 === 1 && 'invisible')}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal 100%-stacked bars (e.g. on-site vs driving time per unit). */
export function StackedBars({ rows, series, format }: { rows: { label: string; values: number[] }[]; series: { label: string; color: string }[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Legend items={series} />
      {rows.map((r) => {
        const total = r.values.reduce((a, b) => a + b, 0) || 1;
        return (
          <div key={r.label} className="grid grid-cols-[minmax(5rem,8rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate text-slate-600">{r.label}</span>
            <div className="relative flex h-4 gap-[2px]">
              {r.values.map((v, i) => {
                const key = `${r.label}-${i}`;
                const pct = (v / total) * 100;
                return (
                  <div
                    key={key}
                    className={clsx('relative h-full first:rounded-l-[4px] last:rounded-r-[4px]', hover && hover !== key && 'opacity-60')}
                    style={{ width: `${pct}%`, background: series[i].color }}
                    onMouseEnter={() => setHover(key)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {pct >= 18 && <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-white">{Math.round(pct)}%</span>}
                    {hover === key && (
                      <Tip x="50%" y={0}>
                        {series[i].label}: {format(v)} ({Math.round(pct)}%)
                      </Tip>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Capacity meter: fill carries severity, track is a lighter step of the same hue. */
export function Meter({ value, color, title }: { value: number; color: string; title?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = value > 100 ? '#d03b3b' : value >= 90 ? '#c98500' : color;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: `${color}22` }} title={title}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}
