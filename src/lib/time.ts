import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DateStr, TimeStr } from '../data/types';

export const toMin = (t: TimeStr): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const toTime = (mins: number): TimeStr => {
  const m = Math.max(0, Math.round(mins));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** 13:05 -> "1:05 PM"; compact drops ":00" -> "1 PM". */
export const fmtTime = (t: TimeStr | number, compact = false): string => {
  const mins = typeof t === 'number' ? Math.round(t) : toMin(t);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'AM' : 'PM';
  if (compact && m === 0) return `${h12} ${ap}`;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};

export const fmtWindow = (a: TimeStr, b: TimeStr): string => {
  const sameHalf = (toMin(a) < 720) === (toMin(b) < 720);
  const left = fmtTime(a, true);
  return sameHalf ? `${left.replace(/ (AM|PM)$/, '')}–${fmtTime(b, true)}` : `${left}–${fmtTime(b, true)}`;
};

export const fmtDuration = (mins: number): string => {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export const roundTo = (mins: number, step: number, mode: 'floor' | 'ceil' | 'round' = 'round') =>
  Math[mode](mins / step) * step;

export const todayStr = (): DateStr => format(new Date(), 'yyyy-MM-dd');
export const dateStr = (d: Date): DateStr => format(d, 'yyyy-MM-dd');
export const shiftDate = (d: DateStr, days: number): DateStr => dateStr(addDays(parseISO(d), days));
export const daysBetween = (a: DateStr, b: DateStr) => differenceInCalendarDays(parseISO(b), parseISO(a));
export const weekday = (d: DateStr) => parseISO(d).getDay();
export const fmtDate = (d: DateStr, pattern = 'EEE, MMM d') => format(parseISO(d), pattern);

export const relDay = (d: DateStr, today: DateStr = todayStr()): string => {
  const diff = daysBetween(today, d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(parseISO(d), 'EEEE');
  return format(parseISO(d), 'EEE, MMM d');
};

export const nowMinutes = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

export const ageFromDob = (dob?: DateStr): string => {
  if (!dob) return '';
  const days = daysBetween(dob, todayStr());
  if (days < 60) return `${Math.max(1, Math.round(days / 7))} wk`;
  if (days < 730) return `${Math.round(days / 30.4)} mo`;
  return `${Math.floor(days / 365.25)} yr`;
};
